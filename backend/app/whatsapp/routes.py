"""
WhatsApp Automation — FastAPI Routes
All WhatsApp API endpoints for dashboard, inbox, templates, logs, and settings.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime

from app.whatsapp.models import (
    WhatsAppMessageCreate,
    WhatsAppTemplateCreate,
    WhatsAppTemplateUpdate,
    AutomationSettingsUpdate,
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
from app.whatsapp.services.scheduler_service import get_scheduler_status
from app.whatsapp.providers.factory import get_provider_info

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


# ═══════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get aggregated WhatsApp automation dashboard statistics."""
    stats = message_service.get_dashboard_stats()
    scheduler_status = get_scheduler_status()
    provider_info = get_provider_info()
    
    return {
        **stats,
        "scheduler": scheduler_status,
        "provider": provider_info,
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
):
    """Get all WhatsApp messages with optional filters."""
    filters = {}
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
async def get_conversations():
    """Get conversation list for inbox sidebar."""
    conversations = MessageRepository.get_conversations()
    return {"conversations": conversations}


@router.get("/messages/conversation/{conversation_id}")
async def get_conversation_messages(conversation_id: str):
    """Get all messages in a specific conversation."""
    messages = MessageRepository.find_by_conversation(conversation_id)
    return {
        "conversation_id": conversation_id,
        "messages": messages,
        "total": len(messages),
    }


@router.post("/messages/send")
async def send_message(payload: WhatsAppMessageCreate):
    """Send a new WhatsApp message."""
    try:
        message = await message_service.send_message(
            recipient_phone=payload.recipient_phone,
            content=payload.content,
            recipient_name=payload.recipient_name,
            message_type=payload.message_type.value,
            template_id=payload.template_id,
            metadata=payload.metadata,
        )
        return {"message": "Message sent successfully", "data": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages/simulate-reply")
async def simulate_reply(payload: dict):
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

@router.get("/templates")
async def get_templates(active_only: bool = False):
    """Get all WhatsApp templates."""
    templates = template_service.get_all_templates(active_only=active_only)
    return {"templates": templates}


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get a single template by ID."""
    template = template_service.get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates")
async def create_template(payload: WhatsAppTemplateCreate):
    """Create a new WhatsApp template."""
    template_data = payload.dict()
    template = template_service.create_template(template_data)
    return {"message": "Template created successfully", "template": template}


@router.put("/templates/{template_id}")
async def update_template(template_id: str, payload: WhatsAppTemplateUpdate):
    """Update an existing WhatsApp template."""
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    template = template_service.update_template(template_id, update_data)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated successfully", "template": template}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """Delete a WhatsApp template."""
    success = template_service.delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}


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
):
    """Get automation execution logs with optional filters."""
    filters = {}
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

@router.get("/settings")
async def get_settings():
    """Get current WhatsApp automation settings."""
    settings = SettingsRepository.get()
    provider_info = get_provider_info()
    return {**settings, "provider_info": provider_info}


@router.put("/settings")
async def update_settings(payload: AutomationSettingsUpdate):
    """Update WhatsApp automation settings."""
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    
    # Convert enum to string for MongoDB
    if "provider" in update_data:
        update_data["provider"] = update_data["provider"].value
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    settings = SettingsRepository.update(update_data)
    return {"message": "Settings updated successfully", "settings": settings}


# ═══════════════════════════════════════════════════════════════════
# MANUAL AUTOMATION TRIGGERS
# ═══════════════════════════════════════════════════════════════════

@router.post("/automations/trigger/{workflow_name}")
async def trigger_automation(workflow_name: str, payload: dict = None):
    """Manually trigger a specific automation workflow."""
    payload = payload or {}
    
    try:
        if workflow_name == "welcome-message":
            if not payload.get("lead"):
                raise HTTPException(status_code=400, detail="Lead data required")
            result = await automation_service.trigger_welcome_message(payload["lead"])
            
        elif workflow_name == "followup-reminder":
            result = await automation_service.trigger_followup_reminders()
            
        elif workflow_name == "meeting-reminder":
            result = await automation_service.trigger_meeting_reminders()
            
        elif workflow_name == "daily-report":
            result = await automation_service.trigger_daily_lead_report()
            
        elif workflow_name == "auto-reply":
            if not payload.get("message"):
                raise HTTPException(status_code=400, detail="Message data required")
            result = await automation_service.trigger_auto_reply(payload["message"])
            
        elif workflow_name == "ai-faq":
            if not payload.get("message"):
                raise HTTPException(status_code=400, detail="Message data required")
            result = await automation_service.trigger_ai_faq_bot(payload["message"])
            
        else:
            raise HTTPException(status_code=404, detail=f"Unknown workflow: {workflow_name}")
        
        return {"message": f"Workflow '{workflow_name}' triggered successfully", "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
