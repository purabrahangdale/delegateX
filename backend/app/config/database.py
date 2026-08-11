import os
import re
import urllib.parse
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("DATABASE_URL")

if not MONGO_URL:
    raise ValueError("MongoDB database connection URL is not set in environment variables.")

def sanitize_mongo_url(url: str) -> str:
    pattern = r'^(mongodb(?:\+srv)?://)(.*)@([^/]+.*)$'
    match = re.match(pattern, url)
    if match:
        scheme, userinfo, rest = match.groups()
        if ':' in userinfo:
            user, password = userinfo.split(':', 1)
            user = urllib.parse.unquote(user)
            password = urllib.parse.unquote(password)
            quoted_user = urllib.parse.quote_plus(user)
            quoted_password = urllib.parse.quote_plus(password)
            return f"{scheme}{quoted_user}:{quoted_password}@{rest}"
    return url

MONGO_URL = sanitize_mongo_url(MONGO_URL)
client = MongoClient(MONGO_URL)
db = client["delegation_system"]

employee_collection = db["employees"]
project_collection = db["projects"]
task_collection = db["tasks"]
notification_collection = db["notifications"]
activity_log_collection = db["activity_logs"]
crm_lead_collection = db["crm_leads"]
crm_meeting_collection = db["crm_meetings"]
delegation_form_collection = db["delegation_forms"]
delegation_response_collection = db["delegation_responses"]

# WhatsApp Automation collections
whatsapp_message_collection = db["whatsapp_messages"]
whatsapp_template_collection = db["whatsapp_templates"]
automation_log_collection = db["automation_logs"]
automation_settings_collection = db["automation_settings"]
whatsapp_dnd_collection = db["whatsapp_dnd"]