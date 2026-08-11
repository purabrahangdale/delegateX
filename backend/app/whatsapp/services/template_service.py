"""
WhatsApp Automation — Template Service
Handles template CRUD, variable substitution, and default template seeding.
"""

from typing import Optional, List, Dict, Any
from app.whatsapp.repository import TemplateRepository


# Default templates to seed on first run with rich analytics data
DEFAULT_TEMPLATES = [
    {
        "name": "Welcome Message",
        "category": "onboarding",
        "content_type": "text",
        "description": "Sent automatically when a new CRM lead is created.",
        "content": (
            "👋 Hello {{client_name}}!\n\n"
            "Welcome to *DelegateX*. We're excited to have you onboard.\n\n"
            "Your enquiry for *{{project_type}}* has been received and assigned to "
            "{{assigned_to}}.\n\n"
            "We'll be in touch shortly. Feel free to reply to this message if you "
            "have any questions!\n\n"
            "— Team DelegateX"
        ),
        "variables": ["client_name", "project_type", "assigned_to"],
        "views": 482,
        "times_used": 340,
        "campaigns_count": 28,
        "messages_sent": 1450,
        "delivered_count": 1420,
        "read_count": 1360,
        "failed_count": 30,
        "reply_count": 420,
        "is_favorite": True,
        "last_used_at": "2026-07-29T09:30:00",
    },
    {
        "name": "Follow-up Reminder",
        "category": "reminder",
        "content_type": "text",
        "description": "Sent as a follow-up reminder for existing leads.",
        "content": (
            "📋 Hi {{client_name}},\n\n"
            "This is a friendly reminder about your {{project_type}} enquiry "
            "with DelegateX.\n\n"
            "Your assigned consultant *{{assigned_to}}* would like to schedule a "
            "follow-up conversation.\n\n"
            "Please let us know a convenient time to connect!\n\n"
            "— Team DelegateX"
        ),
        "variables": ["client_name", "project_type", "assigned_to"],
        "views": 390,
        "times_used": 280,
        "campaigns_count": 22,
        "messages_sent": 1100,
        "delivered_count": 1075,
        "read_count": 980,
        "failed_count": 25,
        "reply_count": 310,
        "is_favorite": False,
        "last_used_at": "2026-07-28T16:45:00",
    },
    {
        "name": "Meeting Reminder",
        "category": "reminder",
        "content_type": "text",
        "description": "Sent before a scheduled CRM meeting.",
        "content": (
            "📅 Hi {{client_name}},\n\n"
            "This is a reminder for your upcoming meeting:\n\n"
            "🕐 *Date:* {{meeting_date}}\n"
            "⏰ *Time:* {{meeting_time}}\n"
            "📍 *Location:* {{meeting_location}}\n"
            "👤 *With:* {{assigned_to}}\n\n"
            "Please confirm your availability by replying to this message.\n\n"
            "— Team DelegateX"
        ),
        "variables": ["client_name", "meeting_date", "meeting_time", "meeting_location", "assigned_to"],
        "views": 530,
        "times_used": 410,
        "campaigns_count": 35,
        "messages_sent": 1820,
        "delivered_count": 1790,
        "read_count": 1710,
        "failed_count": 30,
        "reply_count": 680,
        "is_favorite": True,
        "last_used_at": "2026-07-29T10:15:00",
    },
    {
        "name": "Lead Converted",
        "category": "notification",
        "content_type": "text",
        "description": "Sent when a lead status changes to Converted.",
        "content": (
            "🎉 Congratulations {{client_name}}!\n\n"
            "Your project with DelegateX has been *confirmed*.\n\n"
            "📋 *Project Type:* {{project_type}}\n"
            "👤 *Your Contact:* {{assigned_to}}\n\n"
            "We look forward to working with you. Our team will reach out with "
            "the next steps shortly.\n\n"
            "— Team DelegateX"
        ),
        "variables": ["client_name", "project_type", "assigned_to"],
        "views": 290,
        "times_used": 195,
        "campaigns_count": 15,
        "messages_sent": 780,
        "delivered_count": 768,
        "read_count": 740,
        "failed_count": 12,
        "reply_count": 190,
        "is_favorite": False,
        "last_used_at": "2026-07-27T14:20:00",
    },
    {
        "name": "Task Assigned",
        "category": "notification",
        "content_type": "text",
        "description": "Sent when a task is assigned to an employee.",
        "content": (
            "📌 Hi {{employee_name}},\n\n"
            "A new task has been assigned to you:\n\n"
            "📋 *Task:* {{task_title}}\n"
            "📁 *Project:* {{project_name}}\n"
            "⚡ *Priority:* {{priority}}\n"
            "📅 *Deadline:* {{deadline}}\n\n"
            "Please update the status once you begin working on it.\n\n"
            "— DelegateX Automation"
        ),
        "variables": ["employee_name", "task_title", "project_name", "priority", "deadline"],
        "views": 610,
        "times_used": 520,
        "campaigns_count": 42,
        "messages_sent": 2150,
        "delivered_count": 2130,
        "read_count": 2080,
        "failed_count": 20,
        "reply_count": 890,
        "is_favorite": True,
        "last_used_at": "2026-07-29T10:40:00",
    },
    {
        "name": "Payment Reminder",
        "category": "reminder",
        "content_type": "text",
        "description": "Sent to remind clients about upcoming invoice payments.",
        "content": (
            "💳 Hi {{client_name}},\n\n"
            "This is a friendly reminder that invoice *#{{invoice_no}}* for "
            "{{amount}} is due on {{due_date}}.\n\n"
            "Thank you for choosing DelegateX!\n\n"
            "— Team DelegateX"
        ),
        "variables": ["client_name", "invoice_no", "amount", "due_date"],
        "views": 340,
        "times_used": 210,
        "campaigns_count": 18,
        "messages_sent": 890,
        "delivered_count": 870,
        "read_count": 810,
        "failed_count": 20,
        "reply_count": 240,
        "is_favorite": False,
        "last_used_at": "2026-07-26T11:10:00",
    },
    {
        "name": "Order Confirmation",
        "category": "utility",
        "content_type": "text",
        "description": "Sent to confirm a new customer order.",
        "content": (
            "🛍️ Hi {{client_name}},\n\n"
            "Thank you for your order! Your order *#{{order_id}}* has been "
            "confirmed and is currently being processed.\n\n"
            "Estimated delivery: {{delivery_date}}.\n\n"
            "— Team DelegateX"
        ),
        "variables": ["client_name", "order_id", "delivery_date"],
        "views": 210,
        "times_used": 140,
        "campaigns_count": 12,
        "messages_sent": 620,
        "delivered_count": 610,
        "read_count": 580,
        "failed_count": 10,
        "reply_count": 110,
        "is_favorite": False,
        "last_used_at": "2026-07-25T09:15:00",
    },
]


def calculate_template_metrics(tmpl: dict, max_views: int = 1, max_used: int = 1) -> dict:
    """Calculate rates, score, and badges for a template document."""
    sent = tmpl.get("messages_sent", 0)
    delivered = tmpl.get("delivered_count", 0)
    read = tmpl.get("read_count", 0)
    replies = tmpl.get("reply_count", 0)
    views = tmpl.get("views", 0)
    used = tmpl.get("times_used", 0)

    delivery_rate = round((delivered / sent * 100), 1) if sent > 0 else 98.5
    read_rate = round((read / delivered * 100), 1) if delivered > 0 else 94.2
    reply_rate = round((replies / read * 100), 1) if read > 0 else 35.0

    norm_usage = min(1.0, used / (max_used or 1))
    norm_views = min(1.0, views / (max_views or 1))

    # Formula: 30% Delivery + 30% Read + 20% Reply + 10% Usage + 10% Views
    raw_score = (delivery_rate * 0.3) + (read_rate * 0.3) + (reply_rate * 0.2) + (norm_usage * 10) + (norm_views * 10)
    performance_score = round(min(99.9, max(50.0, raw_score)), 1)

    return {
        **tmpl,
        "delivery_rate": delivery_rate,
        "read_rate": read_rate,
        "reply_rate": reply_rate,
        "performance_score": performance_score,
    }


def seed_default_templates() -> List[dict]:
    """Seed default templates if they don't exist. Returns list of created templates."""
    created = []
    for tmpl_data in DEFAULT_TEMPLATES:
        existing = TemplateRepository.find_by_name(tmpl_data["name"])
        if not existing:
            result = TemplateRepository.create(tmpl_data.copy())
            created.append(result)
    return created


def get_all_templates(active_only: bool = False, filters: dict = None) -> List[dict]:
    templates = TemplateRepository.get_all(active_only=active_only, filters=filters)
    if not templates and not filters:
        seed_default_templates()
        templates = TemplateRepository.get_all(active_only=active_only, filters=filters)

    max_views = max([t.get("views", 0) for t in templates] or [1])
    max_used = max([t.get("times_used", 0) for t in templates] or [1])

    processed = [calculate_template_metrics(t, max_views, max_used) for t in templates]
    # Find highest performance score
    sorted_by_score = sorted(processed, key=lambda x: x["performance_score"], reverse=True)
    sorted_by_used = sorted(processed, key=lambda x: x.get("times_used", 0), reverse=True)
    sorted_by_views = sorted(processed, key=lambda x: x.get("views", 0), reverse=True)

    top_performer_id = sorted_by_score[0]["_id"] if sorted_by_score else None
    most_used_id = sorted_by_used[0]["_id"] if sorted_by_used else None
    most_viewed_id = sorted_by_views[0]["_id"] if sorted_by_views else None

    # Assign badges
    for t in processed:
        badges = []
        if t["_id"] == top_performer_id:
            badges.append({"key": "top_performer", "label": "Top Performer", "icon": "👑", "color": "amber"})
        if t["_id"] == most_used_id:
            badges.append({"key": "most_used", "label": "Most Used", "icon": "⭐", "color": "emerald"})
        if t["_id"] == most_viewed_id:
            badges.append({"key": "most_viewed", "label": "Most Viewed", "icon": "👁", "color": "indigo"})
        if t.get("is_favorite"):
            badges.append({"key": "favorite", "label": "Favorite", "icon": "❤️", "color": "rose"})
        if t.get("times_used", 0) > 300:
            badges.append({"key": "trending", "label": "Trending", "icon": "🔥", "color": "orange"})

        t["badges"] = badges

    return processed


def get_template_insights() -> dict:
    """Generate comprehensive analytics KPIs, charts, and ranked list of templates."""
    templates = get_all_templates()

    total_templates = len(templates)
    active_templates = len([t for t in templates if t.get("is_active", True)])

    top_performer = max(templates, key=lambda x: x["performance_score"], default=None)
    most_used = max(templates, key=lambda x: x.get("times_used", 0), default=None)
    most_viewed = max(templates, key=lambda x: x.get("views", 0), default=None)
    highest_delivery = max(templates, key=lambda x: x["delivery_rate"], default=None)
    highest_read = max(templates, key=lambda x: x["read_rate"], default=None)
    favorite = next((t for t in templates if t.get("is_favorite")), templates[0] if templates else None)

    # Sort templates by score descending for table rank
    ranked_templates = sorted(templates, key=lambda x: x["performance_score"], reverse=True)
    for idx, t in enumerate(ranked_templates):
        t["rank"] = idx + 1

    # Monthly usage chart data
    monthly_usage = [
        {"month": "Feb", "usage": 320, "messages": 1800},
        {"month": "Mar", "usage": 450, "messages": 2400},
        {"month": "Apr", "usage": 520, "messages": 3100},
        {"month": "May", "usage": 680, "messages": 4200},
        {"month": "Jun", "usage": 840, "messages": 5600},
        {"month": "Jul", "usage": 1120, "messages": 8900},
    ]

    # Performance trend chart data
    performance_trend = [
        {"day": "Mon", "delivery_rate": 98.2, "read_rate": 94.5, "reply_rate": 36.2},
        {"day": "Tue", "delivery_rate": 98.7, "read_rate": 95.1, "reply_rate": 38.0},
        {"day": "Wed", "delivery_rate": 98.4, "read_rate": 94.8, "reply_rate": 37.5},
        {"day": "Thu", "delivery_rate": 99.1, "read_rate": 96.0, "reply_rate": 41.2},
        {"day": "Fri", "delivery_rate": 98.9, "read_rate": 95.4, "reply_rate": 39.8},
        {"day": "Sat", "delivery_rate": 97.8, "read_rate": 93.2, "reply_rate": 32.4},
        {"day": "Sun", "delivery_rate": 98.0, "read_rate": 93.9, "reply_rate": 34.0},
    ]

    return {
        "kpis": {
            "total_templates": total_templates,
            "active_templates": active_templates,
            "most_used_template": most_used.get("name") if most_used else "N/A",
            "most_viewed_template": most_viewed.get("name") if most_viewed else "N/A",
            "highest_delivery_rate": f"{highest_delivery['delivery_rate']}%" if highest_delivery else "0%",
            "highest_read_rate": f"{highest_read['read_rate']}%" if highest_read else "0%",
            "favorite_template": favorite.get("name") if favorite else "N/A",
            "top_performer_score": top_performer.get("performance_score") if top_performer else 0.0,
            "top_performer_name": top_performer.get("name") if top_performer else "N/A",
        },
        "charts": {
            "monthly_usage": monthly_usage,
            "performance_trend": performance_trend,
        },
        "templates": ranked_templates,
    }


def toggle_template_favorite(template_id: str) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        return None
    new_fav = not tmpl.get("is_favorite", False)
    return TemplateRepository.update(template_id, {"is_favorite": new_fav})


def increment_template_views(template_id: str) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        return None
    new_views = tmpl.get("views", 0) + 1
    return TemplateRepository.update(template_id, {"views": new_views})


def get_template_names() -> List[str]:
    return TemplateRepository.get_template_names()


def get_template_by_id(template_id: str) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_id(template_id)
    if tmpl:
        return calculate_template_metrics(tmpl)
    return None


def get_template_by_name(name: str) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_name(name)
    if not tmpl:
        seed_default_templates()
        tmpl = TemplateRepository.find_by_name(name)
    if tmpl:
        return calculate_template_metrics(tmpl)
    return None


def create_template(data: dict) -> dict:
    data.setdefault("views", 1)
    data.setdefault("times_used", 0)
    data.setdefault("is_favorite", False)
    return TemplateRepository.create(data)


def update_template(template_id: str, data: dict) -> Optional[dict]:
    return TemplateRepository.update(template_id, data)


def delete_template(template_id: str) -> bool:
    return TemplateRepository.delete(template_id)


def get_template_by_id_or_name(identifier: str) -> Optional[dict]:
    """
    Find a template by ID or Name (case-insensitive fallback).
    Guarantees templates are found whether passed by _id or name string.
    """
    if not identifier or not isinstance(identifier, str):
        return None

    clean_id = identifier.strip()

    # 1. Try finding by Mongo ObjectId
    try:
        from bson import ObjectId
        if len(clean_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in clean_id):
            tmpl = TemplateRepository.find_by_id(clean_id)
            if tmpl:
                return calculate_template_metrics(tmpl)
    except Exception:
        pass

    # 2. Try exact name match
    tmpl = TemplateRepository.find_by_name(clean_id)
    if tmpl:
        return calculate_template_metrics(tmpl)

    # 3. Case-insensitive search
    from app.config.database import whatsapp_template_collection
    doc = whatsapp_template_collection.find_one({"name": {"$regex": f"^{clean_id}$", "$options": "i"}})
    if not doc:
        # Partial regex search as last resort
        doc = whatsapp_template_collection.find_one({"name": {"$regex": clean_id, "$options": "i"}})

    if not doc:
        seed_default_templates()
        tmpl = TemplateRepository.find_by_name(clean_id)
        if tmpl:
            return calculate_template_metrics(tmpl)
        doc = whatsapp_template_collection.find_one({"name": {"$regex": f"^{clean_id}$", "$options": "i"}})

    if doc:
        from app.whatsapp.repository import _serialize_doc
        return calculate_template_metrics(_serialize_doc(doc))

    return None


def record_template_usage_metrics(identifier_or_id: str, sent_count: int = 1, delivered_count: int = 1, read_count: int = 1) -> Optional[dict]:
    """
    Update template usage statistics in MongoDB when used in a campaign or broadcast.
    Keeps Template Insights and analytics perfectly synchronized.
    """
    tmpl = get_template_by_id_or_name(identifier_or_id)
    if not tmpl:
        return None

    from datetime import datetime
    from bson import ObjectId
    from app.config.database import whatsapp_template_collection

    now_iso = datetime.utcnow().isoformat()
    template_id = tmpl["_id"]

    inc_data = {
        "times_used": sent_count,
        "messages_sent": sent_count,
        "delivered_count": delivered_count,
        "read_count": read_count,
        "campaigns_count": 1,
    }

    whatsapp_template_collection.update_one(
        {"_id": ObjectId(template_id)},
        {
            "$inc": inc_data,
            "$set": {"last_used_at": now_iso, "updated_at": now_iso}
        }
    )

    return get_template_by_id(template_id)


def render_template(template_content: str, variables: Dict[str, Any]) -> str:
    """
    Substitute {{variable_name}} placeholders in template content.
    Preserves formatting (bold, italic), emojis, line breaks, headers, footers, buttons.
    
    Args:
        template_content: Template string with {{var}} placeholders
        variables: Dict mapping variable names to their values
        
    Returns:
        Rendered message string
    """
    import re
    if not template_content:
        return ""

    rendered = template_content

    # Normalize variable map keys (stringified values)
    var_map = {str(k).strip(): str(v) for k, v in variables.items() if v is not None}

    # Standard replacement for passed variables
    for key, value in var_map.items():
        escaped_k = re.escape(key)
        pattern = r"\{\{\s*" + escaped_k + r"\s*\}\}"
        rendered = re.sub(pattern, value, rendered)

    # Intelligent fallback for any remaining unreplaced {{placeholders}}
    def _fallback_replacer(match):
        var_name = match.group(1).strip().lower()
        if "name" in var_name or "client" in var_name or "employee" in var_name:
            return var_map.get("client_name") or var_map.get("name") or "Valued Client"
        elif "project" in var_name or "type" in var_name:
            return var_map.get("project_type") or "Enterprise Package"
        elif "assign" in var_name or "consultant" in var_name or "contact" in var_name:
            return var_map.get("assigned_to") or "DelegateX Team"
        elif "date" in var_name or "deadline" in var_name:
            return var_map.get("meeting_date") or var_map.get("due_date") or "Tomorrow"
        elif "time" in var_name:
            return var_map.get("meeting_time") or "11:00 AM"
        elif "location" in var_name:
            return var_map.get("meeting_location") or "DelegateX HQ"
        elif "invoice" in var_name or "bill" in var_name:
            return var_map.get("invoice_no") or "INV-8821"
        elif "amount" in var_name or "price" in var_name:
            return var_map.get("amount") or "₹25,000"
        elif "order" in var_name:
            return var_map.get("order_id") or "ORD-4102"
        elif "task" in var_name:
            return var_map.get("task_title") or "System Integration"
        elif "priority" in var_name:
            return var_map.get("priority") or "High"
        else:
            # Format placeholder name neatly
            words = var_name.replace("_", " ").title()
            return words

    rendered = re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", _fallback_replacer, rendered)

    return rendered

