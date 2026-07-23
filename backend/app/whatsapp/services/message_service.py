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


def _generate_conversation_id(phone: str) -> str:
    """Generate a deterministic conversation ID from a phone number."""
    return hashlib.md5(phone.strip().encode()).hexdigest()[:16]


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
    
    1. Save message to MongoDB (status: queued)
    2. Invoke provider to send
    3. Schedule status transitions (simulation)
    4. Broadcast via WebSocket
    5. Return the saved message document
    """
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
    Used to test auto-reply, AI FAQ bot, and intent detection.
    """
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
