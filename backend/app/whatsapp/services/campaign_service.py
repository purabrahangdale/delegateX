"""
WhatsApp Automation — Campaigns & background send worker

Data model
  whatsapp_campaigns            one document per campaign (configuration + lifecycle status)
  whatsapp_campaign_recipients  one "send job" per recipient (campaign or automation). The job's
                                `state` is the single source of truth for counts and reporting.

Job states
  draft → scheduled → queued → sending → accepted → sent → delivered → read
  terminal / side states: invalid, skipped, failed, unknown, cancelled, paused

  * `accepted`  Meta returned a wamid (API acceptance, NOT delivery).
  * `sent/delivered/read/failed` only come from Meta status webhooks.
  * `unknown`   the worker was interrupted (or Meta timed out) after the request may have reached
                Meta. These are never retried automatically to avoid duplicate messages.

Concurrency
  Jobs are claimed with an atomic find_one_and_update (queued → sending + lease), so any number of
  worker processes can run without sending the same job twice. A unique idempotency_key per job
  prevents duplicate jobs for the same campaign recipient or automation trigger.

Business numbers
  Campaigns and jobs are stamped with `number_id` / `phone_number_id` when created. The worker sends
  each job with the credentials of the job's own number; if that number is removed, deactivated or
  disconnected the job fails with a clear reason — it is never sent through another number.
"""

import asyncio
import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config.database import (
    whatsapp_campaign_collection as campaigns,
    whatsapp_campaign_recipient_collection as jobs,
    whatsapp_message_collection as messages,
)
from app.whatsapp.meta_api import MetaClient, MetaApiError, OPT_OUT_ERROR_CODES
from app.whatsapp import numbers as number_registry
from app.whatsapp.repository import DNDRepository, _serialize_doc
from app.whatsapp.services import template_service

logger = logging.getLogger("whatsapp.campaigns")

STATE_RANK = {"accepted": 2, "sent": 3, "delivered": 4, "read": 5}
PENDING_STATES = ["draft", "scheduled", "queued", "paused"]
CANCELLABLE_STATES = ["draft", "scheduled", "queued", "paused"]
TERMINAL_CAMPAIGN_STATES = {"completed", "partially_failed", "failed", "cancelled"}

MAX_ATTEMPTS = int(os.getenv("WHATSAPP_SEND_MAX_ATTEMPTS", "5"))
SEND_RATE_PER_SECOND = float(os.getenv("WHATSAPP_SEND_RATE_PER_SECOND", "20"))
SEND_CONCURRENCY = int(os.getenv("WHATSAPP_SEND_CONCURRENCY", "5"))
LEASE_SECONDS = 120
DEFAULT_COUNTRY_CODE = os.getenv("WHATSAPP_DEFAULT_COUNTRY_CODE", "91")

WORKER_ID = f"{os.getpid()}-{uuid.uuid4().hex[:6]}"


def _now_dt() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _now() -> str:
    return _now_dt().isoformat()


# ═══════════════════════════════════════════════════════════════════
# RECIPIENT VALIDATION & VARIABLE MAPPING
# ═══════════════════════════════════════════════════════════════════

def normalize_phone(raw: str) -> Optional[str]:
    """Return E.164 digits (no '+') or None if the number cannot be valid."""
    if not raw:
        return None
    has_plus = str(raw).strip().startswith("+")
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return None
    if not has_plus:
        if digits.startswith("00"):
            digits = digits[2:]
        elif len(digits) == 11 and digits.startswith("0"):
            digits = DEFAULT_COUNTRY_CODE + digits[1:]
        elif len(digits) == 10 and DEFAULT_COUNTRY_CODE:
            digits = DEFAULT_COUNTRY_CODE + digits
    if digits.startswith("0") or not (8 <= len(digits) <= 15):
        return None
    return digits


def resolve_slot_values(slots: List[dict], mapping: Dict[str, dict], recipient: dict) -> Dict[str, str]:
    """
    mapping: slot_key → {"source": "field", "value": "<recipient field>"} | {"source": "static", "value": "..."}
    recipient: {"name", "phone", "fields": {...}}
    """
    fields = {**(recipient.get("fields") or {}), "name": recipient.get("name"), "phone": recipient.get("phone")}
    first = (recipient.get("name") or "").split(" ")[0] if recipient.get("name") else None
    fields.setdefault("first_name", first)
    values: Dict[str, str] = {}
    for slot in slots:
        rule = mapping.get(slot["key"]) or {}
        if rule.get("source") == "static":
            val = rule.get("value")
        elif rule.get("source") == "field":
            val = fields.get(rule.get("value"))
        else:
            val = None
        if val not in (None, ""):
            values[slot["key"]] = str(val).strip()
    return values


def _evaluate_recipient(tmpl: dict, mapping: dict, raw: dict) -> dict:
    """Validate one recipient and resolve its send components. Never mutates the input."""
    name = (raw.get("name") or "").strip()
    phone = normalize_phone(raw.get("phone") or raw.get("recipient_phone") or "")
    extra = {k: v for k, v in raw.items() if k not in ("name", "phone", "recipient_phone") and isinstance(v, (str, int, float))}
    result = {
        "name": name or None,
        "phone": phone,
        "raw_phone": raw.get("phone") or raw.get("recipient_phone"),
        "fields": extra,
        "state": "draft",
        "reason": None,
    }
    if not phone:
        result.update(state="invalid", reason="Invalid phone number (must include country code, 8–15 digits)")
        return result
    if raw.get("opt_in") is False or str(raw.get("opt_in", "")).lower() in ("false", "no", "0"):
        result.update(state="skipped", reason="Contact has not opted in to WhatsApp messages")
        return result
    if DNDRepository.is_dnd(phone) or DNDRepository.is_dnd(raw.get("phone") or ""):
        result.update(state="skipped", reason="Opted out (Global DND list)")
        return result
    slots = template_service.get_send_slots(tmpl)
    values = resolve_slot_values(slots, mapping, {"name": name, "phone": phone, "fields": extra})
    components, missing = template_service.build_send_components(tmpl, values)
    if missing:
        result.update(state="invalid", reason="Missing value for: " + ", ".join(missing))
        result["preview"] = template_service.render_preview(tmpl, values)["text"]
        return result
    result["send_components"] = components
    result["preview"] = template_service.render_preview(tmpl, values)["text"]
    return result


def _load_sendable_template(template_id: str, number: Optional[dict] = None) -> dict:
    tmpl = template_service.TemplateRepository.find_by_id(template_id) if template_id else None
    if not tmpl:
        raise ValueError("Selected template was not found.")
    if not template_service.template_in_scope(tmpl, number):
        raise ValueError("Selected template does not belong to this number's WhatsApp Business Account.")
    if not template_service.is_sendable(tmpl):
        raise ValueError(
            f"Template '{tmpl.get('name')}' is {tmpl.get('status') or 'DRAFT'} and cannot be sent. "
            "Only templates approved by Meta can be used. Sync templates to refresh statuses."
        )
    return tmpl


def _template_snapshot(tmpl: dict) -> dict:
    return {
        "local_id": tmpl["_id"],
        "meta_template_id": tmpl.get("meta_template_id"),
        "name": tmpl.get("meta_template_name"),
        "display_name": tmpl.get("name"),
        "language": tmpl.get("language"),
        "category": tmpl.get("meta_category"),
    }


def load_audience(source: str, recipients: Optional[List[dict]] = None) -> List[dict]:
    """Recipients from the client (WhatsApp contacts) or server-side ERP collections."""
    if source == "crm_leads":
        from app.config.database import crm_lead_collection
        return [
            {"name": l.get("name"), "phone": l.get("phone"), "email": l.get("email"), "project_type": l.get("projectType"),
             "assigned_to": l.get("assignedTo"), "status": l.get("status"), "lead_id": str(l["_id"])}
            for l in crm_lead_collection.find({"phone": {"$nin": [None, ""]}})
        ]
    if source == "employees":
        from app.config.database import employee_collection
        return [
            {"name": e.get("name"), "phone": e.get("phone") or e.get("mobile"), "email": e.get("email"),
             "department": e.get("department"), "role": e.get("role"), "employee_id": str(e["_id"])}
            for e in employee_collection.find({"$or": [{"phone": {"$nin": [None, ""]}}, {"mobile": {"$nin": [None, ""]}}]})
        ]
    return recipients or []


def preview_campaign(template_id: str, mapping: dict, recipients: List[dict], sample_size: int = 5, number: Optional[dict] = None) -> dict:
    tmpl = _load_sendable_template(template_id, number)
    evaluated, seen, duplicates = [], set(), 0
    for raw in recipients:
        ev = _evaluate_recipient(tmpl, mapping, raw)
        if ev["phone"] and ev["phone"] in seen:
            duplicates += 1
            continue
        if ev["phone"]:
            seen.add(ev["phone"])
        evaluated.append(ev)
    eligible = [e for e in evaluated if e["state"] == "draft"]
    return {
        "template": template_service.describe_for_sending(tmpl),
        "total": len(recipients),
        "duplicates_removed": duplicates,
        "eligible": len(eligible),
        "invalid": [{"name": e["name"], "phone": e["raw_phone"], "reason": e["reason"]} for e in evaluated if e["state"] == "invalid"],
        "skipped": [{"name": e["name"], "phone": e["raw_phone"], "reason": e["reason"]} for e in evaluated if e["state"] == "skipped"],
        "samples": [{"name": e["name"], "phone": e["phone"], "preview": e["preview"]} for e in eligible[:sample_size]],
    }


# ═══════════════════════════════════════════════════════════════════
# CAMPAIGN LIFECYCLE
# ═══════════════════════════════════════════════════════════════════

def _parse_schedule(scheduled_at: Optional[str]) -> Optional[datetime]:
    """Accept ISO-8601 with offset (frontend sends UTC 'Z'); store naive UTC."""
    if not scheduled_at:
        return None
    dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _number_stamp(number: Optional[dict]) -> dict:
    if not number:
        raise ValueError("No WhatsApp business number is selected. Add or select a number in WhatsApp Settings.")
    return {"number_id": str(number["_id"]), "phone_number_id": number.get("phone_number_id"), "waba_id": number.get("waba_id")}


def create_campaign(payload: dict, user: Optional[str] = None, number: Optional[dict] = None) -> dict:
    """Persist a draft campaign and its recipient jobs (state 'draft' / 'invalid' / 'skipped') for `number`."""
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValueError("Campaign name is required.")
    stamp = _number_stamp(number)
    client_key = (payload.get("client_request_id") or "").strip() or None
    if client_key:
        existing = campaigns.find_one({"client_request_id": client_key})
        if existing:
            if existing.get("number_id") != stamp["number_id"]:
                raise ValueError("This request was already used for a campaign on another WhatsApp number.")
            return get_campaign(str(existing["_id"]))

    tmpl = _load_sendable_template(payload.get("template_id"), number)
    mapping = payload.get("variable_mapping") or {}
    source = payload.get("audience_source") or "contacts"
    recipients = load_audience(source, payload.get("recipients"))
    if not recipients:
        raise ValueError("No recipients selected.")

    now = _now()
    doc = {
        "name": name,
        "purpose": (payload.get("purpose") or "").strip(),
        "client_request_id": client_key,
        **stamp,
        "template": _template_snapshot(tmpl),
        "variable_mapping": mapping,
        "audience": {"source": source, "label": payload.get("audience_label") or source},
        "status": "draft",
        "schedule": {"mode": "immediate", "scheduled_at": None, "timezone": payload.get("timezone") or "UTC"},
        "created_by": user,
        "created_at": now,
        "updated_at": now,
    }
    try:
        cid = campaigns.insert_one(doc).inserted_id
    except DuplicateKeyError:
        return get_campaign(str(campaigns.find_one({"client_request_id": client_key})["_id"]))

    seen, duplicates, batch = set(), 0, []
    for raw in recipients:
        ev = _evaluate_recipient(tmpl, mapping, raw)
        if ev["phone"] and ev["phone"] in seen:
            duplicates += 1
            continue
        if ev["phone"]:
            seen.add(ev["phone"])
        batch.append({
            "campaign_id": str(cid),
            "source": "campaign",
            "idempotency_key": f"campaign:{cid}:{ev['phone'] or uuid.uuid4().hex}",
            "phone": ev["phone"],
            "raw_phone": ev["raw_phone"],
            "name": ev["name"],
            "fields": ev["fields"],
            "template": doc["template"],
            "number_id": stamp["number_id"],
            "phone_number_id": stamp["phone_number_id"],
            "send_components": ev.get("send_components"),
            "preview": ev.get("preview"),
            "state": ev["state"],
            "status_rank": 0,
            "reason": ev["reason"],
            "attempts": 0,
            "errors": [],
            "status_history": [{"state": ev["state"], "at": now, "source": "create"}],
            "created_at": now,
            "updated_at": now,
        })
    if batch:
        jobs.insert_many(batch, ordered=False)
    campaigns.update_one({"_id": cid}, {"$set": {"summary": {"submitted": len(recipients), "duplicates_removed": duplicates}}})
    return get_campaign(str(cid))


def launch_campaign(campaign_id: str, payload: dict, user: Optional[str] = None) -> dict:
    """
    Move a draft campaign to scheduled (future time) or queued (now).
    Requires explicit consent confirmation. Atomic on status so repeated clicks launch once.
    """
    if not payload.get("confirm_consent"):
        raise ValueError("Please confirm that all recipients have opted in to receive WhatsApp messages from you.")
    camp = campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not camp:
        raise LookupError("Campaign not found")
    if camp["status"] != "draft":
        return get_campaign(campaign_id)  # already launched — idempotent

    number = number_registry.scope_for_record(camp).number
    _load_sendable_template(camp["template"]["local_id"], number)  # re-check eligibility at launch time
    problem = number_registry.sending_problem(number)
    if problem:
        raise ValueError(problem)
    if jobs.count_documents({"campaign_id": campaign_id, "state": "draft"}) == 0:
        raise ValueError("This campaign has no eligible recipients to send to.")

    scheduled = _parse_schedule(payload.get("scheduled_at"))
    if scheduled and scheduled < _now_dt() - timedelta(minutes=1):
        raise ValueError("Scheduled time is in the past.")
    is_future = bool(scheduled and scheduled > _now_dt() + timedelta(seconds=30))
    new_status = "scheduled" if is_future else "queued"
    job_state = "scheduled" if is_future else "queued"
    now = _now()

    updated = campaigns.find_one_and_update(
        {"_id": ObjectId(campaign_id), "status": "draft"},
        {"$set": {
            "status": new_status,
            "schedule": {
                "mode": "scheduled" if is_future else "immediate",
                "scheduled_at": scheduled.isoformat() if is_future else None,
                "timezone": payload.get("timezone") or camp.get("schedule", {}).get("timezone") or "UTC",
            },
            "consent": {"confirmed": True, "confirmed_by": user, "confirmed_at": now},
            "launched_by": user,
            "launched_at": now,
            "updated_at": now,
        }},
    )
    if updated:
        jobs.update_many(
            {"campaign_id": campaign_id, "state": "draft"},
            {"$set": {"state": job_state, "next_attempt_at": scheduled.isoformat() if is_future else now, "queued_at": now, "updated_at": now},
             "$push": {"status_history": {"state": job_state, "at": now, "source": "launch"}}},
        )
        template_service.record_template_usage_metrics(camp["template"]["local_id"], sent_count=0)
        wake_worker()
    return get_campaign(campaign_id)


def cancel_campaign(campaign_id: str, user: Optional[str] = None) -> dict:
    """Cancel only work that has not been handed to Meta. Messages already accepted are unaffected."""
    camp = campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not camp:
        raise LookupError("Campaign not found")
    if camp["status"] in TERMINAL_CAMPAIGN_STATES:
        raise ValueError(f"Campaign is already {camp['status']}.")
    now = _now()
    res = jobs.update_many(
        {"campaign_id": campaign_id, "state": {"$in": CANCELLABLE_STATES}},
        {"$set": {"state": "cancelled", "updated_at": now, "reason": "Cancelled before sending"},
         "$push": {"status_history": {"state": "cancelled", "at": now, "source": f"cancel:{user or 'unknown'}"}}},
    )
    campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": {"status": "cancelled", "cancelled_at": now, "cancelled_by": user, "updated_at": now}})
    _finalize_if_done(campaign_id)  # keeps 'cancelled' but records completion time if nothing is in flight
    out = get_campaign(campaign_id)
    out["cancelled_jobs"] = res.modified_count
    return out


def pause_campaign(campaign_id: str) -> dict:
    res = campaigns.update_one({"_id": ObjectId(campaign_id), "status": {"$in": ["queued", "processing"]}}, {"$set": {"status": "paused", "updated_at": _now()}})
    if res.modified_count:
        jobs.update_many({"campaign_id": campaign_id, "state": "queued"}, {"$set": {"state": "paused", "updated_at": _now()}})
    return get_campaign(campaign_id)


def resume_campaign(campaign_id: str) -> dict:
    res = campaigns.update_one({"_id": ObjectId(campaign_id), "status": "paused"}, {"$set": {"status": "processing", "updated_at": _now()}})
    if res.modified_count:
        jobs.update_many({"campaign_id": campaign_id, "state": "paused"}, {"$set": {"state": "queued", "next_attempt_at": _now(), "updated_at": _now()}})
        wake_worker()
    return get_campaign(campaign_id)


def retry_failed(campaign_id: str) -> dict:
    """Re-queue failed recipients that were never accepted by Meta (no wamid) — cannot duplicate."""
    camp = campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not camp:
        raise LookupError("Campaign not found")
    number = number_registry.scope_for_record(camp).number
    _load_sendable_template(camp["template"]["local_id"], number)
    problem = number_registry.sending_problem(number)
    if problem:
        raise ValueError(problem)
    now = _now()
    res = jobs.update_many(
        {"campaign_id": campaign_id, "state": "failed", "wamid": {"$in": [None, ""]}, "error.opt_out": {"$ne": True}},
        {"$set": {"state": "queued", "attempts": 0, "next_attempt_at": now, "updated_at": now},
         "$push": {"status_history": {"state": "queued", "at": now, "source": "manual_retry"}}},
    )
    if res.modified_count:
        campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": {"status": "processing", "completed_at": None, "updated_at": now}})
        wake_worker()
    out = get_campaign(campaign_id)
    out["requeued"] = res.modified_count
    return out


# ═══════════════════════════════════════════════════════════════════
# REPORTING (computed from recipient jobs — consistent counting rules)
# ═══════════════════════════════════════════════════════════════════

def compute_counts(match: dict) -> dict:
    agg = list(jobs.aggregate([
        {"$match": match},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "invalid": {"$sum": {"$cond": [{"$eq": ["$state", "invalid"]}, 1, 0]}},
            "skipped": {"$sum": {"$cond": [{"$eq": ["$state", "skipped"]}, 1, 0]}},
            "queued": {"$sum": {"$cond": [{"$in": ["$state", PENDING_STATES]}, 1, 0]}},
            "sending": {"$sum": {"$cond": [{"$eq": ["$state", "sending"]}, 1, 0]}},
            "accepted": {"$sum": {"$cond": [{"$gt": ["$wamid", None]}, 1, 0]}},
            "sent": {"$sum": {"$cond": [{"$in": ["$state", ["sent", "delivered", "read"]]}, 1, 0]}},
            "delivered": {"$sum": {"$cond": [{"$in": ["$state", ["delivered", "read"]]}, 1, 0]}},
            "read": {"$sum": {"$cond": [{"$eq": ["$state", "read"]}, 1, 0]}},
            "failed": {"$sum": {"$cond": [{"$eq": ["$state", "failed"]}, 1, 0]}},
            "unknown": {"$sum": {"$cond": [{"$eq": ["$state", "unknown"]}, 1, 0]}},
            "cancelled": {"$sum": {"$cond": [{"$eq": ["$state", "cancelled"]}, 1, 0]}},
            "awaiting_status": {"$sum": {"$cond": [{"$eq": ["$state", "accepted"]}, 1, 0]}},
        }},
    ]))
    c = agg[0] if agg else {}
    c.pop("_id", None)
    keys = ["total", "invalid", "skipped", "queued", "sending", "accepted", "sent", "delivered", "read", "failed", "unknown", "cancelled", "awaiting_status"]
    counts = {k: c.get(k, 0) for k in keys}
    counts["eligible"] = counts["total"] - counts["invalid"] - counts["skipped"]
    attempted = counts["eligible"] - counts["cancelled"] - counts["queued"] - counts["sending"]
    counts["delivery_rate"] = round(counts["delivered"] / counts["accepted"] * 100, 1) if counts["accepted"] else None
    counts["read_rate"] = round(counts["read"] / counts["delivered"] * 100, 1) if counts["delivered"] else None
    counts["failure_rate"] = round(counts["failed"] / attempted * 100, 1) if attempted > 0 else None
    counts["progress"] = round((counts["eligible"] - counts["queued"] - counts["sending"] - counts["cancelled"]) / max(1, counts["eligible"] - counts["cancelled"]) * 100, 1) if counts["eligible"] else 0
    return counts


def get_campaign(campaign_id: str) -> Optional[dict]:
    camp = campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not camp:
        return None
    camp = _serialize_doc(camp)
    camp["counts"] = compute_counts({"campaign_id": campaign_id})
    return camp


def list_campaigns(limit: int = 100, skip: int = 0, status: Optional[str] = None, search: Optional[str] = None, scope: Optional[dict] = None) -> dict:
    query: Dict[str, Any] = dict(scope or {})
    if status:
        query["status"] = status
    if search:
        query["name"] = {"$regex": re.escape(search), "$options": "i"}
    docs = list(campaigns.find(query).sort("created_at", -1).skip(skip).limit(limit))
    ids = [str(d["_id"]) for d in docs]
    per_campaign = {
        r["_id"]: r for r in jobs.aggregate([
            {"$match": {"campaign_id": {"$in": ids}}},
            {"$group": {
                "_id": "$campaign_id",
                "total": {"$sum": 1},
                "eligible": {"$sum": {"$cond": [{"$in": ["$state", ["invalid", "skipped"]]}, 0, 1]}},
                "accepted": {"$sum": {"$cond": [{"$gt": ["$wamid", None]}, 1, 0]}},
                "delivered": {"$sum": {"$cond": [{"$in": ["$state", ["delivered", "read"]]}, 1, 0]}},
                "read": {"$sum": {"$cond": [{"$eq": ["$state", "read"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$state", "failed"]}, 1, 0]}},
                "pending": {"$sum": {"$cond": [{"$in": ["$state", PENDING_STATES + ["sending"]]}, 1, 0]}},
            }},
        ])
    }
    out = []
    for d in docs:
        s = _serialize_doc(d)
        s["counts"] = {k: v for k, v in per_campaign.get(s["_id"], {}).items() if k != "_id"}
        out.append(s)
    return {"campaigns": out, "total": campaigns.count_documents(query)}


def list_recipients(campaign_id: str, state: Optional[str] = None, search: Optional[str] = None, limit: int = 200, skip: int = 0) -> dict:
    query: Dict[str, Any] = {"campaign_id": campaign_id}
    if state:
        query["state"] = {"$in": state.split(",")}
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"name": rx}, {"phone": rx}]
    docs = jobs.find(query, {"send_components": 0}).sort("created_at", 1).skip(skip).limit(limit)
    return {"recipients": [_serialize_doc(d) for d in docs], "total": jobs.count_documents(query)}


# ═══════════════════════════════════════════════════════════════════
# AUTOMATION ENQUEUE (same pipeline, same guarantees)
# ═══════════════════════════════════════════════════════════════════

def enqueue_single(*, template_id: str, mapping: dict, recipient: dict, idempotency_key: str,
                   automation_run_id: Optional[str] = None, workflow: Optional[str] = None,
                   number: Optional[dict] = None) -> dict:
    """Queue one template message from `number`. Returns the job (existing job if the key was already used)."""
    existing = jobs.find_one({"idempotency_key": idempotency_key})
    if existing:
        out = _serialize_doc(existing)
        out["duplicate"] = True
        return out
    stamp = _number_stamp(number)
    tmpl = _load_sendable_template(template_id, number)
    ev = _evaluate_recipient(tmpl, mapping, recipient)
    now = _now()
    state = "queued" if ev["state"] == "draft" else ev["state"]
    doc = {
        "campaign_id": None,
        "automation_run_id": automation_run_id,
        "workflow": workflow,
        "source": "automation",
        "idempotency_key": idempotency_key,
        "phone": ev["phone"],
        "raw_phone": ev["raw_phone"],
        "name": ev["name"],
        "fields": ev["fields"],
        "template": _template_snapshot(tmpl),
        "number_id": stamp["number_id"],
        "phone_number_id": stamp["phone_number_id"],
        "send_components": ev.get("send_components"),
        "preview": ev.get("preview"),
        "state": state,
        "status_rank": 0,
        "reason": ev["reason"],
        "attempts": 0,
        "errors": [],
        "next_attempt_at": now,
        "queued_at": now if state == "queued" else None,
        "status_history": [{"state": state, "at": now, "source": "automation"}],
        "created_at": now,
        "updated_at": now,
    }
    try:
        doc["_id"] = jobs.insert_one(doc).inserted_id
    except DuplicateKeyError:
        out = _serialize_doc(jobs.find_one({"idempotency_key": idempotency_key}))
        out["duplicate"] = True
        return out
    if state == "queued":
        wake_worker()
    return _serialize_doc(doc)


# ═══════════════════════════════════════════════════════════════════
# WORKER
# ═══════════════════════════════════════════════════════════════════

_wake_event: Optional[asyncio.Event] = None
_worker_task: Optional[asyncio.Task] = None
_last_maintenance = 0.0


def wake_worker():
    if _wake_event is not None:
        try:
            _wake_event.set()
        except RuntimeError:
            pass


class _RateLimiter:
    def __init__(self, per_second: float):
        self.interval = 1.0 / per_second if per_second > 0 else 0
        self._next = 0.0
        self._lock = asyncio.Lock()

    async def wait(self):
        async with self._lock:
            now = time.monotonic()
            if self._next > now:
                await asyncio.sleep(self._next - now)
            self._next = max(now, self._next) + self.interval


_limiter = _RateLimiter(SEND_RATE_PER_SECOND)


def _backoff_seconds(attempt: int) -> int:
    return min(3600, 30 * (2 ** max(0, attempt - 1)))  # 30s, 60s, 120s, 240s ...


def _promote_scheduled():
    now = _now()
    for camp in campaigns.find({"status": "scheduled", "schedule.scheduled_at": {"$lte": now}}, {"_id": 1}):
        cid = str(camp["_id"])
        if campaigns.update_one({"_id": camp["_id"], "status": "scheduled"}, {"$set": {"status": "queued", "updated_at": now}}).modified_count:
            jobs.update_many({"campaign_id": cid, "state": "scheduled"},
                             {"$set": {"state": "queued", "next_attempt_at": now, "updated_at": now},
                              "$push": {"status_history": {"state": "queued", "at": now, "source": "schedule"}}})
            logger.info(f"[Campaign Worker] Scheduled campaign {cid} is now due")


def _recover_stale_leases():
    """A job stuck in 'sending' means a worker died mid-request: outcome unknown, never auto-resend."""
    now = _now()
    for job in jobs.find({"state": "sending", "lease_until": {"$lt": now}}, {"_id": 1, "campaign_id": 1}):
        jobs.update_one(
            {"_id": job["_id"], "state": "sending"},
            {"$set": {"state": "unknown", "reason": "Send interrupted (worker stopped). Not retried automatically to avoid a duplicate message.", "updated_at": now},
             "$push": {"status_history": {"state": "unknown", "at": now, "source": "lease_recovery"}}},
        )


def _claim_job() -> Optional[dict]:
    now = _now()
    lease = (_now_dt() + timedelta(seconds=LEASE_SECONDS)).isoformat()
    return jobs.find_one_and_update(
        {"state": "queued", "next_attempt_at": {"$lte": now}},
        {"$set": {"state": "sending", "lease_until": lease, "worker_id": WORKER_ID, "updated_at": now}, "$inc": {"attempts": 1}},
        sort=[("next_attempt_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


_template_cache: Dict[str, tuple] = {}


def _template_still_sendable(local_id: str) -> Optional[str]:
    """Return None if sendable, else a reason. Cached for 30s to avoid a DB read per message."""
    cached = _template_cache.get(local_id)
    if cached and time.monotonic() - cached[0] < 30:
        return cached[1]
    tmpl = template_service.TemplateRepository.find_by_id(local_id)
    reason = None if template_service.is_sendable(tmpl) else f"Template is {(tmpl or {}).get('status', 'missing')} on Meta — not sendable"
    _template_cache[local_id] = (time.monotonic(), reason)
    return reason


async def _process_job(job: dict):
    job_id = job["_id"]
    now = _now()
    tmpl = job["template"]

    if job.get("campaign_id"):
        camp = campaigns.find_one({"_id": ObjectId(job["campaign_id"])}, {"status": 1})
        if camp and camp["status"] in ("cancelled", "paused"):
            target = "cancelled" if camp["status"] == "cancelled" else "paused"
            jobs.update_one({"_id": job_id, "state": "sending"}, {"$set": {"state": target, "updated_at": now}, "$inc": {"attempts": -1}})
            return
        if camp and camp["status"] == "queued":
            campaigns.update_one({"_id": camp["_id"], "status": "queued"}, {"$set": {"status": "processing", "started_at": now, "updated_at": now}})

    not_sendable = _template_still_sendable(tmpl["local_id"])
    if not_sendable:
        _fail_job(job, {"message": not_sendable, "code": None, "retryable": False})
        return

    payload = {
        "to": job["phone"],
        "type": "template",
        "template": {"name": tmpl["name"], "language": {"code": tmpl["language"]}},
    }
    if job.get("send_components"):
        payload["template"]["components"] = job["send_components"]

    # Send strictly from the job's own number (stamped at creation) — never the UI selection or a default.
    number = number_registry.scope_for_record(job).number
    problem = number_registry.sending_problem(number)
    if problem:
        _fail_job(job, {"message": problem, "code": None, "retryable": False, "number_unavailable": True})
        return
    config = number_registry.config_for(number)

    await _limiter.wait()
    try:
        result = await MetaClient(config).send_message(payload)
    except MetaApiError as e:
        number_registry.mark_auth_failure(str(number["_id"]), e)
        err = {**e.to_dict(), "at": _now(), "attempt": job["attempts"]}
        if e.ambiguous:
            jobs.update_one({"_id": job_id, "state": "sending"}, {
                "$set": {"state": "unknown", "error": err, "reason": "Meta did not confirm the request (timeout). Not retried automatically to avoid a duplicate.", "updated_at": _now()},
                "$push": {"errors": err, "status_history": {"state": "unknown", "at": _now(), "source": "send"}},
            })
        elif e.retryable and job["attempts"] < MAX_ATTEMPTS:
            next_at = (_now_dt() + timedelta(seconds=_backoff_seconds(job["attempts"]))).isoformat()
            jobs.update_one({"_id": job_id, "state": "sending"}, {
                "$set": {"state": "queued", "next_attempt_at": next_at, "error": err, "updated_at": _now()},
                "$push": {"errors": err},
            })
            logger.info(f"[Campaign Worker] Job {job_id} retry #{job['attempts']} at {next_at} (code {e.code})")
        else:
            _fail_job(job, err)
        return

    wamid = result["wamid"]
    accepted_at = _now()
    message_id = _record_outbound_message(job, wamid, accepted_at, number)
    jobs.update_one({"_id": job_id, "state": "sending"}, {
        "$set": {"state": "accepted", "status_rank": STATE_RANK["accepted"], "wamid": wamid, "wa_id": result.get("wa_id"),
                 "message_id": message_id, "accepted_at": accepted_at, "error": None, "reason": None, "updated_at": accepted_at},
        "$unset": {"lease_until": ""},
        "$push": {"status_history": {"state": "accepted", "at": accepted_at, "source": "meta_api"}},
    })
    # A status webhook may have arrived before the wamid was stored; apply any buffered events now.
    from app.whatsapp.services import webhook_service
    webhook_service.reapply_status_events_for(wamid)


def _fail_job(job: dict, err: dict):
    now = _now()
    opt_out = err.get("code") in OPT_OUT_ERROR_CODES
    err = {**err, "opt_out": opt_out}
    jobs.update_one({"_id": job["_id"], "state": "sending"}, {
        "$set": {"state": "failed", "error": err, "reason": err.get("message"), "failed_at": now, "updated_at": now},
        "$push": {"errors": err, "status_history": {"state": "failed", "at": now, "source": "send"}},
    })
    if opt_out and job.get("phone"):
        DNDRepository.add_dnd_number({"phone_number": job["phone"], "reason": "User Opt-out", "source": "Meta API", "notes": "Meta error 131050: user stopped marketing messages"})


def _record_outbound_message(job: dict, wamid: str, at: str, number: Optional[dict] = None) -> Optional[str]:
    """Mirror the accepted message into whatsapp_messages so it shows in the inbox."""
    from app.whatsapp.services.message_service import _generate_conversation_id
    camp_name = None
    if job.get("campaign_id"):
        c = campaigns.find_one({"_id": ObjectId(job["campaign_id"])}, {"name": 1})
        camp_name = c.get("name") if c else None
    doc = {
        "conversation_id": _generate_conversation_id(job["phone"]),
        "number_id": str(number["_id"]) if number else job.get("number_id"),
        "phone_number_id": (number or {}).get("phone_number_id") or job.get("phone_number_id"),
        "direction": "outbound",
        "sender": "DelegateX",
        "sender_phone": "+91-DELEGATEX",
        "recipient": job.get("name") or "Contact",
        "recipient_phone": "+" + job["phone"],
        "content": job.get("preview") or f"[Template: {job['template']['name']}]",
        "message_type": "template",
        "status": "accepted",
        "status_rank": STATE_RANK["accepted"],
        "wamid": wamid,
        "template_id": job["template"]["local_id"],
        "template_name": job["template"].get("display_name"),
        "campaign_id": job.get("campaign_id"),
        "campaign_name": camp_name,
        "automation_workflow": camp_name or job.get("workflow"),
        "campaign_recipient_id": str(job["_id"]),
        "metadata": {"wamid": wamid, "campaign_id": job.get("campaign_id"), "campaign_name": camp_name,
                     "template_id": job["template"]["local_id"], "template_name": job["template"].get("display_name")},
        "accepted_at": at,
        "created_at": at,
        "updated_at": at,
    }
    try:
        return str(messages.insert_one(doc).inserted_id)
    except DuplicateKeyError:
        existing = messages.find_one({"wamid": wamid}, {"_id": 1})
        return str(existing["_id"]) if existing else None


def _finalize_if_done(campaign_id: str):
    """Mark a campaign finished once nothing is waiting to be dispatched."""
    in_flight = jobs.count_documents({"campaign_id": campaign_id, "state": {"$in": ["queued", "sending", "scheduled", "paused"]}})
    if in_flight:
        return
    camp = campaigns.find_one({"_id": ObjectId(campaign_id)}, {"status": 1})
    counts = compute_counts({"campaign_id": campaign_id})
    dispatched = counts["eligible"] - counts["cancelled"]
    if not camp or camp["status"] == "cancelled" or dispatched <= 0:
        final = None  # cancelled campaigns stay 'cancelled'; only the completion time is recorded
    elif counts["failed"] + counts["unknown"] == 0:
        final = "completed"
    elif counts["accepted"] == 0:
        final = "failed"
    else:
        final = "partially_failed"
    now = _now()
    update: Dict[str, Any] = {"completed_at": now, "updated_at": now}
    if final:
        update["status"] = final
    campaigns.update_one({"_id": ObjectId(campaign_id), "status": {"$in": ["queued", "processing", "cancelled"]}, "completed_at": {"$in": [None]}}, {"$set": update})


def _finalize_campaigns():
    for camp in campaigns.find({"$or": [{"status": {"$in": ["queued", "processing"]}}, {"status": "cancelled", "completed_at": None}]}, {"_id": 1}):
        _finalize_if_done(str(camp["_id"]))


async def _worker_loop():
    global _last_maintenance
    logger.info(f"[Campaign Worker] started ({WORKER_ID}), rate={SEND_RATE_PER_SECOND}/s concurrency={SEND_CONCURRENCY}")
    semaphore = asyncio.Semaphore(SEND_CONCURRENCY)
    in_flight: set = set()

    async def run(job):
        async with semaphore:
            try:
                await _process_job(job)
            except Exception as e:  # never let one job kill the worker
                logger.exception(f"[Campaign Worker] Unexpected error on job {job.get('_id')}: {e}")
                jobs.update_one({"_id": job["_id"], "state": "sending"}, {"$set": {
                    "state": "unknown", "reason": f"Internal error during send: {type(e).__name__}", "updated_at": _now()}})

    while True:
        try:
            if time.monotonic() - _last_maintenance > 10:
                _last_maintenance = time.monotonic()
                await asyncio.to_thread(_promote_scheduled)
                await asyncio.to_thread(_recover_stale_leases)
                await asyncio.to_thread(_finalize_campaigns)
                from app.whatsapp.services import webhook_service
                await webhook_service.process_pending_events()

            claimed = 0
            while len(in_flight) < SEND_CONCURRENCY * 2:
                job = await asyncio.to_thread(_claim_job)
                if not job:
                    break
                claimed += 1
                task = asyncio.create_task(run(job))
                in_flight.add(task)
                task.add_done_callback(in_flight.discard)

            if not claimed:
                _wake_event.clear()
                try:
                    await asyncio.wait_for(_wake_event.wait(), timeout=5)
                except asyncio.TimeoutError:
                    pass
            else:
                await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            logger.info("[Campaign Worker] stopping")
            break
        except Exception as e:
            logger.exception(f"[Campaign Worker] loop error: {e}")
            await asyncio.sleep(5)


def start_worker():
    global _worker_task, _wake_event
    if os.getenv("WHATSAPP_WORKER_ENABLED", "true").lower() in ("0", "false", "no"):
        logger.info("[Campaign Worker] disabled via WHATSAPP_WORKER_ENABLED")
        return
    if _worker_task and not _worker_task.done():
        return
    _wake_event = asyncio.Event()
    _worker_task = asyncio.create_task(_worker_loop())


def stop_worker():
    if _worker_task:
        _worker_task.cancel()


def worker_status() -> dict:
    return {
        "running": bool(_worker_task and not _worker_task.done()),
        "worker_id": WORKER_ID,
        "rate_per_second": SEND_RATE_PER_SECOND,
        "concurrency": SEND_CONCURRENCY,
        "max_attempts": MAX_ATTEMPTS,
        "queued_jobs": jobs.count_documents({"state": "queued"}),
        "sending_jobs": jobs.count_documents({"state": "sending"}),
    }
