"""
WhatsApp Provider Factory
Returns the correct provider instance based on current automation settings.
"""

from app.whatsapp.providers.base import WhatsAppProvider
from app.whatsapp.providers.simulation import SimulationProvider
from app.whatsapp.providers.meta_cloud import MetaCloudProvider
from app.whatsapp.providers.maytapi import MaytapiProvider
from app.config.database import automation_settings_collection


def get_provider() -> WhatsAppProvider:
    """
    Read current automation settings from MongoDB and return the
    appropriate provider instance.
    
    Defaults to SimulationProvider if no settings are configured.
    """
    settings_doc = automation_settings_collection.find_one()
    
    if not settings_doc:
        return SimulationProvider()
    
    provider_type = settings_doc.get("provider", "simulation")
    
    if provider_type == "meta_cloud":
        return MetaCloudProvider(settings=settings_doc)
    elif provider_type == "maytapi":
        return MaytapiProvider(settings=settings_doc)
    else:
        return SimulationProvider()


def get_provider_info() -> dict:
    """Return current provider metadata for display."""
    provider = get_provider()
    return {
        "name": provider.get_provider_name(),
        "type": provider.get_provider_type(),
    }
