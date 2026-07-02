from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from bson import ObjectId
from datetime import datetime
from app.websocket.manager import manager
from app.config.database import notification_collection

router = APIRouter()

# Helper to trigger and save notifications
async def trigger_notification(notification_type: str, title: str, message: str):
    notification_data = {
        "type": notification_type,
        "title": title,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "read": False
    }
    
    # Save to Database
    res = notification_collection.insert_one(notification_data)
    notification_data["_id"] = str(res.inserted_id)
    
    # Broadcast to all connected notification websockets
    event = {
        "event": "notification_received",
        "data": notification_data
    }
    await manager.broadcast(event, "notifications")
    return notification_data

@router.websocket("/ws/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket):
    await manager.connect(websocket, "notifications")
    try:
        while True:
            # Maintain connection, listen for any messages (e.g. read acknowledgment)
            data = await websocket.receive_json()
            if data.get("event") == "mark_read":
                notif_id = data.get("id")
                if notif_id:
                    notification_collection.update_one(
                        {"_id": ObjectId(notif_id)},
                        {"$set": {"read": True}}
                    )
                    # Broadcast notification read status updated
                    await manager.broadcast({
                        "event": "notification_read_update",
                        "data": {"id": notif_id, "read": True}
                    }, "notifications")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "notifications")
    except Exception:
        manager.disconnect(websocket, "notifications")

# REST endpoints for Notification UI
@router.post("/notifications")
async def create_notification(payload: dict):
    notif = await trigger_notification(
        payload.get("type", "generic"),
        payload.get("title", "Alert"),
        payload.get("message", "")
    )
    return notif

@router.get("/notifications")
async def get_notifications():
    notifications = []
    for n in notification_collection.find().sort("timestamp", -1).limit(50):
        n["_id"] = str(n["_id"])
        notifications.append(n)
    return notifications

@router.put("/notifications/{notif_id}/read")
async def mark_read(notif_id: str):
    res = notification_collection.update_one(
        {"_id": ObjectId(notif_id)},
        {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    # Broadcast update via ws
    await manager.broadcast({
        "event": "notification_read_update",
        "data": {"id": notif_id, "read": True}
    }, "notifications")
    
    return {"message": "Notification marked as read"}

@router.put("/notifications/read-all")
async def mark_all_read():
    notification_collection.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    
    # Broadcast update via ws
    await manager.broadcast({
        "event": "notification_all_read",
        "data": {}
    }, "notifications")
    
    return {"message": "All notifications marked as read"}

@router.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: str):
    res = notification_collection.delete_one({"_id": ObjectId(notif_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    # Broadcast deletion via ws
    await manager.broadcast({
        "event": "notification_deleted",
        "data": {"id": notif_id}
    }, "notifications")
    
    return {"message": "Notification deleted successfully"}
