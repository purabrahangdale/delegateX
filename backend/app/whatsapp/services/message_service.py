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
            msg_doc = {
                "conversation_id": conv_id,
                "direction": msg["direction"],
                "sender": msg["sender"],
                "sender_phone": "+91-DELEGATEX" if msg["direction"] == "outbound" else seed["recipient_phone"],
                "recipient": seed["recipient"] if msg["direction"] == "outbound" else "DelegateX",
                "recipient_phone": seed["recipient_phone"] if msg["direction"] == "outbound" else "+91-DELEGATEX",
                "content": msg["content"],
                "message_type": "text",
                "status": msg["status"],
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


async def simulate_incoming_message(
    sender_phone: str,
    sender_name: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Simulate an incoming WhatsApp message (for demo/testing).
    Includes automatic opt-out listener for STOP / UNSUBSCRIBE / DND keywords.
    """
    from app.whatsapp.repository import DNDRepository

    conversation_id = _generate_conversation_id(sender_phone)
    
    message_data = {
        "conversation_id": conversation_id,
        "direction": MessageDirection.INBOUND.value,
        "sender": sender_name,
        "sender_phone": sender_phone,
        "recipient": "DelegateX",
        "recipient_phone": "+91-DELEGATEX",
        "content": content,
        "message_type": MessageType.TEXT.value,
        "status": MessageStatus.READ.value,
        "metadata": metadata or {},
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
        
        # Send confirmation opt-out message
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
