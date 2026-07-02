# WebSocket Event Types and Broadcast Helpers
import asyncio
from app.websocket.manager import manager
from app.websocket.notifications import trigger_notification

async def broadcast_delegation_event(event_type: str, data: dict):
    """
    Broadcasts a delegation event (e.g. delegation_created, task_updated, task_completed)
    to all active delegation websocket connections.
    """
    event = {
        "event": event_type,
        "data": data
    }
    await manager.broadcast(event, "delegation")

async def broadcast_crm_event(event_type: str, data: dict):
    """
    Broadcasts a CRM event (e.g. lead_created, lead_updated, followup_scheduled)
    to all active CRM websocket connections.
    """
    event = {
        "event": event_type,
        "data": data
    }
    await manager.broadcast(event, "crm")

async def trigger_and_broadcast_notification(notification_type: str, title: str, message: str):
    """
    Saves a new notification to the database and broadcasts it.
    """
    await trigger_notification(notification_type, title, message)
