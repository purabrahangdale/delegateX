"""
WhatsApp Automation — Pydantic Models
Defines data schemas for messages, templates, automation logs, and settings.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class MessageStatus(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class MessageType(str, Enum):
    TEXT = "text"
    TEMPLATE = "template"
    IMAGE = "image"
    DOCUMENT = "document"
    AUTOMATION = "automation"


class MessageDirection(str, Enum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class ProviderType(str, Enum):
    SIMULATION = "simulation"
    META_CLOUD = "meta_cloud"
    MAYTAPI = "maytapi"


class AutomationStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    RUNNING = "running"
    SKIPPED = "skipped"


# ── Message Models ────────────────────────────────────────────────

class WhatsAppMessageCreate(BaseModel):
    """Payload for sending a new WhatsApp message."""
    recipient_phone: str
    recipient_name: Optional[str] = "Unknown"
    content: str
    message_type: MessageType = MessageType.TEXT
    template_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class WhatsAppMessage(BaseModel):
    """Full WhatsApp message document as stored in MongoDB."""
    conversation_id: str
    direction: MessageDirection = MessageDirection.OUTBOUND
    sender: str = "DelegateX"
    sender_phone: str = "+91-DELEGATEX"
    recipient: str = "Unknown"
    recipient_phone: str
    content: str
    message_type: MessageType = MessageType.TEXT
    status: MessageStatus = MessageStatus.QUEUED
    template_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    automation_workflow: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    read_at: Optional[str] = None


# ── Template Models ───────────────────────────────────────────────

class WhatsAppTemplateCreate(BaseModel):
    """Payload for creating a new WhatsApp template."""
    name: str
    category: str = "utility"
    content_type: Optional[str] = "text"
    content: str
    variables: Optional[List[str]] = []
    description: Optional[str] = ""
    is_favorite: Optional[bool] = False


class WhatsAppTemplateUpdate(BaseModel):
    """Payload for updating an existing template."""
    name: Optional[str] = None
    category: Optional[str] = None
    content_type: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    is_favorite: Optional[bool] = None
    views: Optional[int] = None
    times_used: Optional[int] = None


class WhatsAppTemplate(BaseModel):
    """Full template document as stored in MongoDB."""
    name: str
    category: str = "utility"
    content_type: str = "text"
    content: str
    variables: List[str] = []
    description: str = ""
    is_active: bool = True
    is_favorite: bool = False
    views: int = 0
    times_used: int = 0
    campaigns_count: int = 0
    messages_sent: int = 0
    delivered_count: int = 0
    read_count: int = 0
    failed_count: int = 0
    reply_count: int = 0
    last_used_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


# ── Automation Log Models ─────────────────────────────────────────

class AutomationLog(BaseModel):
    """A single automation execution log entry."""
    workflow_name: str
    trigger: str
    execution_time: str = ""
    status: AutomationStatus = AutomationStatus.PENDING
    recipient: str = ""
    recipient_phone: str = ""
    message_preview: str = ""
    created_by: str = "system"
    execution_duration_ms: int = 0
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ── Settings Models ───────────────────────────────────────────────

class AutomationSettingsUpdate(BaseModel):
    """Payload for updating automation settings."""
    provider: Optional[ProviderType] = None
    webhook_url: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    phone_number_id: Optional[str] = None
    business_account_id: Optional[str] = None
    is_active: Optional[bool] = None


class AutomationSettings(BaseModel):
    """Full settings document as stored in MongoDB."""
    provider: ProviderType = ProviderType.SIMULATION
    webhook_url: str = ""
    api_url: str = ""
    api_key: str = ""
    phone_number_id: str = ""
    business_account_id: str = ""
    is_active: bool = True
    configured_at: str = ""
    updated_at: str = ""


# ── Global DND Models ─────────────────────────────────────────────

class WhatsAppDNDCreate(BaseModel):
    """Payload for adding a number to Global DND."""
    phone_number: str
    country_code: Optional[str] = "+91"
    reason: Optional[str] = "User Opt-out"  # "User Opt-out", "Manual Block", "Invalid Number", "Spam Complaint"
    source: Optional[str] = "Manual Entry"  # "Inbox Keyword", "CSV Upload", "Manual Entry"
    notes: Optional[str] = None


class WhatsAppDND(BaseModel):
    """Full Global DND document stored in MongoDB."""
    phone_number: str
    country_code: str = "+91"
    reason: str = "User Opt-out"
    source: str = "Manual Entry"
    notes: Optional[str] = None
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""


class WhatsAppDNDBatchCheck(BaseModel):
    """Payload for batch checking phone numbers against DND blocklist."""
    phone_numbers: List[str]

