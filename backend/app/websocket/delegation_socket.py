from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

router = APIRouter()

@router.websocket("/ws/delegation")
async def websocket_delegation_endpoint(websocket: WebSocket):
    await manager.connect(websocket, "delegation")
    try:
        while True:
            # Keep the connection alive and receive events if frontend sends them
            data = await websocket.receive_json()
            # If the frontend wants to broadcast delegation actions directly:
            await manager.broadcast(data, "delegation")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "delegation")
    except Exception:
        manager.disconnect(websocket, "delegation")
