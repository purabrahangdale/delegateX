"""
WhatsApp Automation — Message Service
Core service: compose messages, invoke provider, save to DB, broadcast via WebSocket.
"""

import asyncio
import hashlib
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from app.whatsapp.models import MessageStatus, MessageDirection, MessageType
from app.whatsapp.repository import MessageRepository, AutomationLogRepository
from app.whatsapp.providers.factory import get_provider
from app.whatsapp.providers.simulation import SimulationProvider

logger = logging.getLogger("whatsapp.message_service")


import re


def _generate_conversation_id(phone: str) -> str:
    """Generate a deterministic conversation ID from a phone number by normalizing non-digits."""
    if not phone:
        return "conv-default"
    cleaned = re.sub(r"\D", "", phone.strip())
    raw = cleaned if cleaned else phone.strip()
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def seed_default_conversations_if_empty():
    """Seed initial simulation conversation messages if database collection is empty."""
    from app.config.database import whatsapp_message_collection
    if whatsapp_message_collection.count_documents({}) > 0:
        return

    now_iso = datetime.utcnow().isoformat()
    seed_conversations = [
        {
            "recipient": "Rahul Sharma",
            "recipient_phone": "+91 98765 43210",
            "messages": [
                {"direction": "outbound", "sender": "DelegateX", "content": "Hello Rahul, thank you for your enquiry.", "status": "read", "created_at": new_iso},
                {"direction": "inbound", "sender": "Rahul Sharma", "content": "Thank you! Can we schedule a meeting tomorrow?", "status": "read", "created_at": new_iso}
            ]
        },
        {
            "recipient": "Priya Patel",
            "recipient_phone": "+91 98765 43211",
            "messages": [
                {"direction": "outbound", "sender": "DelegateX", "content": "Your site visit has been scheduled.", "status": "read", "created_at": new_iso},
                {"direction": "inbound", "sender": "Priya Patel", "content": "Please change the timing to 4 PM.", "status": "read", "created_at": new_iso}
            ]
        },
        {
            "recipient": "Amit Verma",
            "recipient_phone": "+91 98765 43212",
            "messages": [
                {"direction": "outbound", "sender": "DelegateX", "content": "Your quotation has been shared.", "status": "read", "created_at": new_iso},
                {"direction": "inbound", "sender": "Amit Verma", "content": "Can you send me the updated price?", "status": "read", "created_at": new_iso}
            ]
        },
        {
            "recipient": "Sneha Gupta",
            "recipient_phone": "+91 98765 43213",
            "messages": [
                {"direction": "outbound", "sender": "DelegateX", "content": "Welcome to DelegateX.", "status": "read", "created_at": new_iso},
                {"direction": "inbound", "sender": "Sneha Gupta", "content": "Thanks. I would like to know more about your services.", "status": "read", "created_at": new_iso}
            ]
        },
        {
            "recipient": "Rohit Singh",
            "recipient_phone": "+91 98765 43214",
            "messages": [
                {"direction": "outbound", "sender": "DelegateX", "content": "Reminder for tomorrow's meeting.", "status": "read", "created_at": new_iso},
                {"direction": "inbound", "sender": "Rohit Singh", "content": "Confirmed. See you tomorrow.", "status": "read", "created_at": new_iso}
            ]
        }
    ]

    for seed in seed_conversations:
        conv_id = _generate_conversation_id(seed["recipient_phone"])
        for msg in seed["messages"]:
            isInbound = msg["direction"] == "inbound"
            msg_doc = {
                "conversation_id": conv_id,
                "direction": msg["direction"],
                "sender": msg["sender"],
                "sender_phone": "+91-DELEGATEX" if not isInbound else seed["recipient_phone"],
                "recipient": seed["recipient"] if not isInbound else "DelegateX",
                "recipient_phone": seed["recipient_phone"] if not isInbound else "+91-DELEGATEX",
                "content": msg["content"],
                "message_type": "text",
                "reply_type": "text",
                "status": msg["status"],
                "source": "simulation",
                "mode": "simulation",
                "campaign_name": "Welcome & Onboarding Campaign",
                "template_name": "Welcome Message",
                "created_at": msg["created_at"],
                "updated_at": msg["created_at"],
            }
            whatsapp_message_collection.insert_one(msg_doc)




async def _broadcast_whatsapp_event(event_type: str, data: dict):
    """Broadcast a WhatsApp event to all connected WebSocket clients."""
    try:
        from app.websocket.manager import manager
        event = {"event": event_type, "data": data}
        await manager.broadcast(event, "whatsapp")
    except Exception as e:
        logger.warning(f"[WS Broadcast] Failed: {e}")


async def _update_message_status_and_broadcast(message_id: str, status: MessageStatus):
    """Update message status in DB and broadcast the change via WebSocket."""
    timestamp_field_map = {
        MessageStatus.SENT: "sent_at",
        MessageStatus.DELIVERED: "delivered_at",
        MessageStatus.READ: "read_at",
    }
    timestamp_field = timestamp_field_map.get(status)
    MessageRepository.update_status(message_id, status.value, timestamp_field)
    
    # Broadcast status update
    await _broadcast_whatsapp_event("message_status_updated", {
        "message_id": message_id,
        "status": status.value,
        "updated_at": datetime.utcnow().isoformat(),
    })


async def send_message(
    recipient_phone: str,
    content: str,
    recipient_name: str = "Unknown",
    message_type: str = "text",
    template_id: Optional[str] = None,
    automation_workflow: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Send a WhatsApp message through the configured provider.
    
    1. Pre-check Global DND / Blocklist
    2. Save message to MongoDB (status: queued)
    3. Invoke provider to send
    4. Schedule status transitions (simulation)
    5. Broadcast via WebSocket
    """
    from app.whatsapp.repository import DNDRepository

    # 1. Global DND / Blocklist Auto-Exclusion Pre-check
    if DNDRepository.is_dnd(recipient_phone):
        logger.info(f"[DND Auto-Exclusion] Intercepted message to blocked number: {recipient_phone}")
        
        # Log skipped event
        AutomationLogRepository.create({
            "workflow_name": automation_workflow or "Campaign / Broadcast",
            "trigger_event": "outbound_dispatch",
            "status": "skipped",
            "recipient": recipient_phone,
            "message_preview": content[:100] if content else "",
            "execution_duration_ms": 0,
            "error_message": "Recipient phone number is blocked in Global DND list",
            "metadata": {"reason": "DND_BLOCKED", "phone": recipient_phone},
        })
        
        return {
            "_id": None,
            "status": "skipped",
            "reason": "DND_BLOCKED",
            "recipient_phone": recipient_phone,
            "message": f"Message to {recipient_phone} skipped — recipient is listed in Global DND / Blocklist.",
        }

    conversation_id = _generate_conversation_id(recipient_phone)
    
    # Build message document
    message_data = {
        "conversation_id": conversation_id,
        "direction": MessageDirection.OUTBOUND.value,
        "sender": "DelegateX",
        "sender_phone": "+91-DELEGATEX",
        "recipient": recipient_name,
        "recipient_phone": recipient_phone,
        "content": content,
        "message_type": message_type,
        "status": MessageStatus.QUEUED.value,
        "template_id": template_id,
        "automation_workflow": automation_workflow,
        "metadata": metadata or {},
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # Save to MongoDB
    saved_message = MessageRepository.create(message_data)
    message_id = saved_message["_id"]
    
    # Broadcast new message event
    await _broadcast_whatsapp_event("new_message", saved_message)
    
    # Invoke provider
    provider = get_provider()
    result = await provider.send_message(
        recipient_phone=recipient_phone,
        content=content,
        message_type=message_type,
        metadata=metadata,
    )
    
    if result.get("success"):
        # Audit: Mark manager reply in chat_access_logs if sent by a manager
        try:
            from app.whatsapp.services.chat_access_service import record_manager_reply
            mgr_id = (metadata or {}).get("manager_email") or (metadata or {}).get("manager_name") or (metadata or {}).get("manager_id") or "admin@delegatex.com"
            record_manager_reply(
                conversation_id=conversation_id,
                manager_identifier=mgr_id,
                reply_message_id=message_id,
                contact_phone=recipient_phone
            )
        except Exception as ex:
            logger.warning(f"[Chat Access Audit] Reply record linking error: {ex}")


        # For simulation provider, schedule status transitions
        if isinstance(provider, SimulationProvider):
            asyncio.create_task(
                provider.simulate_status_transitions(
                    message_id,
                    _update_message_status_and_broadcast
                )
            )
        else:
            # For real providers, mark as sent immediately
            await _update_message_status_and_broadcast(message_id, MessageStatus.SENT)

    else:
        # Mark as failed
        MessageRepository.update_status(message_id, MessageStatus.FAILED.value)
        await _broadcast_whatsapp_event("message_status_updated", {
            "message_id": message_id,
            "status": MessageStatus.FAILED.value,
            "error": result.get("provider_response", {}).get("error", "Unknown error"),
        })
    
    return saved_message


def _associate_context_with_inbound_reply(sender_phone: str, conversation_id: str) -> dict:
    """
    Locate previous outbound message in the same conversation to extract campaign and template details,
    and query CRM lead for assigned agent details.
    NEVER fabricates or guesses data.
    """
    context = {
        "campaign_id": "",
        "campaign_name": "",
        "template_id": "",
        "template_name": "",
        "assigned_agent": "",
    }
    
    # 1. Look up recent outbound message in the same conversation
    try:
        messages = MessageRepository.find_by_conversation(conversation_id)
        outbound = [m for m in messages if m.get("direction") == "outbound"]
        if outbound:
            last_outbound = outbound[-1]
            meta = last_outbound.get("metadata", {}) or {}
            
            context["campaign_id"] = meta.get("campaign_id", "") or meta.get("campaignId", "") or ""
            context["campaign_name"] = meta.get("campaign_name", "") or meta.get("campaignName", "") or last_outbound.get("automation_workflow", "") or ""
            context["template_id"] = last_outbound.get("template_id", "") or meta.get("template_id", "") or meta.get("templateId", "") or ""
            context["template_name"] = meta.get("template_name", "") or meta.get("templateName", "") or ""
    except Exception as e:
        logger.warning(f"[Reply Context Lookup] Message context failed: {e}")

    # 2. Look up CRM lead for assigned agent
    try:
        from app.config.database import crm_lead_collection
        import re
        clean_phone = re.sub(r"\D", "", sender_phone or "")
        if clean_phone:
            lead = crm_lead_collection.find_one({"phone": {"$regex": clean_phone}})
            if lead:
                context["assigned_agent"] = lead.get("assignedTo", "") or lead.get("assigned_agent", "") or ""
    except Exception as e:
        logger.warning(f"[Reply Context Lookup] Lead lookup failed: {e}")

    return context


async def process_incoming_reply(
    sender_phone: str,
    sender_name: str = "Customer",
    content: str = "",
    message_type: str = "text",
    reply_type: str = "text",
    source: str = "simulation",
    mode: str = "simulation",
    wamid: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Unified entry point for saving incoming customer replies (Simulation Mode & Meta Webhooks).
    Enforces duplicate protection, resolves campaign/template context, saves to DB, and broadcasts via WS.
    """
    from app.whatsapp.repository import DNDRepository

    # 1. Duplicate Protection Check
    if wamid or (sender_phone and content):
        existing = MessageRepository.find_duplicate_message(wamid_or_id=wamid, sender_phone=sender_phone, content=content)
        if existing:
            logger.info(f"[Duplicate Protection] Intercepted duplicate incoming message wamid={wamid} from {sender_phone}")
            return existing

    conversation_id = _generate_conversation_id(sender_phone)
    
    # 2. Context Association (Campaign, Template, Assigned Agent)
    context = _associate_context_with_inbound_reply(sender_phone, conversation_id)
    
    meta = metadata or {}

    # Detect Button Response Color (Green vs Red)
    button_color = meta.get("button_color")
    if not button_color:
        clean_c = (content or "").strip().upper()
        green_terms = ["YES", "ACCEPT", "INTERESTED", "CONFIRM", "AGREE", "POSITIVE", "APPROVED"]
        red_terms = ["NO", "DECLINE", "NOT INTERESTED", "CANCEL", "REJECT", "NEGATIVE", "UNSUBSCRIBE"]
        if any(term in clean_c for term in green_terms):
            button_color = "green"
        elif any(term in clean_c for term in red_terms):
            button_color = "red"

    if button_color:
        meta["button_color"] = button_color

    meta.update({
        "source": source,
        "mode": mode,
        "wamid": wamid or "",
        "reply_type": reply_type,
        "campaign_id": context.get("campaign_id", ""),
        "campaign_name": context.get("campaign_name", ""),
        "template_id": context.get("template_id", ""),
        "template_name": context.get("template_name", ""),
        "assigned_agent": context.get("assigned_agent", ""),
    })

    message_data = {
        "conversation_id": conversation_id,
        "direction": MessageDirection.INBOUND.value,
        "sender": sender_name,
        "sender_phone": sender_phone,
        "recipient": "DelegateX",
        "recipient_phone": "+91-DELEGATEX",
        "content": content,
        "message_type": message_type,
        "reply_type": reply_type,
        "status": MessageStatus.READ.value,
        "source": source,
        "mode": mode,
        "wamid": wamid or "",
        "campaign_id": context.get("campaign_id", ""),
        "campaign_name": context.get("campaign_name", ""),
        "template_id": context.get("template_id", ""),
        "template_name": context.get("template_name", ""),
        "assigned_agent": context.get("assigned_agent", ""),
        "metadata": meta,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    saved_message = MessageRepository.create(message_data)
    await _broadcast_whatsapp_event("new_message", saved_message)
    
    # Auto Opt-Out Listener Check
    clean_text = content.strip().upper()
    opt_out_keywords = ["STOP", "UNSUBSCRIBE", "REMOVE", "QUIT", "DND"]
    
    if any(clean_text == kw or clean_text.startswith(kw + " ") for kw in opt_out_keywords):
        logger.info(f"[Inbound Opt-Out] Auto-registering DND for {sender_phone} keyword '{clean_text}'")
        DNDRepository.add_dnd_number({
            "phone_number": sender_phone,
            "reason": "User Opt-out",
            "source": "Inbox Keyword",
            "notes": f"Triggered by keyword '{content}'",
        })
        
        asyncio.create_task(
            send_message(
                recipient_phone=sender_phone,
                recipient_name=sender_name,
                content="🚫 You have been successfully unsubscribed and added to our Global DND list. You will not receive further campaign messages.",
                automation_workflow="opt-out-confirmation"
            )
        )
    elif clean_text == "START" or clean_text == "UNBLOCK":
        logger.info(f"[Inbound Opt-In] Removing DND for {sender_phone}")
        DNDRepository.remove_dnd(sender_phone)
        asyncio.create_task(
            send_message(
                recipient_phone=sender_phone,
                recipient_name=sender_name,
                content="✅ You have been opted back in and removed from the DND list. Welcome back!",
                automation_workflow="opt-in-confirmation"
            )
        )
    
    return saved_message


async def simulate_incoming_message(
    sender_phone: str,
    sender_name: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Simulate an incoming WhatsApp message (for demo/testing).
    Uses process_incoming_reply with source='simulation' and mode='simulation'.
    """
    return await process_incoming_reply(
        sender_phone=sender_phone,
        sender_name=sender_name,
        content=content,
        message_type="text",
        reply_type="text",
        source="simulation",
        mode="simulation",
        metadata=metadata,
    )



def get_dashboard_stats() -> dict:
    """Get aggregated statistics for the WhatsApp dashboard."""
    today_count = MessageRepository.count_today()
    pending_count = MessageRepository.count_by_status("queued")
    sent_count = MessageRepository.count_by_status("sent")
    delivered_count = MessageRepository.count_by_status("delivered")
    read_count = MessageRepository.count_by_status("read")
    failed_count = MessageRepository.count_by_status("failed")
    total_messages = MessageRepository.count()
    total_automations = AutomationLogRepository.count()
    
    success_automations = AutomationLogRepository.count_by_status("success")
    failed_automations = AutomationLogRepository.count_by_status("failed")
    
    recent_logs = AutomationLogRepository.get_latest(5)
    
    return {
        "messages_sent_today": today_count,
        "pending_messages": pending_count,
        "scheduled_messages": 0,  # Will be populated by scheduler
        "successful_deliveries": delivered_count + read_count,
        "failed_messages": failed_count,
        "total_automations": total_automations,
        "total_messages": total_messages,
        "sent_count": sent_count,
        "read_count": read_count,
        "success_automations": success_automations,
        "failed_automations": failed_automations,
        "recent_activity": recent_logs,
        "last_automation_time": recent_logs[0].get("execution_time") if recent_logs else None,
    }
