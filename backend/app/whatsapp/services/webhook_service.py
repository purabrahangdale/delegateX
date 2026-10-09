"""
WhatsApp Automation — Meta webhook ingestion & processing

1. verify_signature(): HMAC-SHA256 of the *raw* body with META_APP_SECRET (X-Hub-Signature-256).
2. ingest(): split the payload into individual events and insert each into
   `whatsapp_webhook_events` with a unique `dedupe_key` (duplicate deliveries are ignored).
   The HTTP handler acknowledges immediately after this step.
3. process_pending_events(): claims unprocessed events and applies them. Failed / unmatched events
   are retried with backoff, so processing survives restarts and never double-counts.

Status updates are monotonic: sent(3) → delivered(4) → read(5). A late 'delivered' never overwrites
'read'; 'failed' is applied only if the message was not yet delivered.

Multiple numbers: one callback URL serves every configured number/WABA. Each event is attributed to the
configured number whose Meta phone_number_id appears in `value.metadata`; template events are matched by
WABA ID. Events for numbers that are not configured are stored as ignored — never attributed to another
number.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config.database import (
    whatsapp_webhook_event_collection as events,
    whatsapp_campaign_recipient_collection as jobs,
    whatsapp_message_collection as messages,
)
from app.whatsapp.meta_api import load_config, OPT_OUT_ERROR_CODES

logger = logging.getLogger("whatsapp.webhook")

STATUS_RANK = {"accepted": 2, "sent": 3, "delivered": 4, "read": 5}
MAX_EVENT_ATTEMPTS = 10
RETENTION_DAYS = int(os.getenv("WHATSAPP_WEBHOOK_EVENT_RETENTION_DAYS", "30"))


def _now() -> str:
    return datetime.utcnow().isoformat()


def _ts(unix: Any) -> str:
    try:
        return datetime.utcfromtimestamp(int(unix)).isoformat()
    except (TypeError, ValueError):
        return _now()


# ═══════════════════════════════════════════════════════════════════
# SIGNATURE
# ═══════════════════════════════════════════════════════════════════

def _number_app_secrets() -> Dict[str, set]:
    """Optional per-number app secrets (numbers whose WABA is subscribed by a different Meta app)."""
    from app.whatsapp import numbers as number_registry
    out: Dict[str, set] = {}
    for doc in number_registry.all_numbers():
        if doc.get("app_secret_enc") and doc.get("waba_id"):
            secret = number_registry.decrypt_secret(doc["app_secret_enc"])
            if secret:
                out.setdefault(secret, set()).add(doc["waba_id"])
    return out


def signature_mode() -> str:
    if load_config().app_secret or _number_app_secrets():
        return "enforced"
    if os.getenv("WHATSAPP_WEBHOOK_ALLOW_UNSIGNED", "").lower() in ("1", "true", "yes"):
        return "disabled_insecure"
    return "missing_secret"


def _signature_ok(secret: str, raw_body: bytes, provided: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)


def match_signature(raw_body: bytes, header_value: Optional[str]) -> Optional[set]:
    """
    Returns the WABAs the signature authorizes: {"*"} for the main app secret (META_APP_SECRET),
    a set of WABA IDs for a per-number app secret, or None if the signature is invalid.
    """
    if not header_value or not header_value.startswith("sha256="):
        return None
    provided = header_value.split("=", 1)[1].strip()
    secret = load_config().app_secret
    if secret and _signature_ok(secret, raw_body, provided):
        return {"*"}
    for number_secret, wabas in _number_app_secrets().items():
        if _signature_ok(number_secret, raw_body, provided):
            return set(wabas)
    return None


def verify_signature(raw_body: bytes, header_value: Optional[str]) -> bool:
    return match_signature(raw_body, header_value) is not None


# ═══════════════════════════════════════════════════════════════════
# INGESTION
# ═══════════════════════════════════════════════════════════════════

def _split_events(payload: dict) -> List[dict]:
    out: List[dict] = []
    for entry in payload.get("entry", []) or []:
        waba_id = str(entry.get("id") or "")
        for change in entry.get("changes", []) or []:
            field = change.get("field")
            value = change.get("value") or {}
            meta = value.get("metadata") or {}
            base = {"field": field, "waba_id": waba_id, "phone_number_id": str(meta.get("phone_number_id") or ""),
                    "display_phone_number": meta.get("display_phone_number")}

            if field == "messages":
                contacts = value.get("contacts") or []
                for st in value.get("statuses") or []:
                    out.append({**base, "kind": "status", "wamid": st.get("id"),
                                "dedupe_key": f"status:{st.get('id')}:{st.get('status')}:{st.get('timestamp')}",
                                "payload": st})
                for msg in value.get("messages") or []:
                    out.append({**base, "kind": "message", "wamid": msg.get("id"),
                                "dedupe_key": f"message:{msg.get('id')}",
                                "payload": msg, "contacts": contacts})
                for err in value.get("errors") or []:
                    out.append({**base, "kind": "error", "dedupe_key": "error:" + hashlib.sha256(json.dumps(err, sort_keys=True).encode()).hexdigest(), "payload": err})
            elif field in ("message_template_status_update", "template_category_update", "message_template_quality_update"):
                key = f"template:{value.get('message_template_id')}:{value.get('event') or value.get('new_category') or value.get('new_quality_score')}:{entry.get('time')}"
                out.append({**base, "kind": "template_status", "dedupe_key": key, "payload": value})
            else:
                key = f"{field}:" + hashlib.sha256(json.dumps(change, sort_keys=True, default=str).encode()).hexdigest()
                out.append({**base, "kind": "other", "dedupe_key": key, "payload": value})
    return out


def _resolve_event_number(ev: dict) -> Tuple[Optional[dict], Optional[str]]:
    """(number, None) when the event belongs to a configured number/WABA, else (None, reason)."""
    from app.whatsapp import numbers as number_registry
    if ev["phone_number_id"]:
        doc = number_registry.get_by_phone_number_id(ev["phone_number_id"])
        if doc and (not ev["waba_id"] or not doc.get("waba_id") or doc["waba_id"] == ev["waba_id"]):
            return doc, None
        return None, "ignored_unmapped_number"
    # Account-level events (template status, etc.) carry only the WABA ID.
    if ev["waba_id"] and number_registry.numbers_for_waba(ev["waba_id"]):
        return None, None
    return None, "ignored_other_account"


def ingest(payload: dict, signature_verified: bool, signer_wabas: Optional[set] = None) -> Dict[str, int]:
    """
    Store each event once. `signer_wabas` (from match_signature) restricts which WABAs this delivery
    may carry events for; None or {"*"} means the main app secret signed it.
    """
    stored = duplicates = ignored = 0
    now = _now()
    for ev in _split_events(payload):
        number, reason = _resolve_event_number(ev)
        if not reason and signer_wabas and "*" not in signer_wabas and ev["waba_id"] not in signer_wabas:
            reason = "ignored_signature_account_mismatch"
        belongs = reason is None
        if number:
            ev["number_id"] = str(number["_id"])
        doc = {
            **ev,
            "signature_verified": signature_verified,
            "received_at": now,
            "processed": not belongs,
            "result": None if belongs else reason,
            "attempts": 0,
            "next_attempt_at": now,
        }
        if not belongs:
            doc["expire_at"] = datetime.utcnow() + timedelta(days=RETENTION_DAYS)
            ignored += 1
        try:
            events.insert_one(doc)
            stored += 1 if belongs else 0
        except DuplicateKeyError:
            duplicates += 1
    return {"stored": stored, "duplicates": duplicates, "ignored": ignored}


# ═══════════════════════════════════════════════════════════════════
# PROCESSING
# ═══════════════════════════════════════════════════════════════════

def _claim_event(extra_filter: Optional[dict] = None) -> Optional[dict]:
    now = _now()
    query = {
        "processed": False,
        "next_attempt_at": {"$lte": now},
        "$or": [{"lease_until": {"$exists": False}}, {"lease_until": None}, {"lease_until": {"$lt": now}}],
        **(extra_filter or {}),
    }
    return events.find_one_and_update(
        query,
        {"$set": {"lease_until": (datetime.utcnow() + timedelta(seconds=60)).isoformat()}, "$inc": {"attempts": 1}},
        sort=[("received_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


def _complete(event: dict, result: str):
    events.update_one({"_id": event["_id"]}, {"$set": {
        "processed": True, "result": result, "processed_at": _now(), "lease_until": None,
        "expire_at": datetime.utcnow() + timedelta(days=RETENTION_DAYS),
    }})


def _retry_later(event: dict, result: str, error: Optional[str] = None):
    if event["attempts"] >= MAX_EVENT_ATTEMPTS:
        _complete(event, result)
        return
    delay = min(600, 15 * (2 ** (event["attempts"] - 1)))
    events.update_one({"_id": event["_id"]}, {"$set": {
        "next_attempt_at": (datetime.utcnow() + timedelta(seconds=delay)).isoformat(),
        "lease_until": None, "result": result, "last_error": error,
    }})


async def process_pending_events(wamid: Optional[str] = None, limit: int = 200):
    extra = {"wamid": wamid} if wamid else None
    for _ in range(limit):
        event = await asyncio.to_thread(_claim_event, extra)
        if not event:
            break
        try:
            if event["kind"] == "status":
                result = await apply_status_event(event["payload"], number_id=event.get("number_id"))
                if result == "no_match":
                    # The send may not have stored its wamid yet — retry for a while.
                    _retry_later(event, "no_match")
                else:
                    _complete(event, result)
            elif event["kind"] == "message":
                await _process_inbound_message(event)
                _complete(event, "stored")
            elif event["kind"] == "template_status":
                from app.whatsapp.services.template_service import apply_template_status_webhook
                _complete(event, "updated" if apply_template_status_webhook(event["payload"], waba_id=event.get("waba_id")) else "no_match")
            else:
                _complete(event, "logged")
        except Exception as e:
            logger.exception(f"[Webhook] Processing failed for event {event.get('dedupe_key')}: {e}")
            _retry_later(event, "error", f"{type(e).__name__}: {e}")


def reapply_status_events_for(wamid: str):
    """Called after a send stores its wamid, to apply status events that arrived first."""
    if events.count_documents({"wamid": wamid, "processed": False}, limit=1):
        events.update_many({"wamid": wamid, "processed": False}, {"$set": {"next_attempt_at": _now()}})
        try:
            asyncio.get_running_loop().create_task(process_pending_events(wamid=wamid))
        except RuntimeError:
            pass


async def apply_status_event(st: dict, number_id: Optional[str] = None) -> str:
    wamid = st.get("id")
    status = (st.get("status") or "").lower()
    if not wamid or not status:
        return "invalid"
    at = _ts(st.get("timestamp"))
    now = _now()

    job = jobs.find_one({"wamid": wamid}, {"_id": 1, "phone": 1, "number_id": 1})
    msg = messages.find_one({"wamid": wamid}, {"_id": 1, "number_id": 1})
    if not job and not msg:
        return "no_match"
    # A status reported for one number must never update a record that belongs to another number.
    if number_id:
        if job and job.get("number_id") and job["number_id"] != number_id:
            job = None
        if msg and msg.get("number_id") and msg["number_id"] != number_id:
            msg = None
        if not job and not msg:
            return "number_mismatch"

    error = None
    if st.get("errors"):
        e = st["errors"][0]
        error = {"code": e.get("code"), "title": e.get("title"), "message": e.get("message") or e.get("title"),
                 "details": (e.get("error_data") or {}).get("details"), "at": at, "source": "webhook",
                 "opt_out": e.get("code") in OPT_OUT_ERROR_CODES}

    rank_missing = {"status_rank": {"$exists": False}}
    applied = False

    if status in ("sent", "delivered", "read"):
        rank = STATUS_RANK[status]
        if job:
            res = jobs.update_one(
                {"_id": job["_id"], "status_rank": {"$lt": rank}, "state": {"$ne": "failed"}},
                {"$set": {"state": status, "status_rank": rank, "updated_at": now},
                 "$push": {"status_history": {"state": status, "at": at, "source": "webhook"}}},
            )
            applied |= res.modified_count > 0
            # Record the timestamp even if it arrived out of order (e.g. 'delivered' after 'read').
            jobs.update_one({"_id": job["_id"]}, {"$min": {f"{status}_at": at}})
            if st.get("pricing") or st.get("conversation"):
                jobs.update_one({"_id": job["_id"]}, {"$set": {"pricing": st.get("pricing"), "conversation": st.get("conversation")}})
        if msg:
            res = messages.update_one(
                {"_id": msg["_id"], "status": {"$ne": "failed"}, "$or": [{"status_rank": {"$lt": rank}}, rank_missing]},
                {"$set": {"status": status, "status_rank": rank, "updated_at": now}},
            )
            applied |= res.modified_count > 0
            messages.update_one({"_id": msg["_id"]}, {"$min": {f"{status}_at": at}})

    elif status == "failed":
        if job:
            res = jobs.update_one(
                {"_id": job["_id"], "status_rank": {"$lt": STATUS_RANK["delivered"]}, "state": {"$ne": "failed"}},
                {"$set": {"state": "failed", "error": error, "reason": (error or {}).get("message"), "failed_at": at, "updated_at": now},
                 "$push": {"errors": error, "status_history": {"state": "failed", "at": at, "source": "webhook"}}},
            )
            applied |= res.modified_count > 0
        if msg:
            res = messages.update_one(
                {"_id": msg["_id"], "status": {"$ne": "failed"}, "$or": [{"status_rank": {"$lt": STATUS_RANK["delivered"]}}, rank_missing]},
                {"$set": {"status": "failed", "error_message": (error or {}).get("message"), "error": error, "failed_at": at, "updated_at": now}},
            )
            applied |= res.modified_count > 0
        if error and error.get("opt_out") and job and job.get("phone"):
            from app.whatsapp.repository import DNDRepository
            DNDRepository.add_dnd_number({"phone_number": job["phone"], "reason": "User Opt-out", "source": "Meta Webhook",
                                          "notes": "Meta error 131050: user stopped marketing messages"})
    else:
        return "ignored_status"

    if applied and msg:
        try:
            from app.whatsapp.services.message_service import _broadcast_whatsapp_event
            await _broadcast_whatsapp_event("message_status_updated", {
                "message_id": str(msg["_id"]), "wamid": wamid, "status": status, "updated_at": now,
                "number_id": msg.get("number_id"),
                "error": (error or {}).get("message"),
            })
        except Exception:
            pass
    return "applied" if applied else "stale_or_duplicate"


async def _process_inbound_message(event: dict):
    from app.whatsapp.services import message_service, automation_service
    from app.whatsapp import numbers as number_registry

    number = number_registry.get_number(event.get("number_id"), include_deleted=True) if event.get("number_id") else None
    if not number:
        # Stored before the number was resolvable — never attribute it to some other number.
        number = number_registry.get_by_phone_number_id(event.get("phone_number_id"))
    if not number:
        raise RuntimeError(f"Inbound message for unconfigured phone_number_id {event.get('phone_number_id')}")

    msg = event["payload"]
    contacts = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in event.get("contacts") or []}
    sender_phone = msg.get("from", "")
    msg_type = msg.get("type", "text")
    if msg_type == "text":
        content = (msg.get("text") or {}).get("body", "")
    elif msg_type in ("image", "video", "audio", "document", "sticker"):
        content = (msg.get(msg_type) or {}).get("caption") or f"[{msg_type.upper()} Message]"
    elif msg_type == "interactive":
        inter = msg.get("interactive") or {}
        content = (inter.get("button_reply") or {}).get("title") or (inter.get("list_reply") or {}).get("title") or "[Interactive Reply]"
    elif msg_type == "button":
        content = (msg.get("button") or {}).get("text", "[Button Click]")
    elif msg_type == "reaction":
        content = (msg.get("reaction") or {}).get("emoji") or "[Reaction]"
    else:
        content = f"[{msg_type.upper()}]"

    if messages.find_one({"wamid": msg.get("id"), "direction": "inbound", "number_id": str(number["_id"])}, {"_id": 1}):
        return  # already stored (e.g. event replay after a crash mid-processing)

    saved = await message_service.process_incoming_reply(
        sender_phone=sender_phone,
        sender_name=contacts.get(sender_phone) or "WhatsApp User",
        content=content,
        message_type=msg_type,
        reply_type=msg_type,
        source="meta_webhook",
        mode="meta_cloud",
        wamid=msg.get("id"),
        metadata={"context": msg.get("context"), "timestamp": _ts(msg.get("timestamp"))},
        number=number,
    )
    if saved and msg_type != "reaction":
        asyncio.create_task(automation_service.detect_intent_and_route(saved))


# ═══════════════════════════════════════════════════════════════════
# DIAGNOSTICS
# ═══════════════════════════════════════════════════════════════════

def event_stats(number: Optional[dict] = None) -> dict:
    """Webhook health for one number (template events are counted for its WABA)."""
    scope = {"number_id": str(number["_id"])} if number else {}
    waba_scope = {"waba_id": number.get("waba_id")} if number else {}

    def last(query):
        doc = events.find_one(query, sort=[("received_at", -1)])
        return doc.get("received_at") if doc else None

    return {
        "last_event_at": last({"$or": [scope, {**waba_scope, "kind": "template_status"}]} if number else {}),
        "last_status_event_at": last({**scope, "kind": "status"}),
        "last_inbound_message_at": last({**scope, "kind": "message"}),
        "last_template_event_at": last({**waba_scope, "kind": "template_status"}),
        "pending_events": events.count_documents({**scope, "processed": False}),
        "unmatched_status_events": events.count_documents({**scope, "kind": "status", "result": "no_match"}),
        "ignored_other_account": events.count_documents({"result": {"$in": ["ignored_other_account", "ignored_signature_account_mismatch"]}}),
        "ignored_unmapped_number": events.count_documents({"result": "ignored_unmapped_number"}),
        "rejected_signatures": _rejected_signature_count,
        "last_rejected_signature_at": _last_rejected_at,
    }


_rejected_signature_count = 0
_last_rejected_at: Optional[str] = None


def record_rejected_signature():
    global _rejected_signature_count, _last_rejected_at
    _rejected_signature_count += 1
    _last_rejected_at = _now()
