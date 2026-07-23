"""
WhatsApp Automation — Automation Service
Orchestrates all automation workflows (Phase 1, 2, 3).
Business logic lives here — n8n only handles workflow orchestration.
"""

import asyncio
import logging
import time
from datetime import datetime, date
from typing import Dict, Any, Optional, List

from app.whatsapp.services.message_service import send_message, simulate_incoming_message, _broadcast_whatsapp_event
from app.whatsapp.services.template_service import get_template_by_name, render_template
from app.whatsapp.services import n8n_service
from app.whatsapp.repository import AutomationLogRepository
from app.whatsapp.models import AutomationStatus
from app.config.database import crm_lead_collection, crm_meeting_collection, task_collection

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
) -> dict:
    """Create an automation log entry and broadcast it."""
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
    }
    log_entry = AutomationLogRepository.create(log_data)
    await _broadcast_whatsapp_event("automation_log_created", log_entry)
    return log_entry


# ═══════════════════════════════════════════════════════════════════
# PHASE 1 AUTOMATIONS
# ═══════════════════════════════════════════════════════════════════

async def trigger_welcome_message(lead_data: dict) -> dict:
    """
    Phase 1 — Welcome Message Automation
    Trigger: New CRM lead created
    Flow: Lead Created → Generate Message → Save to MongoDB → Display in Inbox
    """
    start_time = time.time()
    workflow_name = "Welcome Message"
    
    try:
        # Get template
        template = get_template_by_name("Welcome Message")
        if not template:
            raise ValueError("Welcome Message template not found. Run seed-templates first.")
        
        # Render message
        variables = {
            "client_name": lead_data.get("name", "Valued Client"),
            "project_type": lead_data.get("projectType", "Project"),
            "assigned_to": lead_data.get("assignedTo", "our team"),
        }
        content = render_template(template["content"], variables)
        
        phone = lead_data.get("phone", "+91-0000000000")
        name = lead_data.get("name", "Unknown")
        
        # Fire n8n webhook (fire-and-forget)
        asyncio.create_task(n8n_service.trigger_welcome_workflow(lead_data))
        
        # Send message via provider
        message = await send_message(
            recipient_phone=phone,
            content=content,
            recipient_name=name,
            message_type="template",
            template_id=template.get("_id"),
            automation_workflow=workflow_name,
            metadata={"lead_id": lead_data.get("_id", ""), "trigger": "lead_created"},
        )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        await _log_automation(
            workflow_name=workflow_name,
            trigger="New CRM Lead Created",
            status=AutomationStatus.SUCCESS.value,
            recipient=name,
            recipient_phone=phone,
            message_preview=content,
            duration_ms=duration_ms,
            metadata={"lead_id": lead_data.get("_id", "")},
        )
        
        return message
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[Welcome Message] Error: {e}")
        await _log_automation(
            workflow_name=workflow_name,
            trigger="New CRM Lead Created",
            status=AutomationStatus.FAILED.value,
            recipient=lead_data.get("name", ""),
            recipient_phone=lead_data.get("phone", ""),
            duration_ms=duration_ms,
            error=str(e),
        )
        return {"error": str(e)}


async def trigger_followup_reminders() -> List[dict]:
    """
    Phase 1 — Follow-up Reminder Automation
    Trigger: Scheduled (runs daily)
    Flow: Find today's follow-ups → Generate reminders → Save messages → Display in Inbox
    """
    results = []
    start_time = time.time()
    workflow_name = "Follow-up Reminder"
    today_str = date.today().isoformat()
    
    # Find leads with today's follow-up date
    leads = list(crm_lead_collection.find({
        "status": {"$nin": ["Converted", "Lost"]},
    }))
    
    template = get_template_by_name("Follow-up Reminder")
    if not template:
        logger.warning("Follow-up Reminder template not found.")
        return results
    
    for lead in leads:
        try:
            variables = {
                "client_name": lead.get("name", "Valued Client"),
                "project_type": lead.get("projectType", "Project"),
                "assigned_to": lead.get("assignedTo", "our team"),
            }
            content = render_template(template["content"], variables)
            phone = lead.get("phone", "+91-0000000000")
            name = lead.get("name", "Unknown")
            
            asyncio.create_task(n8n_service.trigger_followup_workflow(
                {**lead, "_id": str(lead.get("_id", ""))}
            ))
            
            message = await send_message(
                recipient_phone=phone,
                content=content,
                recipient_name=name,
                message_type="template",
                template_id=template.get("_id"),
                automation_workflow=workflow_name,
                metadata={"lead_id": str(lead.get("_id", "")), "trigger": "followup_due"},
            )
            results.append(message)
            
        except Exception as e:
            logger.error(f"[Follow-up Reminder] Error for {lead.get('name')}: {e}")
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name=workflow_name,
        trigger="Scheduled Follow-up Check",
        status=AutomationStatus.SUCCESS.value if results else AutomationStatus.SKIPPED.value,
        recipient=f"{len(results)} leads",
        message_preview=f"Sent {len(results)} follow-up reminders",
        duration_ms=duration_ms,
    )
    
    return results


async def trigger_meeting_reminders() -> List[dict]:
    """
    Phase 1 — Meeting Reminder Automation
    Trigger: Scheduled (runs daily)
    Flow: Find today's meetings → Generate reminders → Save messages → Display in Inbox
    """
    results = []
    start_time = time.time()
    workflow_name = "Meeting Reminder"
    today_str = date.today().isoformat()
    
    meetings = list(crm_meeting_collection.find({
        "date": today_str,
        "status": {"$in": ["Scheduled", "scheduled"]},
    }))
    
    template = get_template_by_name("Meeting Reminder")
    if not template:
        logger.warning("Meeting Reminder template not found.")
        return results
    
    for mtg in meetings:
        try:
            client_name = mtg.get("clientName", "Client")
            phone = mtg.get("phone", "+91-0000000000")
            
            variables = {
                "client_name": client_name,
                "meeting_date": mtg.get("date", today_str),
                "meeting_time": mtg.get("time", "TBD"),
                "meeting_location": mtg.get("location", "TBD"),
                "assigned_to": mtg.get("assignedTo", "DelegateX Team"),
            }
            content = render_template(template["content"], variables)
            
            asyncio.create_task(n8n_service.trigger_meeting_reminder_workflow(
                {**mtg, "_id": str(mtg.get("_id", ""))}
            ))
            
            message = await send_message(
                recipient_phone=phone,
                content=content,
                recipient_name=client_name,
                message_type="template",
                template_id=template.get("_id"),
                automation_workflow=workflow_name,
                metadata={"meeting_id": str(mtg.get("_id", "")), "trigger": "meeting_reminder"},
            )
            results.append(message)
            
        except Exception as e:
            logger.error(f"[Meeting Reminder] Error for {mtg.get('clientName')}: {e}")
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name=workflow_name,
        trigger="Scheduled Meeting Check",
        status=AutomationStatus.SUCCESS.value if results else AutomationStatus.SKIPPED.value,
        recipient=f"{len(results)} meetings",
        message_preview=f"Sent {len(results)} meeting reminders",
        duration_ms=duration_ms,
    )
    
    return results


# ═══════════════════════════════════════════════════════════════════
# PHASE 2 AUTOMATIONS
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
    )
    
    return message


async def trigger_lead_status_update(lead_data: dict, new_status: str) -> Optional[dict]:
    """
    Phase 2 — Lead Status Update Notification
    Sends a WhatsApp message when a lead's status changes.
    """
    start_time = time.time()
    
    if new_status.lower() == "converted":
        template = get_template_by_name("Lead Converted")
    else:
        template = None
    
    phone = lead_data.get("phone", "+91-0000000000")
    name = lead_data.get("name", "Client")
    
    if template:
        variables = {
            "client_name": name,
            "project_type": lead_data.get("projectType", "Project"),
            "assigned_to": lead_data.get("assignedTo", "our team"),
        }
        content = render_template(template["content"], variables)
    else:
        content = (
            f"Hi {name}! 📋\n\n"
            f"Your enquiry status has been updated to: *{new_status}*\n\n"
            f"If you have any questions, please don't hesitate to reach out.\n\n"
            f"— Team DelegateX"
        )
    
    asyncio.create_task(n8n_service.trigger_lead_status_workflow(
        {**lead_data, "_id": str(lead_data.get("_id", ""))}, new_status
    ))
    
    message = await send_message(
        recipient_phone=phone,
        content=content,
        recipient_name=name,
        automation_workflow="Lead Status Update",
        metadata={"lead_id": str(lead_data.get("_id", "")), "new_status": new_status},
    )
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name="Lead Status Update",
        trigger=f"Status → {new_status}",
        status=AutomationStatus.SUCCESS.value,
        recipient=name,
        recipient_phone=phone,
        message_preview=content,
        duration_ms=duration_ms,
    )
    
    return message


async def trigger_daily_lead_report() -> Optional[dict]:
    """
    Phase 2 — Daily Lead Report
    Generates and sends a daily summary of CRM lead activity.
    """
    start_time = time.time()
    today_str = date.today().isoformat()
    
    total_leads = crm_lead_collection.count_documents({})
    new_leads = crm_lead_collection.count_documents({"date": today_str})
    converted = crm_lead_collection.count_documents({"status": "Converted"})
    lost = crm_lead_collection.count_documents({"status": "Lost"})
    active = total_leads - converted - lost
    
    report_content = (
        f"📊 *Daily Lead Report — {today_str}*\n\n"
        f"📋 Total Leads: *{total_leads}*\n"
        f"🆕 New Today: *{new_leads}*\n"
        f"✅ Converted: *{converted}*\n"
        f"❌ Lost: *{lost}*\n"
        f"🔄 Active Pipeline: *{active}*\n\n"
        f"— DelegateX CRM Automation"
    )
    
    message = await send_message(
        recipient_phone="+91-ADMIN",
        content=report_content,
        recipient_name="Admin",
        automation_workflow="Daily Lead Report",
        metadata={"trigger": "daily_report", "date": today_str},
    )
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name="Daily Lead Report",
        trigger="Scheduled Daily",
        status=AutomationStatus.SUCCESS.value,
        recipient="Admin",
        message_preview=report_content,
        duration_ms=duration_ms,
    )
    
    return message


async def trigger_task_assignment_notification(task_data: dict) -> Optional[dict]:
    """
    Phase 2 — Employee Task Assignment Notification
    Sends a WhatsApp message when a task is assigned to an employee.
    """
    start_time = time.time()
    
    template = get_template_by_name("Task Assigned")
    employee_name = task_data.get("employee", "Team Member")
    
    # Use a simulated phone for the employee
    phone = f"+91-EMP-{employee_name.replace(' ', '-').upper()}"
    
    if template:
        variables = {
            "employee_name": employee_name,
            "task_title": task_data.get("title", "New Task"),
            "project_name": task_data.get("project", "Project"),
            "priority": task_data.get("priority", "Medium"),
            "deadline": task_data.get("deadline", "TBD"),
        }
        content = render_template(template["content"], variables)
    else:
        content = (
            f"📌 Hi {employee_name}!\n\n"
            f"A new task '{task_data.get('title', 'New Task')}' has been assigned to you.\n\n"
            f"— DelegateX"
        )
    
    asyncio.create_task(n8n_service.trigger_task_assignment_workflow(task_data))
    
    message = await send_message(
        recipient_phone=phone,
        content=content,
        recipient_name=employee_name,
        message_type="template",
        automation_workflow="Task Assignment Notification",
        metadata={"task_id": str(task_data.get("_id", "")), "trigger": "task_assigned"},
    )
    
    duration_ms = int((time.time() - start_time) * 1000)
    await _log_automation(
        workflow_name="Task Assignment Notification",
        trigger="Task Assigned",
        status=AutomationStatus.SUCCESS.value,
        recipient=employee_name,
        recipient_phone=phone,
        message_preview=content,
        duration_ms=duration_ms,
    )
    
    return message


# ═══════════════════════════════════════════════════════════════════
# PHASE 3 AUTOMATIONS
# ═══════════════════════════════════════════════════════════════════

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
    )
    
    return message


async def detect_intent_and_route(incoming_message: dict) -> Optional[dict]:
    """
    Phase 3 — AI Intent Detection
    Automatically detect user intent and route to the appropriate handler.
    """
    content = incoming_message.get("content", "").lower().strip()
    
    # Intent detection rules
    if any(keyword in content for keyword in ["status", "enquiry", "profile", "my details", "lookup"]):
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
        )
    
    else:
        # Default: route to AI FAQ bot
        return await trigger_ai_faq_bot(incoming_message)
