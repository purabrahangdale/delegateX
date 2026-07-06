from datetime import datetime
from .base_template import get_base_template

def render_email_template(subject: str, content: str) -> str:
    """Renders the HTML email with the base wrapper template."""
    return get_base_template(subject, content)

def format_display_name(name: str) -> str:
    """Formats employee or client names professionally."""
    if not name:
        return "Valued Customer"
    return name.strip().title()

def format_datetime_string(date_str: str) -> str:
    """Formats date strings dynamically for templates."""
    if not date_str:
        return "N/A"
    try:
        # Tries to parse standard ISO format
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y, %I:%M %p")
    except ValueError:
        try:
            # Tries to parse YYYY-MM-DD
            dt = datetime.strptime(date_str.split("T")[0], "%Y-%m-%d")
            return dt.strftime("%d %b %Y")
        except ValueError:
            return date_str
