from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

router = APIRouter()

@router.websocket("/ws/crm")
async def websocket_crm_endpoint(websocket: WebSocket):
    await manager.connect(websocket, "crm")
    try:
        while True:
            # Keep connection alive, listen for CRM client events and broadcast them to other connected tabs
            data = await websocket.receive_json()
            await manager.broadcast(data, "crm")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "crm")
    except Exception:
        manager.disconnect(websocket, "crm")
