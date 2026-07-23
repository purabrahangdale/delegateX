"""
WhatsApp Automation — WebSocket Endpoint
Real-time WebSocket channel for WhatsApp messages, status updates, and automation events.
Follows the same pattern as existing CRM/Delegation WebSocket endpoints.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

router = APIRouter()


@router.websocket("/ws/whatsapp")
async def websocket_whatsapp_endpoint(websocket: WebSocket):
    """
    WhatsApp WebSocket endpoint for real-time updates.
    
    Events broadcast on this channel:
    - new_message: New message created (sent or received)
    - message_status_updated: Message status changed (queued→sent→delivered→read)
    - automation_log_created: New automation execution logged
    - template_updated: Template created/updated/deleted
    """
    await manager.connect(websocket, "whatsapp")
    try:
        while True:
            # Keep connection alive, listen for client events
            data = await websocket.receive_json()
            # Clients can broadcast events to other connected tabs
            await manager.broadcast(data, "whatsapp")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "whatsapp")
    except Exception:
        manager.disconnect(websocket, "whatsapp")
