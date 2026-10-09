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
from app.config.database import (
    crm_lead_collection,
    crm_meeting_collection,
    employee_collection,
    automation_settings_collection,
    whatsapp_automation_run_collection as runs,
    whatsapp_campaign_recipient_collection as send_jobs,
)

logger = logging.getLogger("whatsapp.automation")


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
    log_entry = AutomationLogRepository.create(log_data)
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
    out = []
    for key, wf in WORKFLOWS.items():
        b = bindings.get(key) or {}
        tmpl = template_service.TemplateRepository.find_by_id(b["template_id"]) if b.get("template_id") else None
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
    docs = [_serialize_doc(d) for d in runs.find(query).sort("created_at", -1).skip(skip).limit(limit)]
    job_ids = [ObjectId(d["job_id"]) for d in docs if d.get("job_id")]
    jobs = {str(j["_id"]): j for j in send_jobs.find({"_id": {"$in": job_ids}}, {"state": 1, "reason": 1, "error": 1, "wamid": 1})}
    for d in docs:
        j = jobs.get(d.get("job_id") or "")
        if j:
            d["message_state"] = j.get("state")
            d["message_error"] = (j.get("error") or {}).get("message") or j.get("reason")
            d["wamid"] = j.get("wamid")
    return {"runs": docs, "total": runs.count_documents(query)}


def _numbers_for(workflow_key: str, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Active numbers (of `numbers`, default all) that have this automation enabled."""
    candidates = numbers if numbers is not None else number_registry.all_numbers(active_only=True)
    return [n for n in candidates if (get_bindings(n).get(workflow_key) or {}).get("enabled")]


def _run_key(workflow_key: str, idempotency_key: str, number: dict) -> str:
    # The migrated legacy number keeps the pre-multi-number key format, so triggers that already ran
    # before the upgrade are still recognized as duplicates and are not sent again.
    if number.get("legacy"):
        return f"{workflow_key}:{idempotency_key}"
    return f"{workflow_key}:{number['_id']}:{idempotency_key}"


async def run_bound_automation(workflow_key: str, idempotency_key: str, recipient: dict, trigger: str,
                               entity_id: Optional[str] = None, number: Optional[dict] = None) -> dict:
    """
    Execute one automation trigger through the queued template pipeline, from `number`.
    `recipient` = {"name", "phone", **fields}. Returns the run record.
    """
    from app.whatsapp.services import campaign_service
    if number is None:
        raise ValueError("An automation run needs a WhatsApp business number.")
    number_id = str(number["_id"])
    wf = WORKFLOWS[workflow_key]
    now = datetime.utcnow().isoformat()
    run = {
        "workflow": workflow_key,
        "workflow_label": wf["label"],
        "trigger": trigger,
        "entity_id": entity_id,
        "number_id": number_id,
        "idempotency_key": _run_key(workflow_key, idempotency_key, number),
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
        return existing

    binding = get_bindings(number).get(workflow_key) or {}
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
    await _log_automation(
        workflow_name=wf["label"],
        trigger=trigger,
        status={"queued": AutomationStatus.PENDING.value, "skipped": AutomationStatus.SKIPPED.value}.get(status, AutomationStatus.FAILED.value),
        recipient=recipient.get("name") or "",
        recipient_phone=recipient.get("phone") or "",
        message_preview=(job or {}).get("preview") or "",
        error=reason,
        metadata={"automation_run_id": str(run["_id"]), "idempotency_key": run["idempotency_key"]},
        number_id=number_id,
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
    return [await run_bound_automation("welcome_message", f"lead:{lead_id}", _lead_fields(lead_data), "New CRM Lead Created", lead_id, number=n)
            for n in _numbers_for("welcome_message", numbers)]


async def trigger_followup_reminders(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled: active leads, at most once per lead per ISO week (per number)."""
    targets = _numbers_for("followup_reminder", numbers)
    if not targets:
        return []
    week = date.today().strftime("%G-W%V")
    results = []
    for lead in crm_lead_collection.find({"status": {"$nin": ["Converted", "Lost"]}, "phone": {"$nin": [None, ""]}}):
        lead_id = str(lead["_id"])
        asyncio.create_task(n8n_service.trigger_followup_workflow({**lead, "_id": lead_id}))
        for n in targets:
            results.append(await run_bound_automation("followup_reminder", f"lead:{lead_id}:{week}", _lead_fields(lead), "Scheduled Follow-up Check", lead_id, number=n))
    return results


async def trigger_meeting_reminders(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled: meetings scheduled for today. Once per meeting (per number)."""
    targets = _numbers_for("meeting_reminder", numbers)
    if not targets:
        return []
    today_str = date.today().isoformat()
    results = []
    for mtg in crm_meeting_collection.find({"date": today_str, "status": {"$in": ["Scheduled", "scheduled"]}}):
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
            results.append(await run_bound_automation("meeting_reminder", f"meeting:{mtg_id}", recipient, "Scheduled Meeting Check", mtg_id, number=n))
    return results


async def trigger_lead_status_update(lead_data: dict, new_status: str, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Trigger: lead status changed. Once per lead per status (per number)."""
    lead_id = str(lead_data.get("_id") or lead_data.get("id") or "")
    asyncio.create_task(n8n_service.trigger_lead_status_workflow({**lead_data, "_id": lead_id}, new_status))
    recipient = {**_lead_fields(lead_data), "new_status": new_status}
    return [await run_bound_automation("lead_status_update", f"lead:{lead_id}:{new_status}", recipient, f"Status → {new_status}", lead_id, number=n)
            for n in _numbers_for("lead_status_update", numbers)]


async def trigger_task_assignment_notification(task_data: dict, numbers: Optional[List[dict]] = None) -> List[dict]:
    """Trigger: task assigned. Once per task (per number). Phone comes from the employee record."""
    task_id = str(task_data.get("_id") or task_data.get("id") or "")
    asyncio.create_task(n8n_service.trigger_task_assignment_workflow(task_data))
    employee = None
    emp_id = task_data.get("employee_id")
    if emp_id and ObjectId.is_valid(str(emp_id)):
        employee = employee_collection.find_one({"_id": ObjectId(str(emp_id))})
    if not employee and task_data.get("employee"):
        employee = employee_collection.find_one({"name": task_data["employee"]})
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
    return [await run_bound_automation("task_assigned", f"task:{task_id}", recipient, "Task Assigned", task_id, number=n)
            for n in _numbers_for("task_assigned", numbers)]


async def trigger_daily_lead_report(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled daily: CRM lead summary to the admin phone configured on each number's binding."""
    targets = _numbers_for("daily_lead_report", numbers)
    if not targets:
        return []
    today_str = date.today().isoformat()
    total = crm_lead_collection.count_documents({})
    converted = crm_lead_collection.count_documents({"status": "Converted"})
    lost = crm_lead_collection.count_documents({"status": "Lost"})
    recipient = {
        "name": "Admin",
        "report_date": today_str,
        "total_leads": total,
        "new_leads": crm_lead_collection.count_documents({"date": today_str}),
        "converted": converted,
        "lost": lost,
        "active": total - converted - lost,
    }
    return [await run_bound_automation("daily_lead_report", today_str, recipient, "Scheduled Daily", today_str, number=n) for n in targets]


async def trigger_daily_reply_report(numbers: Optional[List[dict]] = None) -> List[dict]:
    """Scheduled daily: each number's own customer reply summary to the admin phone on its binding."""
    from app.whatsapp.repository import MessageRepository
    today_str = date.today().isoformat()
    results = []
    for n in _numbers_for("daily_reply_report", numbers):
        stats = MessageRepository.get_reply_stats({"number_id": str(n["_id"])})
        recipient = {"name": "Admin", "report_date": today_str, **stats}
        results.append(await run_bound_automation("daily_reply_report", today_str, recipient, "Scheduled Daily", today_str, number=n))
    return results


def _incoming_number(incoming_message: dict) -> Optional[dict]:
    """The business number that received the customer's message (replies must go out from it)."""
    nid = incoming_message.get("number_id")
    return number_registry.get_number(nid, include_deleted=True) if nid else None


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
        number=_incoming_number(incoming_message),
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
        chatbot = ChatbotService()
        answer = chatbot.answer_question(
            query=query,
            user_email="admin@delegatex.com",
            user_role="Administrator"
        )
        
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
        number=_incoming_number(incoming_message),
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
    lead = crm_lead_collection.find_one({"phone": sender_phone})
    
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
        number=_incoming_number(incoming_message),
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
            number=_incoming_number(incoming_message),
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
            number=_incoming_number(incoming_message),
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
            number=_incoming_number(incoming_message),
        )
    
    else:
        # Default: route to AI FAQ bot
        return await trigger_ai_faq_bot(incoming_message)

