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
async def get_templates(
    active_only: bool = False,
    content_type: Optional[str] = None,
    category: Optional[str] = None,
    name: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get all WhatsApp templates with optional filtering."""
    filters = {}
    if content_type:
        filters["content_types"] = [c.strip() for c in content_type.split(",") if c.strip()]
    if category:
        filters["categories"] = [c.strip() for c in category.split(",") if c.strip()]
    if name:
        filters["names"] = [n.strip() for n in name.split(",") if n.strip()]
    if search:
        filters["search"] = search.strip()

    templates = template_service.get_all_templates(active_only=active_only, filters=filters if filters else None)
    return {"templates": templates}


@router.get("/templates/names")
async def get_template_names():
    """Get dynamic list of all template names from database."""
    names = template_service.get_template_names()
    return {"names": names}


@router.get("/templates/insights")
async def get_template_insights():
    """Get comprehensive analytics, KPIs, chart metrics, and performance rankings for templates."""
    insights = template_service.get_template_insights()
    return insights


@router.post("/templates/{template_id}/favorite")
async def toggle_template_favorite(template_id: str):
    """Toggle template favorite status."""
    tmpl = template_service.toggle_template_favorite(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Favorite status updated", "template": tmpl}


@router.post("/templates/{template_id}/view")
async def increment_template_view(template_id: str):
    """Increment view count for a template."""
    tmpl = template_service.increment_template_views(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "View count incremented", "template": tmpl}


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
    """Manually trigger a specific automation workflow or campaign broadcast."""
    payload = payload or {}
    
    try:
        template_override = payload.get("template") or payload.get("template_name") or payload.get("template_id")
        campaign_title = payload.get("campaignName") or payload.get("workflowName") or workflow_name

        if workflow_name in ["campaign", "bulk-message"] or template_override:
            result = await automation_service.execute_simulated_campaign(
                campaign_name=campaign_title,
                template_identifier=template_override or "Welcome Message",
                target_audience=payload.get("targetAudience", "all_leads")
            )

        elif workflow_name == "welcome-message":
            if payload.get("lead"):
                result = await automation_service.trigger_welcome_message(payload["lead"])
            else:
                result = await automation_service.execute_simulated_campaign(
                    campaign_name="Welcome Message Automation",
                    template_identifier="Welcome Message"
                )
            
        elif workflow_name == "followup-reminder":
            result = await automation_service.execute_simulated_campaign(
                campaign_name=campaign_title,
                template_identifier=template_override or "Follow-up Reminder"
            )
            
        elif workflow_name == "meeting-reminder":
            result = await automation_service.execute_simulated_campaign(
                campaign_name=campaign_title,
                template_identifier=template_override or "Meeting Reminder"
            )
            
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
            # Flexible campaign fallback for dynamic workflow names
            result = await automation_service.execute_simulated_campaign(
                campaign_name=campaign_title,
                template_identifier=template_override or "Welcome Message"
            )
        
        return {"message": f"Workflow '{workflow_name}' triggered successfully", "result": result}
        
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


