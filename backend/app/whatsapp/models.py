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
    ACCEPTED = "accepted"  # Meta API returned a wamid; not yet confirmed sent by webhook
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


class ReplySource(str, Enum):
    SIMULATION = "simulation"
    META_WEBHOOK = "meta_webhook"
    MANUAL = "manual"


class ReplyType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    LOCATION = "location"
    BUTTON = "button"
    INTERACTIVE = "interactive"
    REACTION = "reaction"
    UNKNOWN = "unknown"


class WhatsAppReplyFilter(BaseModel):
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    campaign: Optional[str] = None
    template: Optional[str] = None
    contact: Optional[str] = None
    assigned_agent: Optional[str] = None
    reply_type: Optional[str] = None
    source: Optional[str] = None
    mode: Optional[str] = None
    status: Optional[str] = None
    search: Optional[str] = None


# ── Message Models ────────────────────────────────────────────────

class WhatsAppMessageCreate(BaseModel):
    """Payload for sending a new WhatsApp message."""
    recipient_phone: Optional[str] = None
    to: Optional[str] = None
    recipient_name: Optional[str] = "Unknown"
    content: Optional[str] = None
    message: Optional[str] = None
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
    is_active: Optional[bool] = True
    response_buttons: Optional[List[Dict[str, Any]]] = []
    # Meta template fields
    meta_template_name: Optional[str] = None      # lowercase_underscore; derived from name if omitted
    language: Optional[str] = "en_US"
    meta_category: Optional[str] = "UTILITY"      # MARKETING | UTILITY
    header: Optional[Dict[str, Any]] = None       # {"format": "NONE|TEXT|IMAGE|VIDEO|DOCUMENT", "text", "sample_url"}
    footer: Optional[str] = ""
    variable_examples: Optional[Dict[str, str]] = {}  # {"client_name": "John"} — required by Meta review


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
    response_buttons: Optional[List[Dict[str, Any]]] = None
    meta_template_name: Optional[str] = None
    language: Optional[str] = None
    meta_category: Optional[str] = None
    header: Optional[Dict[str, Any]] = None
    footer: Optional[str] = None
    variable_examples: Optional[Dict[str, str]] = None


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
    response_buttons: List[Dict[str, Any]] = []
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


# ── Campaign Models ───────────────────────────────────────────────

class CampaignCreate(BaseModel):
    """Create a draft campaign. Recipients are validated and stored server-side."""
    name: str
    purpose: Optional[str] = ""
    template_id: str
    variable_mapping: Dict[str, Dict[str, Any]] = {}   # slot key → {"source": "field"|"static", "value": str}
    audience_source: str = "contacts"                  # contacts | crm_leads | employees
    audience_label: Optional[str] = None
    recipients: Optional[List[Dict[str, Any]]] = None  # required when audience_source == "contacts"
    timezone: Optional[str] = "UTC"
    client_request_id: Optional[str] = None            # idempotency key from the client (prevents double-create)


class CampaignPreview(BaseModel):
    template_id: str
    variable_mapping: Dict[str, Dict[str, Any]] = {}
    audience_source: str = "contacts"
    recipients: Optional[List[Dict[str, Any]]] = None


class CampaignLaunch(BaseModel):
    confirm_consent: bool = False
    scheduled_at: Optional[str] = None   # ISO-8601 with timezone offset; omitted = send now
    timezone: Optional[str] = None


class AutomationBindingUpdate(BaseModel):
    enabled: bool = False
    template_id: Optional[str] = None
    variable_mapping: Dict[str, Dict[str, Any]] = {}
    recipient_phone: Optional[str] = None


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


# ── Business Number Models ────────────────────────────────────────

class WhatsAppNumberCreate(BaseModel):
    """Add a WhatsApp Business phone number. Secrets are write-only (never returned)."""
    display_name: str
    phone_number: str
    purpose: Optional[str] = ""
    business_portfolio_id: Optional[str] = ""
    waba_id: str
    waba_name: Optional[str] = ""
    phone_number_id: str
    access_token: Optional[str] = None
    copy_token_from: Optional[str] = None          # internal number_id whose stored token to reuse (same system user)
    graph_api_version: Optional[str] = None
    app_id: Optional[str] = ""
    app_secret: Optional[str] = None               # only if this WABA is subscribed by a different Meta app
    allowed_users: Optional[List[str]] = None      # empty = every WhatsApp user may use this number
    is_default: Optional[bool] = False


class WhatsAppNumberUpdate(BaseModel):
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    purpose: Optional[str] = None
    business_portfolio_id: Optional[str] = None
    waba_id: Optional[str] = None
    waba_name: Optional[str] = None
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None             # blank / masked = keep the current token
    graph_api_version: Optional[str] = None
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    allowed_users: Optional[List[str]] = None


class WhatsAppNumberVerify(BaseModel):
    """Configuration to check against Meta before saving. Nothing is stored."""
    number_id: Optional[str] = None                # set when verifying edits of a saved number
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    business_portfolio_id: Optional[str] = None
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None             # blank / masked = stored token of `number_id`
    copy_token_from: Optional[str] = None
    graph_api_version: Optional[str] = None


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


# ── Chat Access Audit Models ──────────────────────────────────────

class ChatAccessLogCreate(BaseModel):
    """Payload sent when a manager opens a conversation."""
    conversation_id: str
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    manager_id: Optional[str] = None


class ChatAccessLog(BaseModel):
    """Full Chat Access Audit Log document as stored in MongoDB."""
    conversation_id: str
    contact_id: Optional[str] = None
    contact_name: str = "Customer"
    contact_phone: str = ""
    manager_id: str = "admin"
    manager_name: str = "Admin User"
    manager_email: str = "admin@delegatex.com"
    chat_opened_at: str = ""
    replied_to_customer: bool = False
    reply_time: Optional[str] = None
    reply_message_id: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    created_at: str = ""


class ChatAccessLogFilter(BaseModel):
    manager: Optional[str] = None
    customer: Optional[str] = None
    phone: Optional[str] = None
    replied: Optional[bool] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    search: Optional[str] = None


