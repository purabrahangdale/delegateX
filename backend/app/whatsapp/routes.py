"""
WhatsApp Automation — FastAPI Routes
All WhatsApp API endpoints for dashboard, inbox, templates, logs, and settings.

Every number-specific endpoint depends on `number_scope`: the business number named by the
`X-WhatsApp-Number-Id` header (or the default number when absent), validated server-side for existence
and user access. Queries are filtered by that number and records of other numbers answer 404.
"""

import os
import hmac
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Body
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime


from app.whatsapp.models import (
    WhatsAppMessageCreate,
    WhatsAppTemplateCreate,
    WhatsAppTemplateUpdate,
    AutomationSettingsUpdate,
    CampaignCreate,
    CampaignPreview,
    CampaignLaunch,
    AutomationBindingUpdate,
    WhatsAppNumberCreate,
    WhatsAppNumberUpdate,
    WhatsAppNumberVerify,
)
from app.whatsapp.repository import (
    MessageRepository,
    TemplateRepository,
    AutomationLogRepository,
    SettingsRepository,
)
from app.whatsapp.services import message_service
from app.whatsapp.services import template_service
from app.whatsapp.services import automation_service
from app.whatsapp.services import campaign_service
from app.whatsapp.services import webhook_service
from app.whatsapp.services.scheduler_service import get_scheduler_status
from app.whatsapp.providers.factory import get_provider_info
from app.whatsapp.meta_api import MetaApiError, MetaClient, load_config
from app.whatsapp import numbers as number_registry
from app.whatsapp.numbers import NumberError, NumberScope

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def _number_http_error(e: NumberError) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail=e.to_detail())


def number_scope(request: Request) -> NumberScope:
    """Resolve and authorize the business number this request operates on (never a silent fallback)."""
    requested = request.headers.get("X-WhatsApp-Number-Id") or request.query_params.get("number_id")
    try:
        return number_registry.resolve_scope(requested, _user(request))
    except NumberError as e:
        raise _number_http_error(e)


# ═══════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/dashboard/stats")
async def get_dashboard_stats(scope: NumberScope = Depends(number_scope)):
    """Get aggregated WhatsApp automation dashboard statistics for the selected number."""
    stats = message_service.get_dashboard_stats(scope.match())
    scheduler_status = get_scheduler_status()
    provider_info = get_provider_info()
    
    return {
        **stats,
        "scheduler": scheduler_status,
        "provider": provider_info,
        "number_id": scope.id,
    }


# ═══════════════════════════════════════════════════════════════════
# INBOX / MESSAGES
# ═══════════════════════════════════════════════════════════════════

@router.get("/messages")
async def get_messages(
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    status: Optional[str] = None,
    direction: Optional[str] = None,
    scope: NumberScope = Depends(number_scope),
):
    """Get all WhatsApp messages of the selected number with optional filters."""
    filters = scope.match()
    if status:
        filters["status"] = status
    if direction:
        filters["direction"] = direction
    
    messages = MessageRepository.get_all(limit=limit, skip=skip, filters=filters if filters else None)
    total = MessageRepository.count(filters if filters else None)
    
    return {
        "messages": messages,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.get("/messages/conversations")
async def get_conversations(scope: NumberScope = Depends(number_scope)):
    """Get conversation list for inbox sidebar (selected number only)."""
    conversations = MessageRepository.get_conversations(scope.match())
    return {"conversations": conversations}


@router.get("/messages/conversation/{conversation_id}")
async def get_conversation_messages(conversation_id: str, scope: NumberScope = Depends(number_scope)):
    """Get all messages of a conversation with the selected number."""
    messages = MessageRepository.find_by_conversation(conversation_id, scope.match())
    return {
        "conversation_id": conversation_id,
        "messages": messages,
        "total": len(messages),
    }


@router.post("/messages/send")
async def send_message(payload: WhatsAppMessageCreate, scope: NumberScope = Depends(number_scope)):
    """Send a new WhatsApp message from the selected number via the configured provider."""
    recipient_phone = (payload.to or payload.recipient_phone or "").strip()
    content = (payload.message or payload.content or "").strip()

    if not recipient_phone:
        raise HTTPException(status_code=400, detail="Recipient phone number ('to' or 'recipient_phone') is required.")
    if not content:
        raise HTTPException(status_code=400, detail="Message content ('message' or 'content') is required.")

    try:
        message = await message_service.send_message(
            recipient_phone=recipient_phone,
            content=content,
            recipient_name=payload.recipient_name or "Contact",
            message_type=payload.message_type.value,
            template_id=payload.template_id,
            metadata=payload.metadata,
            number=scope.number,
        )
        return {
            "success": True,
            "message": "Message sent successfully",
            "message_id": message.get("wamid") or str(message.get("_id")),
            "data": message
        }
    except NumberError as e:
        raise _number_http_error(e)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/messages/simulate-reply")
async def simulate_reply(payload: dict, scope: NumberScope = Depends(number_scope)):
    """Simulate an incoming WhatsApp message (demo mode)."""
    sender_phone = payload.get("sender_phone", "+91-0000000000")
    sender_name = payload.get("sender_name", "Customer")
    content = payload.get("content", "Hello")
    
    try:
        # Save incoming message
        incoming = await message_service.simulate_incoming_message(
            sender_phone=sender_phone,
            sender_name=sender_name,
            content=content,
            number=scope.number,
        )
        
        # Trigger AI intent detection and auto-routing
        response = await automation_service.detect_intent_and_route(incoming)
        
        return {
            "message": "Reply simulated successfully",
            "incoming": incoming,
            "auto_response": response,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════════════════════════

def _user(request: Request) -> Optional[str]:
    """Acting user as reported by the ERP frontend (the backend has no session auth of its own)."""
    return request.headers.get("X-User-Email") or None


def _meta_http_error(e: MetaApiError) -> HTTPException:
    status = 502 if (e.http_status or 0) >= 500 or e.http_status is None else 400
    return HTTPException(status_code=status, detail={"message": str(e), "meta_error": e.to_dict()})


def _template_or_404(template_id: str, scope: NumberScope) -> dict:
    """A template is visible only to numbers of its own WABA."""
    tmpl = TemplateRepository.find_by_id(template_id)
    if not template_service.template_in_scope(tmpl, scope.number):
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl


@router.get("/templates")
async def get_templates(
    active_only: bool = False,
    content_type: Optional[str] = None,
    category: Optional[str] = None,
    name: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    scope: NumberScope = Depends(number_scope),
):
    """Get the selected number's WABA templates with optional filtering."""
    filters = {}
    if content_type:
        filters["content_types"] = [c.strip() for c in content_type.split(",") if c.strip()]
    if category:
        filters["categories"] = [c.strip() for c in category.split(",") if c.strip()]
    if name:
        filters["names"] = [n.strip() for n in name.split(",") if n.strip()]
    if search:
        filters["search"] = search.strip()
    if status:
        filters["statuses"] = [s.strip() for s in status.split(",") if s.strip()]

    templates = template_service.get_all_templates(active_only=active_only, filters=filters if filters else None, number=scope.number)
    return {"templates": templates}


@router.get("/templates/sendable")
async def get_sendable_templates(scope: NumberScope = Depends(number_scope)):
    """Templates of the selected number's WABA approved by Meta, with the parameter slots needed to send them."""
    return {"templates": template_service.get_sendable_templates(scope.number)}


@router.post("/templates/sync")
async def sync_templates(scope: NumberScope = Depends(number_scope)):
    """Pull all templates and their real statuses from the selected number's WhatsApp Business Account."""
    try:
        return await template_service.sync_templates_from_meta(scope.number)
    except NumberError as e:
        raise _number_http_error(e)
    except MetaApiError as e:
        raise _meta_http_error(e)


@router.get("/templates/names")
async def get_template_names(scope: NumberScope = Depends(number_scope)):
    """Get dynamic list of template names of the selected number's WABA."""
    names = template_service.get_template_names(scope.number)
    return {"names": names}


@router.get("/templates/insights")
async def get_template_insights(scope: NumberScope = Depends(number_scope)):
    """Get comprehensive analytics, KPIs, chart metrics, and performance rankings for templates."""
    insights = template_service.get_template_insights(scope.number)
    return insights


@router.post("/templates/{template_id}/favorite")
async def toggle_template_favorite(template_id: str, scope: NumberScope = Depends(number_scope)):
    """Toggle template favorite status."""
    _template_or_404(template_id, scope)
    tmpl = template_service.toggle_template_favorite(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Favorite status updated", "template": tmpl}


@router.post("/templates/{template_id}/view")
async def increment_template_view(template_id: str, scope: NumberScope = Depends(number_scope)):
    """Increment view count for a template."""
    _template_or_404(template_id, scope)
    tmpl = template_service.increment_template_views(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "View count incremented", "template": tmpl}


@router.get("/templates/{template_id}")
async def get_template(template_id: str, scope: NumberScope = Depends(number_scope)):
    """Get a single template by ID."""
    _template_or_404(template_id, scope)
    template = template_service.get_template_by_id(template_id, scope.number)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates")
async def create_template(payload: WhatsAppTemplateCreate, scope: NumberScope = Depends(number_scope)):
    """Save a new template as a local DRAFT in the selected number's WABA (use /submit to send it to Meta)."""
    template_data = payload.dict()
    template = template_service.create_template(template_data, scope.number)
    return {"message": "Template saved as draft", "template": template}


@router.put("/templates/{template_id}")
async def update_template(template_id: str, payload: WhatsAppTemplateUpdate, scope: NumberScope = Depends(number_scope)):
    """Update an existing WhatsApp template."""
    _template_or_404(template_id, scope)
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        template = template_service.update_template(template_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated successfully", "template": template}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, local_only: bool = False, scope: NumberScope = Depends(number_scope)):
    """Delete a template. If it exists on Meta it is deleted there first (unless local_only=true)."""
    _template_or_404(template_id, scope)
    try:
        success = await template_service.delete_template(template_id, local_only=local_only, number=scope.number)
    except NumberError as e:
        raise _number_http_error(e)
    except MetaApiError as e:
        raise _meta_http_error(e)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}


@router.post("/templates/{template_id}/validate")
async def validate_template(template_id: str, scope: NumberScope = Depends(number_scope)):
    """Check a template against Meta's rules without submitting it."""
    _template_or_404(template_id, scope)
    try:
        return template_service.validate_template(template_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/{template_id}/submit")
async def submit_template(template_id: str, scope: NumberScope = Depends(number_scope)):
    """Submit (or resubmit after edits) a template to the selected number's WABA for review."""
    _template_or_404(template_id, scope)
    try:
        template = await template_service.submit_template(template_id, scope.number)
    except NumberError as e:
        raise _number_http_error(e)
    except LookupError:
        raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except MetaApiError as e:
        raise _meta_http_error(e)
    return {"message": f"Submitted to Meta — status: {template.get('status')}", "template": template}


@router.post("/templates/seed")
async def seed_templates():
    """Seed default WhatsApp templates."""
    created = template_service.seed_default_templates()
    return {
        "message": f"Seeded {len(created)} default templates",
        "templates": created,
    }


# ═══════════════════════════════════════════════════════════════════
# AUTOMATION LOGS
# ═══════════════════════════════════════════════════════════════════

@router.get("/logs")
async def get_automation_logs(
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    status: Optional[str] = None,
    workflow: Optional[str] = None,
    scope: NumberScope = Depends(number_scope),
):
    """Get automation execution logs of the selected number with optional filters."""
    filters = scope.match()
    if status:
        filters["status"] = status
    if workflow:
        filters["workflow_name"] = workflow
    
    logs = AutomationLogRepository.get_all(limit=limit, skip=skip, filters=filters if filters else None)
    total = AutomationLogRepository.count(filters if filters else None)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


# ═══════════════════════════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════════════════════════

def _mask_secret(value: str) -> str:
    if not value:
        return ""
    return "•" * 8 + value[-4:] if len(value) > 8 else "•" * len(value)


CREDENTIAL_FIELDS = ("api_url", "api_key", "phone_number_id", "business_account_id")


@router.get("/settings")
async def get_settings(scope: NumberScope = Depends(number_scope)):
    """
    Global WhatsApp settings (provider, webhook URL) plus the selected number's effective Meta
    configuration. Access tokens are never returned to the browser.
    """
    settings = SettingsRepository.get()
    provider_info = get_provider_info()
    base = load_config()
    settings.pop("automation_bindings", None)
    settings.pop("last_template_sync", None)
    settings["api_key"] = _mask_secret(settings.get("api_key", ""))
    number = number_registry.serialize(scope.number) if scope.number else None
    settings["api_key_configured"] = bool(number and number["token_configured"])
    settings["effective"] = {
        "number_id": scope.id,
        "phone_number_id": (number or {}).get("phone_number_id", ""),
        "business_account_id": (number or {}).get("waba_id", ""),
        "graph_api_version": (number or {}).get("graph_api_version", base.graph_version),
        "graph_api_url": (number or {}).get("graph_api_url", ""),
        "app_secret_configured": bool(base.app_secret) or bool(number and number["app_secret_configured"]),
        "verify_token_configured": bool(base.verify_token),
    }
    settings["number"] = number
    settings["numbers_configured"] = number_registry.count_numbers()
    return {**settings, "provider_info": provider_info}


@router.put("/settings")
async def update_settings(payload: AutomationSettingsUpdate):
    """
    Update global WhatsApp settings (provider, webhook URL, active flag). Meta credentials are configured
    per business number (/api/whatsapp/numbers). Before any number exists, credentials saved here are
    migrated into the first number, as the single-number settings were before.
    """
    update_data = {k: v for k, v in payload.dict().items() if v is not None}

    # Convert enum to string for MongoDB
    if "provider" in update_data:
        update_data["provider"] = update_data["provider"].value
    # The UI shows a masked token; an unchanged masked value must not overwrite the real one.
    if "api_key" in update_data and "•" in update_data["api_key"]:
        update_data.pop("api_key")
    has_credentials = any(update_data.get(k) for k in CREDENTIAL_FIELDS)
    if has_credentials and number_registry.count_numbers() > 0:
        raise HTTPException(status_code=400, detail="Meta credentials are configured per business number. Edit the number under WhatsApp Business Numbers.")

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    settings = SettingsRepository.update(update_data)
    if has_credentials:
        number_registry.migrate_legacy_configuration()
    settings.pop("automation_bindings", None)
    settings.pop("last_template_sync", None)
    settings["api_key"] = _mask_secret(settings.get("api_key", ""))
    return {"message": "Settings updated successfully", "settings": settings}


# ═══════════════════════════════════════════════════════════════════
# WHATSAPP BUSINESS NUMBERS (multi-number / multi-WABA configuration)
# ═══════════════════════════════════════════════════════════════════

def _number_out(doc: dict) -> dict:
    out = number_registry.serialize(doc)
    stats = webhook_service.event_stats(doc)
    out["webhook"] = {"last_event_at": stats["last_event_at"], "last_inbound_message_at": stats["last_inbound_message_at"],
                      "last_status_event_at": stats["last_status_event_at"]}
    return out


def _number_call(fn, *args):
    try:
        return fn(*args)
    except NumberError as e:
        raise _number_http_error(e)


@router.get("/numbers")
async def list_numbers(request: Request):
    """Business numbers the current user may use (credentials are never included)."""
    user = _user(request)
    docs = [d for d in number_registry.all_numbers() if number_registry.can_access(d, user)]
    default = number_registry.default_number()
    return {
        "numbers": [_number_out(d) for d in docs],
        "default_number_id": str(default["_id"]) if default and number_registry.can_access(default, user) else None,
        "can_manage": number_registry.is_admin(user),
        "purposes": number_registry.PURPOSES,
        "graph_api_default_version": load_config().graph_version,
    }


@router.get("/numbers/legacy/unassigned")
async def unassigned_legacy_records(request: Request):
    """Records created before multi-number support whose number could not be determined."""
    _number_call(number_registry.require_admin, _user(request))
    return number_registry.unassigned_counts()


@router.post("/numbers/verify")
async def verify_number(payload: WhatsAppNumberVerify, request: Request):
    """Check a number configuration against the Meta Graph API without saving it.
    `number_id` verifies edits of a saved number (its stored token is used when none is entered)."""
    data = payload.dict()
    number_id = data.pop("number_id", None)
    try:
        return await number_registry.verify_configuration(data, _user(request), number_id)
    except NumberError as e:
        raise _number_http_error(e)


@router.post("/numbers")
async def create_number(payload: WhatsAppNumberCreate, request: Request):
    """Add a number. It is verified against Meta here (the client's verification is not trusted) and
    saved only when Meta confirms the token, phone number and WABA."""
    data, user = payload.dict(), _user(request)
    try:
        verification = await number_registry.verify_configuration(data, user)
    except NumberError as e:
        raise _number_http_error(e)
    if verification["status"] in ("incomplete", "duplicate"):
        raise HTTPException(status_code=400, detail={"message": verification["message"], "code": "validation"})
    if not verification["ok"]:
        raise HTTPException(status_code=400, detail={"message": f"Not saved — Meta verification failed. {verification['message']}",
                                                     "code": "verification_failed", "verification": verification})
    doc = _number_call(number_registry.create_number, data, user, verification)
    return {"message": "WhatsApp number verified and added", "number": _number_out(doc), "verification": verification}


@router.get("/numbers/{number_id}")
async def get_number(number_id: str, request: Request):
    doc = number_registry.get_number(number_id)
    if not doc or not number_registry.can_access(doc, _user(request)):
        raise HTTPException(status_code=404, detail="WhatsApp number not found")
    return _number_out(doc)


@router.put("/numbers/{number_id}")
async def update_number(number_id: str, payload: WhatsAppNumberUpdate, request: Request):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    doc = _number_call(number_registry.update_number, number_id, data, _user(request))
    return {"message": "WhatsApp number updated", "number": _number_out(doc)}


@router.post("/numbers/{number_id}/test")
async def test_number_connection(number_id: str, request: Request):
    """Validate the number's credentials against the Meta Graph API (real request; result is stored)."""
    try:
        return await number_registry.test_connection(number_id, _user(request))
    except NumberError as e:
        raise _number_http_error(e)


@router.post("/numbers/{number_id}/activate")
async def activate_number(number_id: str, request: Request):
    return {"number": _number_out(_number_call(number_registry.set_active, number_id, True, _user(request)))}


@router.post("/numbers/{number_id}/deactivate")
async def deactivate_number(number_id: str, request: Request):
    return {"number": _number_out(_number_call(number_registry.set_active, number_id, False, _user(request)))}


@router.post("/numbers/{number_id}/default")
async def make_default_number(number_id: str, request: Request):
    return {"number": _number_out(_number_call(number_registry.set_default, number_id, _user(request)))}


@router.delete("/numbers/{number_id}")
async def remove_number(number_id: str, request: Request):
    """Remove a number configuration. Its messages and campaigns are kept (and are never reassigned)."""
    return _number_call(number_registry.remove_number, number_id, _user(request))


@router.post("/numbers/{number_id}/assign-legacy")
async def assign_legacy_records(number_id: str, request: Request, payload: dict = Body(default={})):
    """Explicitly attach every record without a number (pre-upgrade history) to this number."""
    if not payload.get("confirm"):
        raise HTTPException(status_code=400, detail="Confirmation required: send {\"confirm\": true}.")
    return {"assigned": _number_call(number_registry.assign_unassigned_records, number_id, _user(request))}


# ═══════════════════════════════════════════════════════════════════
# DIAGNOSTICS (credentials, WABA subscription, webhook health)
# ═══════════════════════════════════════════════════════════════════

@router.get("/diagnostics")
async def get_diagnostics(request: Request, scope: NumberScope = Depends(number_scope)):
    """Health of the selected number: credentials, WABA membership, webhook subscription and events."""
    public_url = (os.getenv("BACKEND_PUBLIC_URL") or str(request.base_url)).rstrip("/")
    if not scope.number:
        base = load_config()
        return {
            "callback_url": f"{public_url}/api/whatsapp/webhook",
            "graph_api_version": base.graph_version,
            "number": None,
            "phone_number": None,
            "checks": [{"key": "config", "label": "Business number configured", "ok": False,
                        "detail": "No WhatsApp business number is configured yet.",
                        "action": "Add a number under WhatsApp Business Numbers."}],
            "webhook": webhook_service.event_stats(),
            "worker": campaign_service.worker_status(),
            "last_template_sync": None,
            "required_webhook_fields": ["messages", "message_template_status_update", "template_category_update"],
        }
    config = scope.config()
    client = MetaClient(config)
    checks = []

    def add(key, label, ok, detail, action=None):
        checks.append({"key": key, "label": label, "ok": ok, "detail": detail, "action": action})

    missing = config.missing("access_token", "phone_number_id", "waba_id")
    add("config", "Credentials configured", not missing,
        "Access token, phone number ID and WABA ID are set." if not missing else f"Missing: {', '.join(missing)}",
        None if not missing else "Edit this number under WhatsApp Business Numbers and fill in the missing values.")

    phone_info = None
    if not config.missing("access_token", "phone_number_id"):
        try:
            phone_info = await client.get_phone_number()
            add("phone", "Phone number reachable", True,
                f"{phone_info.get('display_phone_number')} — {phone_info.get('verified_name')} (quality: {phone_info.get('quality_rating')}, tier: {phone_info.get('messaging_limit_tier')})")
        except MetaApiError as e:
            add("phone", "Phone number reachable", False, str(e),
                "Check that the access token is valid (not expired) and has whatsapp_business_messaging permission.")

    if not config.missing("access_token", "waba_id"):
        try:
            numbers = await client.list_phone_numbers()
            belongs = any(n.get("id") == config.phone_number_id for n in numbers)
            add("phone_in_waba", "Phone number belongs to WABA", belongs,
                "Configured phone number ID is registered on this WABA." if belongs else f"Phone number ID {config.phone_number_id} was not found on WABA {config.waba_id}.",
                None if belongs else "Use the phone number ID shown in WhatsApp Manager → API Setup for this WABA.")
        except MetaApiError as e:
            add("phone_in_waba", "Phone number belongs to WABA", False, str(e), "Token needs whatsapp_business_management permission.")
        try:
            apps = await client.get_subscribed_apps()
            add("subscription", "App subscribed to WABA webhooks", bool(apps),
                ", ".join((a.get("whatsapp_business_api_data") or {}).get("name", "app") for a in apps) or "No apps subscribed — status and message webhooks will not be delivered.",
                None if apps else "Click 'Subscribe app to WABA' below.")
        except MetaApiError as e:
            add("subscription", "App subscribed to WABA webhooks", False, str(e))

    mode = webhook_service.signature_mode()
    add("app_secret", "Webhook signature validation", mode == "enforced",
        {"enforced": "META_APP_SECRET set — X-Hub-Signature-256 is verified on every POST.",
         "disabled_insecure": "WHATSAPP_WEBHOOK_ALLOW_UNSIGNED=true — webhook POSTs are NOT authenticated (development only).",
         "missing_secret": "META_APP_SECRET not set — webhook POSTs are rejected (503) until it is configured."}[mode],
        None if mode == "enforced" else "Copy App Secret from Meta App Dashboard → App settings → Basic into META_APP_SECRET.")
    add("verify_token", "Webhook verify token", bool(config.verify_token),
        "META_WHATSAPP_VERIFY_TOKEN is set." if config.verify_token else "No verify token configured — Meta webhook verification will fail.",
        None if config.verify_token else "Set META_WHATSAPP_VERIFY_TOKEN and use the same value in the Meta dashboard.")

    stats = webhook_service.event_stats(scope.number)
    add("status_events", "Delivery status webhooks received", bool(stats["last_status_event_at"]),
        f"Last status event: {stats['last_status_event_at']}" if stats["last_status_event_at"] else
        "No delivery status event has been received yet. Verification alone does not prove status webhooks work — send a test message and check again.",
        None if stats["last_status_event_at"] else "In the Meta App Dashboard → WhatsApp → Configuration, subscribe the 'messages' webhook field.")

    fresh = number_registry.get_number(scope.id) or scope.number
    return {
        "callback_url": f"{public_url}/api/whatsapp/webhook",
        "graph_api_version": config.graph_version,
        "number": number_registry.serialize(fresh),
        "phone_number": phone_info,
        "checks": checks,
        "webhook": stats,
        "worker": campaign_service.worker_status(),
        "last_template_sync": fresh.get("last_template_sync"),
        "required_webhook_fields": ["messages", "message_template_status_update", "template_category_update"],
    }


@router.post("/diagnostics/subscribe")
async def subscribe_app_to_waba(scope: NumberScope = Depends(number_scope)):
    """Subscribe the Meta app (owning the selected number's access token) to that number's WABA webhooks."""
    try:
        result = await MetaClient(scope.config()).subscribe_app()
    except NumberError as e:
        raise _number_http_error(e)
    except MetaApiError as e:
        raise _meta_http_error(e)
    return {"message": "App subscribed to WABA webhooks", "result": result}


@router.post("/diagnostics/test-message")
async def send_test_template(request: Request, payload: dict = Body(...), scope: NumberScope = Depends(number_scope)):
    """Send one approved template from the selected number to a test number through the real queue."""
    phone = (payload.get("phone") or "").strip()
    template_id = payload.get("template_id")
    if not phone or not template_id:
        raise HTTPException(status_code=400, detail="phone and template_id are required")
    import uuid
    problem = number_registry.sending_problem(scope.number)
    if problem:
        raise HTTPException(status_code=409, detail={"message": problem, "code": "number_unavailable"})
    try:
        job = campaign_service.enqueue_single(
            template_id=template_id,
            mapping=payload.get("variable_mapping") or {},
            recipient={"name": payload.get("name") or "Test recipient", "phone": phone},
            idempotency_key=f"test:{payload.get('client_request_id') or uuid.uuid4().hex}",
            workflow=f"Test message ({_user(request) or 'admin'})",
            number=scope.number,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"job": job}


@router.get("/send-jobs/{job_id}")
async def get_send_job(job_id: str, scope: NumberScope = Depends(number_scope)):
    from bson import ObjectId
    from app.config.database import whatsapp_campaign_recipient_collection
    from app.whatsapp.repository import _serialize_doc
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=404, detail="Not found")
    doc = whatsapp_campaign_recipient_collection.find_one({"_id": ObjectId(job_id), **scope.match()}, {"send_components": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return _serialize_doc(doc)


# ═══════════════════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════════════════

def _campaign_or_404(campaign_id: str, scope: NumberScope) -> dict:
    """A campaign is visible only through the number it belongs to."""
    from bson import ObjectId
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
    camp = campaign_service.get_campaign(campaign_id)
    if not camp or (camp.get("number_id") or None) != scope.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return camp


@router.post("/campaigns/preview")
async def preview_campaign(payload: CampaignPreview, scope: NumberScope = Depends(number_scope)):
    """Validate recipients and render sample messages without saving anything."""
    try:
        recipients = campaign_service.load_audience(payload.audience_source, payload.recipients)
        return campaign_service.preview_campaign(payload.template_id, payload.variable_mapping, recipients, number=scope.number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns")
async def create_campaign(payload: CampaignCreate, request: Request, scope: NumberScope = Depends(number_scope)):
    try:
        return campaign_service.create_campaign(payload.dict(), user=_user(request), number=scope.number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/campaigns")
async def list_campaigns(
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    status: Optional[str] = None,
    search: Optional[str] = None,
    scope: NumberScope = Depends(number_scope),
):
    return campaign_service.list_campaigns(limit=limit, skip=skip, status=status, search=search, scope=scope.match())


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, scope: NumberScope = Depends(number_scope)):
    return _campaign_or_404(campaign_id, scope)


@router.get("/campaigns/{campaign_id}/recipients")
async def get_campaign_recipients(
    campaign_id: str,
    state: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    scope: NumberScope = Depends(number_scope),
):
    _campaign_or_404(campaign_id, scope)
    return campaign_service.list_recipients(campaign_id, state=state, search=search, limit=limit, skip=skip)


@router.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(campaign_id: str, payload: CampaignLaunch, request: Request, scope: NumberScope = Depends(number_scope)):
    _campaign_or_404(campaign_id, scope)
    try:
        return campaign_service.launch_campaign(campaign_id, payload.dict(), user=_user(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: str, request: Request, scope: NumberScope = Depends(number_scope)):
    _campaign_or_404(campaign_id, scope)
    try:
        return campaign_service.cancel_campaign(campaign_id, user=_user(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, scope: NumberScope = Depends(number_scope)):
    _campaign_or_404(campaign_id, scope)
    return campaign_service.pause_campaign(campaign_id)


@router.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str, scope: NumberScope = Depends(number_scope)):
    _campaign_or_404(campaign_id, scope)
    return campaign_service.resume_campaign(campaign_id)


@router.post("/campaigns/{campaign_id}/retry-failed")
async def retry_failed_recipients(campaign_id: str, scope: NumberScope = Depends(number_scope)):
    """Re-queue failed recipients that Meta never accepted (no wamid) — cannot create duplicates."""
    _campaign_or_404(campaign_id, scope)
    try:
        return campaign_service.retry_failed(campaign_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, scope: NumberScope = Depends(number_scope)):
    """Delete a draft campaign. Launched campaigns are kept as history."""
    from bson import ObjectId
    from app.config.database import whatsapp_campaign_collection, whatsapp_campaign_recipient_collection
    camp = _campaign_or_404(campaign_id, scope)
    if camp["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be deleted. Cancel it instead to stop pending messages.")
    whatsapp_campaign_recipient_collection.delete_many({"campaign_id": campaign_id, "state": {"$in": ["draft", "invalid", "skipped"]}})
    whatsapp_campaign_collection.delete_one({"_id": ObjectId(campaign_id), "status": "draft"})
    return {"message": "Draft campaign deleted"}


# ═══════════════════════════════════════════════════════════════════
# AUTOMATION RULES (template bindings) & EXECUTION LOG
# ═══════════════════════════════════════════════════════════════════

@router.get("/automations")
async def list_automations(scope: NumberScope = Depends(number_scope)):
    return {"workflows": automation_service.describe_workflows(scope.number), "number_id": scope.id}


@router.put("/automations/{workflow_key}")
async def save_automation_binding(workflow_key: str, payload: AutomationBindingUpdate, scope: NumberScope = Depends(number_scope)):
    try:
        binding = automation_service.save_binding(workflow_key, payload.dict(), scope.number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Automation saved", "binding": binding}


@router.get("/automations/runs")
async def list_automation_runs(
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    workflow: Optional[str] = None,
    status: Optional[str] = None,
    scope: NumberScope = Depends(number_scope),
):
    return automation_service.list_runs(limit=limit, skip=skip, workflow=workflow, status=status, scope=scope.match())


# ═══════════════════════════════════════════════════════════════════
# MANUAL AUTOMATION TRIGGERS
# ═══════════════════════════════════════════════════════════════════

LEGACY_WORKFLOW_ALIASES = {
    "welcome-message": "welcome_message",
    "followup-reminder": "followup_reminder",
    "meeting-reminder": "meeting_reminder",
    "task-assigned": "task_assigned",
    "daily-report": "daily_lead_report",
    "daily-reply-report": "daily_reply_report",
}


@router.post("/automations/trigger/{workflow_name}")
async def trigger_automation(workflow_name: str, payload: dict = None, scope: NumberScope = Depends(number_scope)):
    """Manually run an automation for the selected number only. Bulk sends must use the campaign endpoints."""
    payload = payload or {}
    key = LEGACY_WORKFLOW_ALIASES.get(workflow_name, workflow_name)
    only = [scope.number] if scope.number else []

    try:
        if workflow_name in ("campaign", "bulk-message"):
            raise HTTPException(status_code=410, detail="Bulk sending moved to the campaign builder: POST /api/whatsapp/campaigns then /launch.")
        if key == "welcome_message":
            if not payload.get("lead"):
                raise HTTPException(status_code=400, detail="Welcome Message runs per lead; pass {'lead': {...}}.")
            result = await automation_service.trigger_welcome_message(payload["lead"], numbers=only)
        elif key == "followup_reminder":
            result = await automation_service.trigger_followup_reminders(numbers=only)
        elif key == "meeting_reminder":
            result = await automation_service.trigger_meeting_reminders(numbers=only)
        elif key == "task_assigned":
            if not payload.get("task"):
                raise HTTPException(status_code=400, detail="Task notification runs per task; pass {'task': {...}}.")
            result = await automation_service.trigger_task_assignment_notification(payload["task"], numbers=only)
        elif key == "daily_lead_report":
            result = await automation_service.trigger_daily_lead_report(numbers=only)
        elif key == "daily_reply_report":
            result = await automation_service.trigger_daily_reply_report(numbers=only)
        elif workflow_name == "auto-reply":
            if not payload.get("message"):
                raise HTTPException(status_code=400, detail="Message data required")
            result = await automation_service.trigger_auto_reply({**payload["message"], "number_id": scope.id})
        elif workflow_name == "ai-faq":
            if not payload.get("message"):
                raise HTTPException(status_code=400, detail="Message data required")
            result = await automation_service.trigger_ai_faq_bot({**payload["message"], "number_id": scope.id})
        else:
            raise HTTPException(status_code=404, detail=f"Unknown automation '{workflow_name}'")

        if result is None or result == []:
            binding = automation_service.get_bindings(scope.number).get(key) or {}
            note = "Automation is disabled — bind an approved template first." if not binding.get("enabled") else "No matching records to notify."
            return {"message": note, "result": result}
        return {"message": f"Workflow '{workflow_name}' executed", "result": result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ═══════════════════════════════════════════════════════════════════
# ENTERPRISE AI WRITING ASSISTANT
# ═══════════════════════════════════════════════════════════════════

@router.post("/ai-assistant")
async def process_ai_assistant(payload: dict):
    """
    Process AI Writing Assistant requests for WhatsApp Templates using Gemini 2.5 Flash.
    Supports fix_grammar, rewrite, friendly, formal, shorten, expand, translate,
    validate_variables, and compliance_check.
    Guarantees strict placeholder protection (e.g. {{client_name}}).
    """
    action = payload.get("action")
    content = payload.get("content", "").strip()
    target_language = payload.get("target_language", "English")

    if not action:
        raise HTTPException(status_code=400, detail="AI action is required.")
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required.")

    from app.chatbot.gemini_service import GeminiService
    gemini = GeminiService()

    system_instruction = (
        "You are an Enterprise AI Writing Assistant for WhatsApp business message templates.\n"
        "CRITICAL RULE 1: You MUST preserve all Mustache variable placeholders (e.g. {{client_name}}, {{assigned_to}}, {{meeting_date}}, {{task_title}}, {{invoice_no}}, etc.) EXACTLY as they appear in the original text. Do NOT change their spelling, capitalization, or remove curly braces.\n"
        "CRITICAL RULE 2: Return valid JSON in your response containing the fields: 'suggested_content' (string), 'changes_made' (array of brief strings describing changes), and 'warnings' (array of warning strings if any).\n"
        "Format your output strictly as a JSON object without markdown block ticks if possible, or inside standard json code block."
    )

    action_prompts = {
        "fix_grammar": (
            f"Correct all grammar, spelling, capitalization, and punctuation errors in the message below while preserving the exact meaning and all placeholders.\n\n"
            f"Original Message:\n{content}"
        ),
        "rewrite": (
            f"Rewrite the message below into a clear, professional, and elegant business WhatsApp message. Improve tone, readability, and formatting. Do NOT modify any placeholders.\n\n"
            f"Original Message:\n{content}"
        ),
        "friendly": (
            f"Rewrite the message below in a warm, polite, and friendly conversational tone suitable for WhatsApp. Do NOT modify any placeholders.\n\n"
            f"Original Message:\n{content}"
        ),
        "formal": (
            f"Rewrite the message below using highly formal, respectful corporate business language. Do NOT modify any placeholders.\n\n"
            f"Original Message:\n{content}"
        ),
        "shorten": (
            f"Shorten the message below to be concise and direct while retaining core meaning and all placeholders.\n\n"
            f"Original Message:\n{content}"
        ),
        "expand": (
            f"Expand the message below with appropriate professional detail, courteous framing, and clear call to action while retaining all placeholders.\n\n"
            f"Original Message:\n{content}"
        ),
        "translate": (
            f"Translate the message below accurately into {target_language}. Keep all Mustache variable placeholders ({{...}}) in English and completely untouched.\n\n"
            f"Original Message:\n{content}"
        ),
        "validate_variables": (
            f"Analyze the placeholders in the message below. Check for broken braces (e.g. {{name or name}}), missing closing braces, invalid characters, or duplicates. Return 'suggested_content' with corrected placeholder syntax, list corrections in 'changes_made', and list any invalid syntax in 'warnings'.\n\n"
            f"Original Message:\n{content}"
        ),
        "compliance_check": (
            f"Perform an official Meta WhatsApp Template Policy Compliance Check on the message below. Evaluate grammar, character length, spam trigger words, ALL-CAPS usage, and placeholder formatting. Return suggested content in 'suggested_content', list compliance observations in 'changes_made', and list compliance warnings in 'warnings'.\n\n"
            f"Original Message:\n{content}"
        ),
    }

    user_prompt = action_prompts.get(action)
    if not user_prompt:
        raise HTTPException(status_code=400, detail=f"Unsupported AI action: {action}")

    try:
        raw_response = gemini.generate_chat_response(
            prompt=user_prompt,
            system_instruction=system_instruction
        )

        import json
        import re

        clean_text = raw_response.strip()
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```(?:json)?\n?", "", clean_text)
            clean_text = re.sub(r"\n?```$", "", clean_text)
        
        try:
            parsed = json.loads(clean_text)
            suggested = parsed.get("suggested_content", content)
            changes = parsed.get("changes_made", ["Processed message with AI"])
            warnings = parsed.get("warnings", [])
        except Exception:
            suggested = clean_text or content
            changes = [f"Applied AI action: {action.replace('_', ' ').title()}"]
            warnings = []

        return {
            "status": "success",
            "action": action,
            "original_content": content,
            "suggested_content": suggested,
            "changes_made": changes,
            "warnings": warnings,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# GLOBAL DND / BLOCKLIST MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/dnd")
async def get_dnd_list(
    search: Optional[str] = Query(None, description="Search phone number or notes"),
    reason: Optional[str] = Query(None, description="Filter by block reason"),
    source: Optional[str] = Query(None, description="Filter by entry source"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Fetch all blocked numbers in the Global DND list with filters & stats."""
    from app.whatsapp.repository import DNDRepository
    return DNDRepository.get_dnd_list(search=search, reason=reason, source=source, skip=skip, limit=limit)


@router.post("/dnd")
async def add_dnd_number(payload: dict):
    """Add or update a single phone number in the Global DND list."""
    from app.whatsapp.repository import DNDRepository
    phone_number = payload.get("phone_number")
    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number is required.")

    try:
        doc = DNDRepository.add_dnd_number(payload)
        return {"message": f"Phone number {phone_number} successfully added to Global DND list", "dnd": doc}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dnd/bulk")
async def add_bulk_dnd_numbers(payload: dict):
    """Bulk import phone numbers into the Global DND list."""
    from app.whatsapp.repository import DNDRepository
    items = payload.get("items", [])
    if not items or not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Payload must contain an array of items.")

    added_count = DNDRepository.add_bulk_dnd_numbers(items)
    return {"message": f"Successfully processed {added_count} phone numbers into Global DND list", "added_count": added_count}


@router.delete("/dnd/{phone_number}")
async def remove_dnd_number(phone_number: str):
    """Unblock / remove a phone number from the Global DND list."""
    from app.whatsapp.repository import DNDRepository
    success = DNDRepository.remove_dnd(phone_number)
    if not success:
        raise HTTPException(status_code=404, detail=f"Phone number {phone_number} not found in active DND list.")
    return {"message": f"Phone number {phone_number} successfully unblocked and removed from Global DND list"}


@router.post("/dnd/check-batch")
async def check_dnd_batch(payload: dict):
    """Batch verify target phone numbers against Global DND list before campaign dispatch."""
    from app.whatsapp.repository import DNDRepository
    phone_numbers = payload.get("phone_numbers", [])
    if not isinstance(phone_numbers, list):
        raise HTTPException(status_code=400, detail="phone_numbers must be an array of strings.")

    return DNDRepository.check_batch(phone_numbers)


# ═══════════════════════════════════════════════════════════════════
# CUSTOMER REPLIES & REPORT EXPORT
# ═══════════════════════════════════════════════════════════════════

@router.get("/replies")
async def get_customer_replies(
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    campaign: Optional[str] = Query(None, description="Campaign filter"),
    template: Optional[str] = Query(None, description="Template filter"),
    contact: Optional[str] = Query(None, description="Contact filter"),
    assigned_agent: Optional[str] = Query(None, description="Assigned agent filter"),
    reply_type: Optional[str] = Query(None, description="Reply type filter"),
    source: Optional[str] = Query(None, description="Source filter (simulation/meta_webhook)"),
    mode: Optional[str] = Query(None, description="Mode filter"),
    status: Optional[str] = Query(None, description="Read/Unread status filter"),
    search: Optional[str] = Query(None, description="Global search text"),
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    scope: NumberScope = Depends(number_scope),
):
    """Get filterable customer replies with total count and stats."""
    filters = {
        "from_date": from_date,
        "to_date": to_date,
        "campaign": campaign,
        "template": template,
        "contact": contact,
        "assigned_agent": assigned_agent,
        "reply_type": reply_type,
        "source": source,
        "mode": mode,
        "status": status,
        "search": search,
    }
    # Remove None values
    clean_filters = {k: v for k, v in filters.items() if v is not None}

    replies = MessageRepository.get_customer_replies(filters=clean_filters, limit=limit, skip=skip, scope=scope.match())
    total = MessageRepository.count_customer_replies(filters=clean_filters, scope=scope.match())
    stats = MessageRepository.get_reply_stats(scope.match())

    return {
        "replies": replies,
        "total": total,
        "stats": stats,
        "limit": limit,
        "skip": skip,
    }


@router.get("/replies/stats")
async def get_customer_reply_stats(scope: NumberScope = Depends(number_scope)):
    """Get aggregated statistics for customer replies of the selected number."""
    return MessageRepository.get_reply_stats(scope.match())


@router.get("/replies/export")
async def export_customer_replies(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    campaign: Optional[str] = Query(None),
    template: Optional[str] = Query(None),
    contact: Optional[str] = Query(None),
    assigned_agent: Optional[str] = Query(None),
    reply_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    mode: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    scope: NumberScope = Depends(number_scope),
):
    """
    Generate and download Excel (.xlsx) report for customer replies of the selected number based on filters.
    File name: Customer_Replies_YYYY-MM-DD.xlsx
    """
    filters = {
        "from_date": from_date,
        "to_date": to_date,
        "campaign": campaign,
        "template": template,
        "contact": contact,
        "assigned_agent": assigned_agent,
        "reply_type": reply_type,
        "source": source,
        "mode": mode,
        "status": status,
        "search": search,
    }
    clean_filters = {k: v for k, v in filters.items() if v is not None}

    replies = MessageRepository.get_customer_replies(filters=clean_filters, limit=5000, skip=0, scope=scope.match())

    from app.whatsapp.services.report_service import generate_customer_replies_excel
    excel_stream = generate_customer_replies_excel(replies)
    excel_bytes = excel_stream.getvalue()

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    filename = f"Customer_Replies_{today_str}.xlsx"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(excel_bytes)),
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    }

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


# ═══════════════════════════════════════════════════════════════════
# CHAT ACCESS AUDIT ROUTES
# ═══════════════════════════════════════════════════════════════════

@router.post("/conversations/{conversation_id}/access")
async def log_chat_access_event(
    conversation_id: str,
    request: Request,
    payload: Optional[dict] = Body(None),
    scope: NumberScope = Depends(number_scope),
):
    """
    Log an audit record whenever a manager opens a customer conversation.
    Identifies authenticated manager from headers/session.
    """
    from app.whatsapp.services.chat_access_service import record_chat_access
    access_log = record_chat_access(conversation_id=conversation_id, payload=payload, request=request, scope=scope.match())
    return {"success": True, "access_log": access_log}


@router.get("/access-logs")
async def get_chat_access_logs(
    manager: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    replied: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=5000),
    skip: int = Query(0, ge=0),
    scope: NumberScope = Depends(number_scope),
):
    """Fetch filterable chat access audit logs of the selected number with pagination."""
    from app.whatsapp.repository import ChatAccessLogRepository
    filters = {
        "manager": manager,
        "customer": customer,
        "phone": phone,
        "replied": replied,
        "from_date": from_date,
        "to_date": to_date,
        "search": search,
    }
    clean_filters = {k: v for k, v in filters.items() if v is not None}

    logs = ChatAccessLogRepository.get_all(filters=clean_filters, limit=limit, skip=skip, scope=scope.match())
    total = ChatAccessLogRepository.count(filters=clean_filters, scope=scope.match())

    return {
        "access_logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.get("/access-logs/stats")
async def get_chat_access_stats(scope: NumberScope = Depends(number_scope)):
    """Get aggregated metrics for chat access history audit of the selected number."""
    from app.whatsapp.repository import ChatAccessLogRepository
    return ChatAccessLogRepository.get_stats(scope.match())


@router.get("/access-logs/export")
async def export_chat_access_logs(
    manager: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    replied: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    scope: NumberScope = Depends(number_scope),
):
    """Export the selected number's Chat Access Audit Logs as a formatted Excel (.xlsx) file."""
    from app.whatsapp.repository import ChatAccessLogRepository
    from app.whatsapp.services.chat_access_service import generate_access_history_excel

    filters = {
        "manager": manager,
        "customer": customer,
        "phone": phone,
        "replied": replied,
        "from_date": from_date,
        "to_date": to_date,
        "search": search,
    }
    clean_filters = {k: v for k, v in filters.items() if v is not None}

    logs = ChatAccessLogRepository.get_all(filters=clean_filters, limit=5000, skip=0, scope=scope.match())
    excel_stream = generate_access_history_excel(logs)
    excel_bytes = excel_stream.getvalue()

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    filename = f"Chat_Access_History_{today_str}.xlsx"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(excel_bytes)),
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    }

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )




# ═══════════════════════════════════════════════════════════════════
# META WHATSAPP WEBHOOK HANDLER
# ═══════════════════════════════════════════════════════════════════

@router.get("/webhook")
async def verify_meta_webhook(request: Request):
    """
    Meta webhook verification handshake (hub.mode / hub.verify_token / hub.challenge).
    Without those parameters, returns a health response. A successful verification does NOT prove
    that status notifications are delivered — see GET /api/whatsapp/diagnostics.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    expected_token = load_config().verify_token

    if mode or token:
        if expected_token and mode == "subscribe" and hmac.compare_digest(token or "", expected_token):
            return Response(content=challenge or "", media_type="text/plain")
        raise HTTPException(status_code=403, detail="Webhook verification failed")

    return {
        "status": "active",
        "service": "WhatsApp Webhook Handler",
        "endpoint": "/api/whatsapp/webhook",
        "verification_token_configured": bool(expected_token),
        "signature_validation": webhook_service.signature_mode(),
    }


@router.post("/webhook")
async def receive_meta_webhook(request: Request):
    """
    Receive Meta webhook events.
    1. Validate X-Hub-Signature-256 against the raw body with META_APP_SECRET.
    2. Persist each event idempotently, acknowledge with 200 immediately.
    3. Process in the background (statuses, inbound messages, template status updates).
    """
    raw_body = await request.body()
    mode = webhook_service.signature_mode()
    if mode == "missing_secret":
        # Non-200 makes Meta retry later, so no events are lost while the secret is being configured.
        print("[Meta Webhook] Rejected: META_APP_SECRET is not configured", flush=True)
        raise HTTPException(status_code=503, detail="Webhook signature secret not configured")
    verified = False
    signer_wabas = None
    if mode == "enforced":
        signer_wabas = webhook_service.match_signature(raw_body, request.headers.get("X-Hub-Signature-256"))
        verified = signer_wabas is not None
        if not verified:
            webhook_service.record_rejected_signature()
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body or b"{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored"}

    result = webhook_service.ingest(payload, signature_verified=verified, signer_wabas=signer_wabas)
    asyncio.create_task(webhook_service.process_pending_events())
    return {"status": "received", **result}
