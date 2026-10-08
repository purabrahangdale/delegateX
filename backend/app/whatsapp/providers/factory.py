"""
WhatsApp Provider Factory
Returns the correct provider instance based on current automation settings.
"""

from app.whatsapp.providers.base import WhatsAppProvider
from app.whatsapp.providers.simulation import SimulationProvider
from app.whatsapp.providers.meta_cloud import MetaCloudProvider
from app.whatsapp.providers.maytapi import MaytapiProvider
from app.config.database import automation_settings_collection


import os


def get_provider() -> WhatsAppProvider:
    """
    Read current automation settings from MongoDB and return the
    appropriate provider instance.
    
    If Meta credentials exist in MongoDB or environment, returns MetaCloudProvider.
    """
    settings_doc = automation_settings_collection.find_one()
    
    provider_type = settings_doc.get("provider") if settings_doc else None
    
    # Check if Meta credentials exist in settings doc or environment
    has_meta_creds = bool(
        (settings_doc and settings_doc.get("api_key") and settings_doc.get("phone_number_id")) or
        (os.getenv("META_WHATSAPP_API_TOKEN") and os.getenv("META_WHATSAPP_PHONE_NUMBER_ID"))
    )

    if provider_type == "meta_cloud" or (not provider_type and has_meta_creds):
        return MetaCloudProvider(settings=settings_doc)
    elif provider_type == "maytapi":
        return MaytapiProvider(settings=settings_doc)
    elif has_meta_creds and provider_type != "simulation":
        return MetaCloudProvider(settings=settings_doc)
    else:
        return SimulationProvider()


def get_provider_info() -> dict:
    """Return current provider metadata for display."""
    provider = get_provider()
    return {
        "name": provider.get_provider_name(),
        "type": provider.get_provider_type(),
    }
