"""
WhatsApp Automation — Template Service
Handles template CRUD, variable substitution, and default template seeding.
"""

from typing import Optional, List, Dict
from app.whatsapp.repository import TemplateRepository


# Default templates to seed on first run
DEFAULT_TEMPLATES = [
    {
        "name": "Welcome Message",
        "category": "onboarding",
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
    },
    {
        "name": "Follow-up Reminder",
        "category": "reminder",
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
    },
    {
        "name": "Meeting Reminder",
        "category": "reminder",
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
    },
    {
        "name": "Lead Converted",
        "category": "notification",
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
    },
    {
        "name": "Task Assigned",
        "category": "notification",
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
    },
]


def seed_default_templates() -> List[dict]:
    """Seed default templates if they don't exist. Returns list of created templates."""
    created = []
    for tmpl_data in DEFAULT_TEMPLATES:
        existing = TemplateRepository.find_by_name(tmpl_data["name"])
        if not existing:
            result = TemplateRepository.create(tmpl_data.copy())
            created.append(result)
    return created


def get_all_templates(active_only: bool = False) -> List[dict]:
    return TemplateRepository.get_all(active_only=active_only)


def get_template_by_id(template_id: str) -> Optional[dict]:
    return TemplateRepository.find_by_id(template_id)


def get_template_by_name(name: str) -> Optional[dict]:
    return TemplateRepository.find_by_name(name)


def create_template(data: dict) -> dict:
    return TemplateRepository.create(data)


def update_template(template_id: str, data: dict) -> Optional[dict]:
    return TemplateRepository.update(template_id, data)


def delete_template(template_id: str) -> bool:
    return TemplateRepository.delete(template_id)


def render_template(template_content: str, variables: Dict[str, str]) -> str:
    """
    Substitute {{variable_name}} placeholders in template content.
    
    Args:
        template_content: Template string with {{var}} placeholders
        variables: Dict mapping variable names to their values
        
    Returns:
        Rendered message string
    """
    rendered = template_content
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value))
    return rendered
