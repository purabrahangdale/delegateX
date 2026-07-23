from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # We track connections for each type of namespace/path
        self.delegation_connections: List[WebSocket] = []
        self.crm_connections: List[WebSocket] = []
        self.notification_connections: List[WebSocket] = []
        self.whatsapp_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel == "delegation":
            self.delegation_connections.append(websocket)
        elif channel == "crm":
            self.crm_connections.append(websocket)
        elif channel == "notifications":
            self.notification_connections.append(websocket)
        elif channel == "whatsapp":
            self.whatsapp_connections.append(websocket)

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel == "delegation" and websocket in self.delegation_connections:
            self.delegation_connections.remove(websocket)
        elif channel == "crm" and websocket in self.crm_connections:
            self.crm_connections.remove(websocket)
        elif channel == "notifications" and websocket in self.notification_connections:
            self.notification_connections.remove(websocket)
        elif channel == "whatsapp" and websocket in self.whatsapp_connections:
            self.whatsapp_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: dict, channel: str):
        connections = []
        if channel == "delegation":
            connections = self.delegation_connections
        elif channel == "crm":
            connections = self.crm_connections
        elif channel == "notifications":
            connections = self.notification_connections
        elif channel == "whatsapp":
            connections = self.whatsapp_connections

        for connection in list(connections):
            try:
                await connection.send_json(message)
            except Exception:
                # Remove stale connection
                self.disconnect(connection, channel)

manager = ConnectionManager()
