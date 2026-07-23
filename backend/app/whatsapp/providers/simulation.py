"""
WhatsApp Provider — Simulation Mode
Stores messages in MongoDB and simulates the delivery lifecycle.
Used for demo/development when real WhatsApp credentials are unavailable.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from app.whatsapp.providers.base import WhatsAppProvider
from app.whatsapp.models import MessageStatus


class SimulationProvider(WhatsAppProvider):
    """
    Simulation provider that mimics WhatsApp Cloud API behaviour.
    Messages are stored in MongoDB and status transitions are simulated:
        queued → sent (instant) → delivered (1s) → read (3s)
    """

    def __init__(self):
        self._status_callbacks = []

    def on_status_change(self, callback):
        """Register a callback for status change events."""
        self._status_callbacks.append(callback)

    async def send_message(
        self,
        recipient_phone: str,
        content: str,
        message_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Simulate sending a WhatsApp message.
        Returns immediately with a generated message ID.
        Status transitions are scheduled in the background.
        """
        message_id = str(uuid.uuid4())
        
        return {
            "success": True,
            "message_id": message_id,
            "provider_response": {
                "provider": "simulation",
                "simulated": True,
                "message_id": message_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

    async def simulate_status_transitions(self, message_db_id: str, update_callback):
        """
        Simulate realistic status transitions for a sent message.
        This runs as a background task after send_message().
        
        Args:
            message_db_id: The MongoDB _id of the message document
            update_callback: Async function(message_id, new_status) to persist updates
        """
        try:
            # queued → sent (immediate)
            await asyncio.sleep(0.5)
            await update_callback(message_db_id, MessageStatus.SENT)

            # sent → delivered (after 1.5s)
            await asyncio.sleep(1.5)
            await update_callback(message_db_id, MessageStatus.DELIVERED)

            # delivered → read (after 3s)
            await asyncio.sleep(3.0)
            await update_callback(message_db_id, MessageStatus.READ)

        except Exception as e:
            print(f"[SimulationProvider] Status transition error: {e}")

    async def get_message_status(self, message_id: str) -> str:
        """In simulation mode, status is managed via the transition scheduler."""
        return MessageStatus.DELIVERED

    async def validate_credentials(self) -> Dict[str, Any]:
        """Simulation mode always passes validation."""
        return {
            "valid": True,
            "message": "Simulation Mode — no credentials required."
        }

    def get_provider_name(self) -> str:
        return "Simulation Mode"

    def get_provider_type(self) -> str:
        return "simulation"
