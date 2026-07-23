"""
WhatsApp Provider — Maytapi (Stub)
Ready for future implementation with the Maytapi WhatsApp API.
"""

import os
from typing import Dict, Any, Optional
from app.whatsapp.providers.base import WhatsAppProvider


class MaytapiProvider(WhatsAppProvider):
    """
    Maytapi WhatsApp API provider.
    
    Required environment variables (for future use):
        MAYTAPI_API_URL
        MAYTAPI_API_TOKEN
        MAYTAPI_PHONE_ID
        MAYTAPI_PRODUCT_ID
    """

    def __init__(self, settings: dict = None):
        self.api_url = os.getenv("MAYTAPI_API_URL", "")
        self.api_token = os.getenv("MAYTAPI_API_TOKEN", "")
        self.phone_id = os.getenv("MAYTAPI_PHONE_ID", "")
        self.product_id = os.getenv("MAYTAPI_PRODUCT_ID", "")
        
        if settings:
            self.api_url = settings.get("api_url", self.api_url)
            self.api_token = settings.get("api_key", self.api_token)
            self.phone_id = settings.get("phone_number_id", self.phone_id)
            self.product_id = settings.get("business_account_id", self.product_id)

    async def send_message(
        self,
        recipient_phone: str,
        content: str,
        message_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        TODO: Implement Maytapi message sending.
        
        Will use:
            POST https://api.maytapi.com/api/{product_id}/{phone_id}/sendMessage
        """
        return {
            "success": False,
            "message_id": None,
            "provider_response": {
                "error": "Maytapi provider is not yet configured. "
                         "Please add API credentials to activate."
            }
        }

    async def get_message_status(self, message_id: str) -> str:
        return "failed"

    async def validate_credentials(self) -> Dict[str, Any]:
        if not self.api_token or not self.phone_id:
            return {
                "valid": False,
                "message": "Maytapi credentials not configured. "
                           "Set MAYTAPI_API_TOKEN and MAYTAPI_PHONE_ID."
            }
        return {
            "valid": False,
            "message": "Maytapi validation not yet implemented."
        }

    def get_provider_name(self) -> str:
        return "Maytapi WhatsApp API"

    def get_provider_type(self) -> str:
        return "maytapi"
