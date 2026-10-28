"""
WhatsApp Automation — Automation Service
Orchestrates all automation workflows.

Business-initiated automations (welcome, follow-up, meeting, lead status, task, daily reports) send
an *approved Meta template* bound to the workflow in Settings → Automation Templates, through the
same queued send pipeline as campaigns. Each trigger has an idempotency key, so replayed events or
repeated scheduler runs never send the same message twice. Without a binding, the run is recorded
as skipped — free-form text is not sent because Meta rejects it outside the 24h service window.

Customer-initiated automations (auto reply, AI FAQ, CRM lookup, intent routing) reply with
free-form text, which is allowed inside the 24h window opened by the customer's message.

Business numbers: template bindings are configured per number (stored on the number). An ERP event runs
the automation once for every active number that has it enabled, each with its own template and its
own idempotency key. Customer-initiated replies always go out from the number the customer wrote to.
"""

import asyncio
import logging
import time
from datetime import datetime, date
from typing import Dict, Any, Optional, List

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.whatsapp.services.message_service import send_message, _broadcast_whatsapp_event
from app.whatsapp.services import n8n_service
from app.whatsapp.repository import AutomationLogRepository, _serialize_doc
from app.whatsapp.models import AutomationStatus
from app.whatsapp import numbers as number_registry
from app.whatsapp.concurrency import gather
from app.config.database import (
    crm_lead_collection,
    crm_meeting_collection,
    employee_collection,
    automation_settings_collection,
    whatsapp_automation_run_collection as runs,
    whatsapp_campaign_recipient_collection as send_jobs,
    whatsapp_template_collection,
)

logger = logging.getLogger("whatsapp.automation")

# Each run costs a few Atlas round trips; scheduled batches run this many side by side instead of
# one after another, and all database work runs off the event loop.
_BATCH_CONCURRENCY = 8
_IN_CHUNK = 1000


async def _log_automation(
    workflow_name: str,
    trigger: str,
    status: str,
    recipient: str = "",
    recipient_phone: str = "",
    message_preview: str = "",
    duration_ms: int = 0,
    error: str = None,
    metadata: dict = None,
    number_id: Optional[str] = None,
) -> dict:
    """Create an automation log entry (for one business number) and broadcast it."""
    log_data = {
        "workflow_name": workflow_name,
        "trigger": trigger,
        "status": status,
        "recipient": recipient,
        "recipient_phone": recipient_phone,
        "message_preview": message_preview[:200] if message_preview else "",
        "created_by": "system",
        "execution_duration_ms": duration_ms,
        "error_message": error,
        "metadata": metadata,
        "number_id": number_id,
    }
    log_entry = await asyncio.to_thread(AutomationLogRepository.create, log_data)
    await _broadcast_whatsapp_event("automation_log_created", log_entry)
    return log_entry


# ═══════════════════════════════════════════════════════════════════
# WORKFLOW REGISTRY & TEMPLATE BINDINGS
# ═══════════════════════════════════════════════════════════════════

WORKFLOWS: Dict[str, Dict[str, Any]] = {
    "welcome_message": {
        "label": "Welcome Message",
        "trigger": "New CRM lead created",
        "fields": ["name", "first_name", "phone", "email", "project_type", "assigned_to", "lead_source", "status"],
    },
    "followup_reminder": {
        "label": "Follow-up Reminder",
        "trigger": "Scheduled — active leads, at most once per lead per week",
        "fields": ["name", "first_name", "phone", "email", "project_type", "assigned_to", "status"],
    },
    "meeting_reminder": {
        "label": "Meeting Reminder",
        "trigger": "Scheduled — meetings scheduled for today, once per meeting",
        "fields": ["name", "first_name", "phone", "meeting_date", "meeting_time", "meeting_location", "assigned_to"],
    },
    "lead_status_update": {
        "label": "Lead Status Update",
        "trigger": "CRM lead status changed, once per lead per status",
        "fields": ["name", "first_name", "phone", "new_status", "project_type", "assigned_to"],
    },
    "task_assigned": {
        "label": "Task Assignment Notification",
        "trigger": "Task assigned to an employee, once per task",
        "fields": ["name", "first_name", "phone", "task_title", "project_name", "priority", "deadline"],
    },
    "daily_lead_report": {
        "label": "Daily Lead Report",
        "trigger": "Scheduled daily — sent to the configured admin phone",
        "fields": ["report_date", "total_leads", "new_leads", "converted", "lost", "active"],
        "fixed_recipient": True,
    },
    "daily_reply_report": {
        "label": "Daily Customer Reply Report",
        "trigger": "Scheduled daily — sent to the configured admin phone",
        "fields": ["report_date", "total_replies", "today_replies", "unique_customers", "unread_replies"],
        "fixed_recipient": True,
    },
}


def get_bindings(number: Optional[dict] = None) -> Dict[str, Any]:
    """Template bindings of one number (legacy settings bindings only when no number exists)."""
    if number is not None:
        fresh = number_registry.get_number(str(number["_id"]), include_deleted=True) or number
        return fresh.get("automation_bindings") or {}
    settings = automation_settings_collection.find_one() or {}
    return settings.get("automation_bindings") or {}


def describe_workflows(number: Optional[dict] = None) -> List[dict]:
    from app.whatsapp.services import template_service
    bindings = get_bindings(number)
    # One query for every bound template instead of one per workflow.
    ids = {str((bindings.get(k) or {}).get("template_id")) for k in WORKFLOWS if (bindings.get(k) or {}).get("template_id")}
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    templates = {str(d["_id"]): _serialize_doc(d) for d in whatsapp_template_collection.find({"_id": {"$in": oids}})} if oids else {}
    out = []
    for key, wf in WORKFLOWS.items():
        b = bindings.get(key) or {}
        tmpl = templates.get(str(b["template_id"])) if b.get("template_id") else None
        if tmpl and not template_service.template_in_scope(tmpl, number):
            tmpl = None
        out.append({
            "key": key,
            **wf,
            "binding": b,
            "template": template_service.describe_for_sending(tmpl) if tmpl else None,
            "template_sendable": template_service.is_sendable(tmpl),
        })
    return out


def save_binding(workflow_key: str, data: dict, number: Optional[dict] = None) -> dict:
    from app.whatsapp.services import template_service
    if workflow_key not in WORKFLOWS:
        raise ValueError(f"Unknown automation '{workflow_key}'.")
    if number is None:
        raise ValueError("Select a WhatsApp business number before configuring automations.")
    enabled = bool(data.get("enabled"))
    template_id = data.get("template_id") or None
    if template_id:
        tmpl = template_service.TemplateRepository.find_by_id(template_id)
        if tmpl and not template_service.template_in_scope(tmpl, number):
            raise ValueError("That template belongs to a different WhatsApp Business Account than this number.")
    if enabled:
        tmpl = template_service.TemplateRepository.find_by_id(template_id) if template_id else None
        if not template_service.is_sendable(tmpl):
            raise ValueError("Select a template that is APPROVED on Meta before enabling this automation.")
        slots = template_service.get_send_slots(tmpl)
        mapping = data.get("variable_mapping") or {}
        unmapped = [s["label"] for s in slots if not (mapping.get(s["key"]) or {}).get("value")]
        if unmapped:
            raise ValueError("Map every template variable: " + ", ".join(unmapped))
        if WORKFLOWS[workflow_key].get("fixed_recipient"):
            from app.whatsapp.services.campaign_service import normalize_phone
            if not normalize_phone(data.get("recipient_phone") or ""):
                raise ValueError("Enter a valid admin phone number with country code for this report.")
    binding = {
        "enabled": enabled,
        "template_id": template_id,
        "variable_mapping": data.get("variable_mapping") or {},
        "recipient_phone": data.get("recipient_phone") or None,
        "updated_at": datetime.utcnow().isoformat(),
    }
    number_registry.save_bindings(str(number["_id"]), workflow_key, binding)
    return binding


def list_runs(limit: int = 100, skip: int = 0, workflow: Optional[str] = None, status: Optional[str] = None, scope: Optional[dict] = None) -> dict:
    query: Dict[str, Any] = dict(scope or {})
    if workflow:
        query["workflow"] = workflow
    if status:
        query["status"] = status
    r = gather(
        docs=lambda: [_serialize_doc(d) for d in runs.find(query).sort("created_at", -1).skip(skip).limit(limit)],
        total=lambda: runs.count_documents(query),
    )
    docs = r["docs"]
    job_ids = [ObjectId(d["job_id"]) for d in docs if d.get("job_id")]
    jobs = {str(j["_id"]): j for j in send_jobs.find({"_id": {"$in": job_ids}}, {"state": 1, "reason": 1, "error": 1, "wamid": 1})} if job_ids else {}
    for d in docs:
        j = jobs.get(d.get("job_id") or "")
        if j:
            d["message_state"] = j.get("state")
            d["message_error"] = (j.get("error") or {}).get("message") or j.get("reason")
            d["wamid"] = j.get("wamid")
    return {"runs": docs, "total": r["total"]}


def _fresh_numbers(numbers: List[dict]) -> List[dict]:
    """Current records of the given numbers in one query (a number missing from the DB is kept as given)."""
    oids = [ObjectId(str(n["_id"])) for n in numbers if ObjectId.is_valid(str(n["_id"]))]
    fresh = {str(d["_id"]): d for d in number_registry.numbers.find({"_id": {"$in": oids}})} if oids else {}
    return [fresh.get(str(n["_id"]), n) for n in numbers]


def _numbers_for(workflow_key: str, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Active numbers (of `numbers`, default all) that have this automation enabled, as current records."""
    candidates = _fresh_numbers(numbers) if numbers is not None else number_registry.all_numbers(active_only=True)
    return [n for n in candidates if ((n.get("automation_bindings") or {}).get(workflow_key) or {}).get("enabled")]


def _existing_runs(keys: List[str]) -> Dict[str, dict]:
    """Runs that already exist for these idempotency keys, so repeated batches skip them without a write."""
    found: Dict[str, dict] = {}
    for i in range(0, len(keys), _IN_CHUNK):
        for d in runs.find({"idempotency_key": {"$in": keys[i:i + _IN_CHUNK]}}):
            found[d["idempotency_key"]] = d
    return found


async def _run_all(calls: List[tuple], existing: Optional[Dict[str, dict]] = None) -> List[dict]:
    """Run (workflow_key, idempotency_key, recipient, trigger, entity_id, number) calls with bounded concurrency, in order."""
    sem = asyncio.Semaphore(_BATCH_CONCURRENCY)

    async def one(workflow_key, idempotency_key, recipient, trigger, entity_id, number):
        async with sem:
            return await run_bound_automation(workflow_key, idempotency_key, recipient, trigger, entity_id, number=number,
                                              bindings=number.get("automation_bindings") or {}, existing_runs=existing)

    return list(await asyncio.gather(*(one(*c) for c in calls)))


def _run_key(workflow_key: str, idempotency_key: str, number: dict) -> str:
    # The migrated legacy number keeps the pre-multi-number key format, so triggers that already ran
    # before the upgrade are still recognized as duplicates and are not sent again.
    if number.get("legacy"):
        return f"{workflow_key}:{idempotency_key}"
    return f"{workflow_key}:{number['_id']}:{idempotency_key}"


def _execute_run(workflow_key: str, run_key: str, recipient: dict, trigger: str, entity_id: Optional[str],
                 number: dict, bindings: Optional[dict]) -> dict:
    """Database part of one automation run (blocking; called off the event loop)."""
    from app.whatsapp.services import campaign_service
    number_id = str(number["_id"])
    wf = WORKFLOWS[workflow_key]
    now = datetime.utcnow().isoformat()
    run = {
        "workflow": workflow_key,
        "workflow_label": wf["label"],
        "trigger": trigger,
        "entity_id": entity_id,
        "number_id": number_id,
        "idempotency_key": run_key,
        "recipient_name": recipient.get("name"),
        "recipient_phone": recipient.get("phone"),
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    try:
        run["_id"] = runs.insert_one(run).inserted_id
    except DuplicateKeyError:
        existing = _serialize_doc(runs.find_one({"idempotency_key": run["idempotency_key"]}))
        existing["duplicate"] = True
        return {"duplicate": existing}

    binding = (bindings if bindings is not None else get_bindings(number)).get(workflow_key) or {}
    status, reason, job = "skipped", None, None
    if not binding.get("enabled") or not binding.get("template_id"):
        reason = "No approved template is bound to this automation (Settings → Automation Templates)."
    else:
        if wf.get("fixed_recipient"):
            recipient = {**recipient, "phone": binding.get("recipient_phone")}
        try:
            job = campaign_service.enqueue_single(
                template_id=binding["template_id"],
                mapping=binding.get("variable_mapping") or {},
                recipient=recipient,
                idempotency_key=f"automation:{run['idempotency_key']}",
                automation_run_id=str(run["_id"]),
                workflow=wf["label"],
                number=number,
            )
            if job["state"] == "queued":
                status = "queued"
            else:
                status = "skipped" if job["state"] == "skipped" else "failed"
                reason = job.get("reason")
        except ValueError as e:
            status, reason = "failed", str(e)

    runs.update_one({"_id": run["_id"]}, {"$set": {
        "status": status, "reason": reason, "job_id": str(job["_id"]) if job else None, "updated_at": datetime.utcnow().isoformat(),
    }})
    return {"run": run, "status": status, "reason": reason, "job": job, "recipient": recipient}


async def run_bound_automation(workflow_key: str, idempotency_key: str, recipient: dict, trigger: str,
                               entity_id: Optional[str] = None, number: Optional[dict] = None,
                               bindings: Optional[dict] = None, existing_runs: Optional[Dict[str, dict]] = None) -> dict:
    """
    Execute one automation trigger through the queued template pipeline, from `number`.
    `recipient` = {"name", "phone", **fields}. Returns the run record.
    `bindings` (the number's current bindings) and `existing_runs` (prefetched runs by idempotency key)
    are optional shortcuts that save database round trips in batches.
    """
    if number is None:
        raise ValueError("An automation run needs a WhatsApp business number.")
    run_key = _run_key(workflow_key, idempotency_key, number)
    if existing_runs and run_key in existing_runs:
        existing = _serialize_doc(dict(existing_runs[run_key]))
        existing["duplicate"] = True
        return existing

    out = await asyncio.to_thread(_execute_run, workflow_key, run_key, recipient, trigger, entity_id, number, bindings)
    if "duplicate" in out:
        return out["duplicate"]
    run, status, reason, job, recipient = out["run"], out["status"], out["reason"], out["job"], out["recipient"]
    await _log_automation(
        workflow_name=WORKFLOWS[workflow_key]["label"],
        trigger=trigger,
        status={"queued": AutomationStatus.PENDING.value, "skipped": AutomationStatus.SKIPPED.value}.get(status, AutomationStatus.FAILED.value),
        recipient=recipient.get("name") or "",
        recipient_phone=recipient.get("phone") or "",
        message_preview=(job or {}).get("preview") or "",
        error=reason,
        metadata={"automation_run_id": str(run["_id"]), "idempotency_key": run["idempotency_key"]},
        number_id=str(number["_id"]),
    )
    return {**_serialize_doc(run), "status": status, "reason": reason}


def _lead_fields(lead: dict) -> dict:
    name = lead.get("name") or ""
    return {
        "name": name,
        "first_name": name.split(" ")[0] if name else None,
        "phone": lead.get("phone"),
        "email": lead.get("email"),
        "project_type": lead.get("projectType"),
        "assigned_to": lead.get("assignedTo"),
        "lead_source": lead.get("leadSource"),
        "status": lead.get("status"),
    }


# ═══════════════════════════════════════════════════════════════════
# BUSINESS-INITIATED AUTOMATIONS (template based)
# ═══════════════════════════════════════════════════════════════════

async def trigger_welcome_message(lead_data: dict, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Trigger: new CRM lead created. Once per lead per number that has the automation enabled."""
    lead_id = str(lead_data.get("_id") or lead_data.get("id") or "")
    asyncio.create_task(n8n_service.trigger_welcome_workflow(lead_data))
    if not lead_id:
        return [{"status": "skipped", "reason": "Lead has no ID"}]
    targets = await asyncio.to_thread(_numbers_for, "welcome_message", numbers)
    return await _run_all([("welcome_message", f"lead:{lead_id}", _lead_fields(lead_data), "New CRM Lead Created", lead_id, n)
                           for n in targets])


def _batch_existing(calls: List[tuple]) -> Dict[str, dict]:
    return _existing_runs([_run_key(c[0], c[1], c[5]) for c in calls])


async def trigger_followup_reminders(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled: active leads, at most once per lead per ISO week (per number)."""
    targets = await asyncio.to_thread(_numbers_for, "followup_reminder", numbers)
    if not targets:
        return []
    week = date.today().strftime("%G-W%V")
    leads = await asyncio.to_thread(lambda: list(crm_lead_collection.find({"status": {"$nin": ["Converted", "Lost"]}, "phone": {"$nin": [None, ""]}})))
    calls = []
    for lead in leads:
        lead_id = str(lead["_id"])
        asyncio.create_task(n8n_service.trigger_followup_workflow({**lead, "_id": lead_id}))
        for n in targets:
            calls.append(("followup_reminder", f"lead:{lead_id}:{week}", _lead_fields(lead), "Scheduled Follow-up Check", lead_id, n))
    existing = await asyncio.to_thread(_batch_existing, calls)
    return await _run_all(calls, existing)


async def trigger_meeting_reminders(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled: meetings scheduled for today. Once per meeting (per number)."""
    targets = await asyncio.to_thread(_numbers_for, "meeting_reminder", numbers)
    if not targets:
        return []
    today_str = date.today().isoformat()
    meetings = await asyncio.to_thread(lambda: list(crm_meeting_collection.find({"date": today_str, "status": {"$in": ["Scheduled", "scheduled"]}})))
    calls = []
    for mtg in meetings:
        mtg_id = str(mtg["_id"])
        name = mtg.get("clientName") or ""
        recipient = {
            "name": name,
            "first_name": name.split(" ")[0] if name else None,
            "phone": mtg.get("phone"),
            "meeting_date": mtg.get("date"),
            "meeting_time": mtg.get("time"),
            "meeting_location": mtg.get("location"),
            "assigned_to": ", ".join(mtg.get("attendees") or []) or None,
        }
        asyncio.create_task(n8n_service.trigger_meeting_reminder_workflow({**mtg, "_id": mtg_id}))
        for n in targets:
            calls.append(("meeting_reminder", f"meeting:{mtg_id}", recipient, "Scheduled Meeting Check", mtg_id, n))
    existing = await asyncio.to_thread(_batch_existing, calls)
    return await _run_all(calls, existing)


async def trigger_lead_status_update(lead_data: dict, new_status: str, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Trigger: lead status changed. Once per lead per status (per number)."""
    lead_id = str(lead_data.get("_id") or lead_data.get("id") or "")
    asyncio.create_task(n8n_service.trigger_lead_status_workflow({**lead_data, "_id": lead_id}, new_status))
    recipient = {**_lead_fields(lead_data), "new_status": new_status}
    targets = await asyncio.to_thread(_numbers_for, "lead_status_update", numbers)
    return await _run_all([("lead_status_update", f"lead:{lead_id}:{new_status}", recipient, f"Status → {new_status}", lead_id, n)
                           for n in targets])


def _task_employee(task_data: dict) -> Optional[dict]:
    employee = None
    emp_id = task_data.get("employee_id")
    if emp_id and ObjectId.is_valid(str(emp_id)):
        employee = employee_collection.find_one({"_id": ObjectId(str(emp_id))})
    if not employee and task_data.get("employee"):
        employee = employee_collection.find_one({"name": task_data["employee"]})
    return employee


async def trigger_task_assignment_notification(task_data: dict, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Trigger: task assigned. Once per task (per number). Phone comes from the employee record."""
    task_id = str(task_data.get("_id") or task_data.get("id") or "")
    asyncio.create_task(n8n_service.trigger_task_assignment_workflow(task_data))
    r = await asyncio.to_thread(gather,
                                employee=lambda: _task_employee(task_data),
                                targets=lambda: _numbers_for("task_assigned", numbers))
    employee = r["employee"]
    name = (employee or {}).get("name") or task_data.get("employee_name") or task_data.get("employee") or ""
    recipient = {
        "name": name,
        "first_name": name.split(" ")[0] if name else None,
        "phone": (employee or {}).get("phone") or (employee or {}).get("mobile"),
        "task_title": task_data.get("title"),
        "project_name": task_data.get("project"),
        "priority": task_data.get("priority"),
        "deadline": task_data.get("deadline"),
    }
    return await _run_all([("task_assigned", f"task:{task_id}", recipient, "Task Assigned", task_id, n) for n in r["targets"]])


async def trigger_daily_lead_report(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled daily: CRM lead summary to the admin phone configured on each number's binding."""
    targets = await asyncio.to_thread(_numbers_for, "daily_lead_report", numbers)
    if not targets:
        return []
    today_str = date.today().isoformat()
    c = await asyncio.to_thread(gather,
                                total=lambda: crm_lead_collection.count_documents({}),
                                converted=lambda: crm_lead_collection.count_documents({"status": "Converted"}),
                                lost=lambda: crm_lead_collection.count_documents({"status": "Lost"}),
                                new_leads=lambda: crm_lead_collection.count_documents({"date": today_str}))
    total, converted, lost = c["total"], c["converted"], c["lost"]
    recipient = {
        "name": "Admin",
        "report_date": today_str,
        "total_leads": total,
        "new_leads": c["new_leads"],
        "converted": converted,
        "lost": lost,
        "active": total - converted - lost,
    }
    return await _run_all([("daily_lead_report", today_str, recipient, "Scheduled Daily", today_str, n) for n in targets])


async def trigger_daily_reply_report(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled daily: each number's own customer reply summary to the admin phone on its binding."""
    from app.whatsapp.repository import MessageRepository
    today_str = date.today().isoformat()
    targets = await asyncio.to_thread(_numbers_for, "daily_reply_report", numbers)
    stats = await asyncio.gather(*(asyncio.to_thread(MessageRepository.get_reply_stats, {"number_id": str(n["_id"])}) for n in targets))
    return await _run_all([("daily_reply_report", today_str, {"name": "Admin", "report_date": today_str, **st}, "Scheduled Daily", today_str, n)
                           for n, st in zip(targets, stats)])


def _incoming_number(incoming_message: dict) -> Optional[dict]:
    """The business number that received the customer's message (replies must go out from it)."""
    nid = incoming_message.get("number_id")
    return number_registry.get_number(nid, include_deleted=True) if nid else None


# ═══════════════════════════════════════════════════════════════════
# CUSTOM AUTO-REPLY (per number, Settings → Customer Reply Auto-Reply)
# ═══════════════════════════════════════════════════════════════════
# When enabled, customer messages that match no keyword route (e.g. "YES" in reply to a template)
# get this fixed text instead of the AI FAQ bot answer. Disabled → the AI bot answers, as before.

# Sender names stored when WhatsApp gave no profile name; greeting them by it would read oddly.
_UNKNOWN_SENDER_NAMES = {"", "whatsapp user", "customer", "contact"}


def get_customer_auto_reply(number: Optional[dict]) -> dict:
    config = (number or {}).get("customer_auto_reply") or {}
    return {
        "enabled": bool(config.get("enabled")),
        "message": config.get("message") or "",
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by"),
    }


def save_customer_auto_reply(data: dict, number: Optional[dict], user: Optional[str] = None) -> dict:
    if number is None:
        raise ValueError("Select a WhatsApp business number before configuring the auto-reply.")
    message = (data.get("message") or "").strip()
    enabled = bool(data.get("enabled"))
    if enabled and not message:
        raise ValueError("Enter the auto-reply message before enabling it.")
    config = {
        "enabled": enabled,
        "message": message,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user,
    }
    number_registry.save_customer_auto_reply(str(number["_id"]), config)
    return config


def render_customer_auto_reply(message: str, sender_name: Optional[str]) -> str:
    name = (sender_name or "").strip()
    if name.lower() in _UNKNOWN_SENDER_NAMES:
        name = ""
    # Plain replace, not str.format: the admin's text may contain other braces.
    return (message
            .replace("{first_name}", name.split(" ")[0] if name else "there")
            .replace("{name}", name or "there"))


async def trigger_custom_auto_reply(incoming_message: dict, number: dict, message_text: str) -> Optional[dict]:
    """Reply with the number's custom auto-reply text (free-form, inside the 24h window)."""
    start_time = time.time()
    sender_phone = incoming_message.get("sender_phone", "")
    sender_name = incoming_message.get("sender", "Customer")
    reply_content = render_customer_auto_reply(message_text, sender_name)

    message = await send_message(
        recipient_phone=sender_phone,
        content=reply_content,
        recipient_name=sender_name,
        automation_workflow="Custom Auto Reply",
        number=number,
        metadata={"trigger": "custom_auto_reply", "original_message_id": incoming_message.get("_id", "")},
    )

    await _log_automation(
        workflow_name="Custom Auto Reply",
        trigger="Incoming Message",
        status=AutomationStatus.SUCCESS.value,
        recipient=sender_name,
        recipient_phone=sender_phone,
        message_preview=reply_content,
        duration_ms=int((time.time() - start_time) * 1000),
        number_id=incoming_message.get("number_id"),
    )
    return message


# ═══════════════════════════════════════════════════════════════════
# CUSTOMER-INITIATED AUTOMATIONS (free-form replies inside the 24h window)
# ═══════════════════════════════════════════════════════════════════

async def trigger_auto_reply(incoming_message: dict) -> Optional[dict]:
    """
    Phase 2 — Auto Reply
    Automatically reply to incoming messages with a standard acknowledgment.
    """
    start_time = time.time()
    
    sender_phone = incoming_message.get("sender_phone", "")
    sender_name = incoming_message.get("sender", "Customer")
    
    reply_content = (
        f"Hi {sender_name}! 👋\n\n"
        "Thank you for your message. Our team has received it and will respond shortly.\n\n"
        "If you need immediate assistance, please call us at our helpline.\n\n"
        "— DelegateX Automated Assistant"
    )
    
    message = await send_message(
        recipient_phone=sender_phone,
        content=reply_content,
        recipient_name=sender_name,
        automation_workflow="Auto Reply",
        number=await asyncio.to_thread(_incoming_number, incoming_message),
        metadata={"trigger": "auto_reply", "original_message_id": incoming_message.get("_id", "")},
    )
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name="Auto Reply",
        trigger="Incoming Message",
        status=AutomationStatus.SUCCESS.value,
        recipient=sender_name,
        recipient_phone=sender_phone,
        message_preview=reply_content,
        duration_ms=duration_ms,
        number_id=incoming_message.get("number_id"),
    )
    
    return message



async def trigger_ai_faq_bot(incoming_message: dict) -> Optional[dict]:
    """
    Phase 3 — AI FAQ Bot
    Uses existing Gemini + RAG to answer questions via WhatsApp.
    """
    start_time = time.time()
    sender_phone = incoming_message.get("sender_phone", "")
    sender_name = incoming_message.get("sender", "Customer")
    query = incoming_message.get("content", "")
    
    try:
        from app.chatbot.service import ChatbotService
        # The LLM call blocks for seconds; run it off the event loop so other requests keep flowing.
        answer = await asyncio.to_thread(lambda: ChatbotService().answer_question(
            query=query,
            user_email="admin@delegatex.com",
            user_role="Administrator"
        ))
        
        reply_content = (
            f"🤖 *DelegateX AI Assistant*\n\n"
            f"{answer}\n\n"
            f"_This is an automated AI response. Reply 'AGENT' to connect with a human._"
        )
        
    except Exception as e:
        logger.error(f"[AI FAQ Bot] Error: {e}")
        reply_content = (
            f"Sorry, I couldn't process your query at the moment.\n"
            f"Please try again or reply 'AGENT' for human assistance.\n\n"
            f"— DelegateX AI"
        )
    
    message = await send_message(
        recipient_phone=sender_phone,
        content=reply_content,
        recipient_name=sender_name,
        automation_workflow="AI FAQ Bot",
        number=await asyncio.to_thread(_incoming_number, incoming_message),
        metadata={"trigger": "ai_faq", "query": query},
    )
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name="AI FAQ Bot",
        trigger="Incoming Message (AI)",
        status=AutomationStatus.SUCCESS.value,
        recipient=sender_name,
        recipient_phone=sender_phone,
        message_preview=reply_content[:200],
        duration_ms=duration_ms,
        number_id=incoming_message.get("number_id"),
    )
    
    return message


async def trigger_crm_lookup(incoming_message: dict) -> Optional[dict]:
    """
    Phase 3 — CRM Lookup
    Allows AI to answer using live CRM data.
    """
    start_time = time.time()
    sender_phone = incoming_message.get("sender_phone", "")
    sender_name = incoming_message.get("sender", "Customer")
    
    # Look up lead by phone number
    lead = await asyncio.to_thread(crm_lead_collection.find_one, {"phone": sender_phone})
    
    if lead:
        lead_info = (
            f"📋 *Your CRM Profile*\n\n"
            f"👤 Name: {lead.get('name', 'N/A')}\n"
            f"📧 Email: {lead.get('email', 'N/A')}\n"
            f"📱 Phone: {lead.get('phone', 'N/A')}\n"
            f"📊 Status: {lead.get('status', 'N/A')}\n"
            f"🏗 Project: {lead.get('projectType', 'N/A')}\n"
            f"👤 Assigned: {lead.get('assignedTo', 'N/A')}\n\n"
            f"— DelegateX CRM"
        )
    else:
        lead_info = (
            f"We couldn't find a CRM profile linked to your phone number.\n"
            f"Please contact us to register your enquiry.\n\n"
            f"— DelegateX CRM"
        )
    
    message = await send_message(
        recipient_phone=sender_phone,
        content=lead_info,
        recipient_name=sender_name,
        automation_workflow="CRM Lookup",
        number=await asyncio.to_thread(_incoming_number, incoming_message),
        metadata={"trigger": "crm_lookup", "lead_found": lead is not None},
    )
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name="CRM Lookup",
        trigger="CRM Data Request",
        status=AutomationStatus.SUCCESS.value,
        recipient=sender_name,
        recipient_phone=sender_phone,
        message_preview=lead_info[:200],
        duration_ms=duration_ms,
        number_id=incoming_message.get("number_id"),
    )
    
    return message


async def detect_intent_and_route(incoming_message: dict) -> Optional[dict]:
    """
    Phase 3 — AI Intent Detection
    Automatically detect user intent and route to the appropriate handler.
    """
    content = incoming_message.get("content", "").lower().strip()
    
    # Intent detection rules
    if "test" in content:
        reply = "WhatsApp automation is working."
        sender_phone = incoming_message.get("sender_phone", "")
        sender_name = incoming_message.get("sender", "Customer")
        
        message = await send_message(
            recipient_phone=sender_phone,
            content=reply,
            recipient_name=sender_name,
            automation_workflow="Webhook Test Automation",
            number=await asyncio.to_thread(_incoming_number, incoming_message),
            metadata={"trigger": "webhook_test", "original_content": incoming_message.get("content")},
        )
        
        await _log_automation(
            workflow_name="Webhook Test Automation",
            trigger="Incoming WhatsApp Message ('TEST')",
            status=AutomationStatus.SUCCESS.value,
            recipient=sender_name,
            recipient_phone=sender_phone,
            message_preview=reply,
            duration_ms=10,
            number_id=incoming_message.get("number_id"),
        )
        return message

    elif any(keyword in content for keyword in ["status", "enquiry", "profile", "my details", "lookup"]):
        return await trigger_crm_lookup(incoming_message)
    
    elif any(keyword in content for keyword in ["meeting", "schedule", "appointment", "book"]):
        # Provide meeting information
        reply = (
            "📅 To schedule a meeting, please contact your assigned consultant "
            "or visit our CRM dashboard.\n\n"
            "Reply 'STATUS' to check your current enquiry status.\n\n"
            "— DelegateX"
        )
        return await send_message(
            recipient_phone=incoming_message.get("sender_phone", ""),
            content=reply,
            recipient_name=incoming_message.get("sender", "Customer"),
            automation_workflow="Intent Detection",
            number=await asyncio.to_thread(_incoming_number, incoming_message),
        )
    
    elif content == "agent" or "human" in content or "help" in content:
        reply = (
            "🙋 Connecting you with a human agent...\n\n"
            "Our team has been notified and will respond shortly.\n\n"
            "— DelegateX"
        )
        return await send_message(
            recipient_phone=incoming_message.get("sender_phone", ""),
            content=reply,
            recipient_name=incoming_message.get("sender", "Customer"),
            automation_workflow="Intent Detection — Agent Handoff",
            number=await asyncio.to_thread(_incoming_number, incoming_message),
        )
    
    else:
        # Default: the number's custom auto-reply when enabled, otherwise the AI FAQ bot
        number = await asyncio.to_thread(_incoming_number, incoming_message)
        auto_reply = get_customer_auto_reply(number)
        if number and auto_reply["enabled"] and auto_reply["message"]:
            return await trigger_custom_auto_reply(incoming_message, number, auto_reply["message"])
        return await trigger_ai_faq_bot(incoming_message)

