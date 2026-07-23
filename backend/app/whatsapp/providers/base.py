"""
WhatsApp Provider — Abstract Base Class
Defines the interface that all WhatsApp providers must implement.
Swap providers (Simulation, Meta Cloud API, Maytapi) without changing business logic.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class WhatsAppProvider(ABC):
    """
    Abstract base class for WhatsApp messaging providers.
    
    To add a new provider:
    1. Create a new class inheriting from WhatsAppProvider
    2. Implement all abstract methods
    3. Register it in the provider factory
    """

    @abstractmethod
    async def send_message(
        self,
        recipient_phone: str,
        content: str,
        message_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp message to a recipient.
        
        Returns:
            dict with keys: success (bool), message_id (str), provider_response (dict)
        """
        pass

    @abstractmethod
    async def get_message_status(self, message_id: str) -> str:
        """
        Check the delivery status of a previously sent message.
        
        Returns:
            Status string: "queued", "sent", "delivered", "read", "failed"
        """
        pass

    @abstractmethod
    async def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate the provider's API credentials.
        
        Returns:
            dict with keys: valid (bool), message (str)
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the human-readable provider name."""
        pass

    @abstractmethod
    def get_provider_type(self) -> str:
        """Return the provider type identifier (simulation, meta_cloud, maytapi)."""
        pass
