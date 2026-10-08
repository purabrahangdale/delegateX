import os
import re
import logging
from typing import Dict, Any, Optional
from app.whatsapp.providers.base import WhatsAppProvider

logger = logging.getLogger("whatsapp.meta_cloud")


def normalize_phone_number(phone: str) -> str:
    """Normalize phone number to international E.164 digits without +."""
    if not phone:
        return ""
    cleaned = re.sub(r"\D", "", phone.strip())
    if not cleaned:
        return ""
    # Standard 10-digit Indian mobile number (e.g. 9179485720) -> add country code 91
    if len(cleaned) == 10 and cleaned[0] in "6789":
        cleaned = "91" + cleaned
    # 11-digit with leading zero (e.g. 09179485720) -> replace leading 0 with 91
    elif len(cleaned) == 11 and cleaned.startswith("0") and cleaned[1] in "6789":
        cleaned = "91" + cleaned[1:]
    return cleaned


def mask_phone(phone: str) -> str:
    """Safely mask phone number for logging."""
    if len(phone) <= 4:
        return "****"
    return "*" * (len(phone) - 4) + phone[-4:]


class MetaCloudProvider(WhatsAppProvider):
    """
    Meta WhatsApp Cloud API provider.
    Sends WhatsApp messages using Meta Graph API.
    """

    def __init__(self, settings: dict = None):
        self.api_url = os.getenv("META_WHATSAPP_API_URL", "")
        self.api_token = os.getenv("META_WHATSAPP_API_TOKEN", "")
        self.phone_number_id = os.getenv("META_WHATSAPP_PHONE_NUMBER_ID", "")
        self.business_account_id = os.getenv("META_WHATSAPP_BUSINESS_ACCOUNT_ID", "")
        
        if settings:
            self.api_url = settings.get("api_url", self.api_url)
            self.api_token = settings.get("api_key", self.api_token)
            self.phone_number_id = settings.get("phone_number_id", self.phone_number_id)
            self.business_account_id = settings.get("business_account_id", self.business_account_id)

    def _resolve_endpoint(self) -> str:
        """Resolve the full Meta messages endpoint."""
        url = (self.api_url or "").strip()
        if not url:
            return f"https://graph.facebook.com/v22.0/{self.phone_number_id}/messages"
        if url.endswith("/messages"):
            return url
        return f"{url.rstrip('/')}/{self.phone_number_id}/messages"

    async def send_message(
        self,
        recipient_phone: str,
        content: str,
        message_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp message via the official Meta WhatsApp Cloud API.
        """
        if not self.api_token or not self.phone_number_id:
            logger.error("[WhatsApp] Missing Meta WhatsApp API Token or Phone Number ID.")
            return {
                "success": False,
                "message_id": None,
                "error": "Missing Meta WhatsApp API Token or Phone Number ID.",
                "provider_response": {
                    "error": "Missing Meta WhatsApp API Token or Phone Number ID."
                }
            }

        endpoint = self._resolve_endpoint()
        cleaned_phone = normalize_phone_number(recipient_phone)

        if not cleaned_phone:
            logger.error("[WhatsApp] Invalid recipient phone number provided.")
            return {
                "success": False,
                "message_id": None,
                "error": "Invalid recipient phone number.",
                "provider_response": {"error": "Invalid recipient phone number."}
            }

        logger.info("[WhatsApp] Send request received")
        logger.info(f"[WhatsApp] Recipient: {mask_phone(cleaned_phone)}")
        logger.info("[WhatsApp] Calling Meta API")

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        # Check if caller specified a template payload in metadata
        if message_type == "template" and metadata and metadata.get("template"):
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": cleaned_phone,
                "type": "template",
                "template": metadata["template"]
            }
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": cleaned_phone,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": content,
                },
            }

        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(endpoint, json=payload, headers=headers)
                data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}

                logger.info(f"[WhatsApp] Meta response status: {res.status_code}")

                if res.status_code in (200, 201):
                    messages = data.get("messages", [])
                    meta_msg_id = messages[0].get("id") if messages else None
                    logger.info(f"[WhatsApp] Message ID: {meta_msg_id}")
                    return {
                        "success": True,
                        "message_id": meta_msg_id,
                        "recipient": cleaned_phone,
                        "provider_response": data,
                    }
                else:
                    err_obj = data.get("error", {})
                    err_msg = err_obj.get("message", res.text)
                    err_code = err_obj.get("code")
                    err_subcode = err_obj.get("error_subcode")
                    err_detail = f"{err_msg} (code: {err_code}, subcode: {err_subcode})" if err_code else err_msg
                    
                    logger.error(f"[WhatsApp] Meta API error status {res.status_code}: {err_detail}")
                    return {
                        "success": False,
                        "message_id": None,
                        "error": err_detail,
                        "provider_response": {"error": err_detail, "raw": data},
                    }
        except Exception as e:
            logger.error(f"[WhatsApp] Meta API Exception: {e}")
            return {
                "success": False,
                "message_id": None,
                "error": str(e),
                "provider_response": {"error": str(e)},
            }

    async def get_message_status(self, message_id: str) -> str:
        return "sent"

    async def validate_credentials(self) -> Dict[str, Any]:
        if not self.api_token or not self.phone_number_id:
            return {
                "valid": False,
                "message": "Meta Cloud API credentials not configured. Set API Token and Phone Number ID."
            }
        try:
            import httpx
            endpoint = f"https://graph.facebook.com/v22.0/{self.phone_number_id}"
            headers = {"Authorization": f"Bearer {self.api_token}"}
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(endpoint, headers=headers)
                return {
                    "valid": res.status_code == 200,
                    "message": "Credentials valid" if res.status_code == 200 else f"Validation failed: HTTP {res.status_code}"
                }
        except Exception as e:
            return {"valid": False, "message": str(e)}

    def get_provider_name(self) -> str:
        return "Meta WhatsApp Cloud API"

    def get_provider_type(self) -> str:
        return "meta_cloud"

