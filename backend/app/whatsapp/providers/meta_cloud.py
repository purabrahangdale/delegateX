import logging
from typing import Dict, Any, Optional
from app.whatsapp.providers.base import WhatsAppProvider
from app.whatsapp.meta_api import MetaClient, MetaApiError

logger = logging.getLogger("whatsapp.meta_cloud")


def normalize_phone_number(phone: str) -> str:
    """Normalize phone number to international E.164 digits without +."""
    from app.whatsapp.services.campaign_service import normalize_phone
    return normalize_phone(phone) or ""


def mask_phone(phone: str) -> str:
    """Safely mask phone number for logging."""
    if len(phone) <= 4:
        return "****"
    return "*" * (len(phone) - 4) + phone[-4:]


class MetaCloudProvider(WhatsAppProvider):
    """
    Meta WhatsApp Cloud API provider for single (inbox / automation reply) messages.
    Campaign and template automations go through campaign_service's queued worker instead.
    """

    def __init__(self, number: Optional[dict] = None):
        # Credentials of exactly this business number; without a number nothing can be sent.
        from app.whatsapp.numbers import config_for
        self.number = number
        self.config = config_for(number) if number else None

    async def send_message(
        self,
        recipient_phone: str,
        content: str,
        message_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send via POST /{phone_number_id}/messages.
        - metadata.template (dict with name/language/components) → template message, sent as given.
        - otherwise → free-form text (only delivered inside the 24h customer service window).
        """
        if not self.config:
            err = "No WhatsApp business number selected — the message was not sent."
            return {"success": False, "message_id": None, "error": err, "provider_response": {"error": err}}
        cleaned_phone = normalize_phone_number(recipient_phone)
        if not cleaned_phone:
            return {"success": False, "message_id": None, "error": "Invalid recipient phone number.",
                    "provider_response": {"error": "Invalid recipient phone number."}}

        tmpl_data = (metadata or {}).get("template")
        if isinstance(tmpl_data, dict) and tmpl_data.get("name") and (tmpl_data.get("language") or {}).get("code"):
            payload = {"to": cleaned_phone, "type": "template", "template": tmpl_data}
        else:
            payload = {"to": cleaned_phone, "type": "text", "text": {"preview_url": False, "body": content}}

        logger.info(f"[WhatsApp] Sending {payload['type']} message to {mask_phone(cleaned_phone)}")
        try:
            result = await MetaClient(self.config).send_message(payload)
            return {"success": True, "message_id": result["wamid"], "recipient": cleaned_phone, "provider_response": {"wa_id": result.get("wa_id")}}
        except MetaApiError as e:
            from app.whatsapp.numbers import mark_auth_failure
            mark_auth_failure(str(self.number["_id"]), e)
            hint = ""
            if e.code == 131047:
                hint = " The customer has not messaged you in the last 24 hours — use an approved template instead."
            return {"success": False, "message_id": None, "error": str(e) + hint, "provider_response": {"error": e.to_dict()}}

    async def get_message_status(self, message_id: str) -> str:
        # Delivery status is only known from webhooks; see webhook_service.
        return "unknown"

    async def validate_credentials(self) -> Dict[str, Any]:
        if not self.config:
            return {"valid": False, "message": "No WhatsApp business number selected."}
        try:
            info = await MetaClient(self.config).get_phone_number()
            return {"valid": True, "message": f"Credentials valid for {info.get('display_phone_number')} ({info.get('verified_name')})"}
        except MetaApiError as e:
            return {"valid": False, "message": str(e)}

    def get_provider_name(self) -> str:
        return "Meta WhatsApp Cloud API"

    def get_provider_type(self) -> str:
        return "meta_cloud"
