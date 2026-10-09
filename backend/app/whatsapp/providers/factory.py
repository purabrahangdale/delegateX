"""
WhatsApp Provider Factory
Returns the correct provider instance based on current automation settings.
The provider (Simulation / Meta Cloud / Maytapi) is a global setting; for Meta Cloud API the
credentials come from the WhatsApp business number the message belongs to.
"""

import os
from typing import Optional

from app.whatsapp.providers.base import WhatsAppProvider
from app.whatsapp.providers.simulation import SimulationProvider
from app.whatsapp.providers.meta_cloud import MetaCloudProvider
from app.whatsapp.providers.maytapi import MaytapiProvider
from app.config.database import automation_settings_collection


def get_provider_type() -> str:
    """'simulation' | 'meta_cloud' | 'maytapi' — the effective provider."""
    settings_doc = automation_settings_collection.find_one() or {}
    provider_type = settings_doc.get("provider")
    if provider_type in ("simulation", "meta_cloud", "maytapi"):
        return provider_type
    from app.whatsapp.numbers import count_numbers
    has_meta = count_numbers() > 0 or bool(os.getenv("META_WHATSAPP_API_TOKEN") and os.getenv("META_WHATSAPP_PHONE_NUMBER_ID"))
    return "meta_cloud" if has_meta else "simulation"


def get_provider(number: Optional[dict] = None) -> WhatsAppProvider:
    """
    Provider for sending through `number`. With Meta Cloud API selected, a number is required —
    the provider never picks a number on its own.
    """
    provider_type = get_provider_type()
    if provider_type == "simulation":
        return SimulationProvider()
    if provider_type == "maytapi":
        return MaytapiProvider(settings=automation_settings_collection.find_one())
    return MetaCloudProvider(number=number)


def get_provider_info() -> dict:
    """Return current provider metadata for display."""
    provider = get_provider()
    return {
        "name": provider.get_provider_name(),
        "type": provider.get_provider_type(),
    }
