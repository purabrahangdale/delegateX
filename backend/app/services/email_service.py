import os
import sys
import logging
import asyncio
import json
import urllib.request
import urllib.error
from email.message import EmailMessage
from typing import Optional
import aiosmtplib
import re
from dotenv import load_dotenv

# Resolve .env path explicitly relative to the backend directory
# so credentials load correctly regardless of the server's working directory.
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
load_dotenv(dotenv_path=_env_path)

# Verify SMTP Credentials load correctly from .env
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD") or os.getenv("EMAIL_PASS")
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

print("EMAIL USER:", EMAIL_USER)

if EMAIL_USER:
    print("EMAIL_USER loaded")
else:
    print("EMAIL_USER not loaded")

if EMAIL_PASSWORD:
    print("EMAIL_PASSWORD loaded")
else:
    print("EMAIL_PASSWORD not loaded")

def _print(msg: str):
    """Print with immediate flush so output appears in non-TTY environments."""
    print(msg)
    sys.stdout.flush()

logger = logging.getLogger("email_service")


def validate_email_address(email: Optional[str]) -> bool:
    """Validates the structure of an email address."""
    if not email:
        return False
    email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(email_regex, email.strip()))


def _send_resend_sync(api_key: str, from_email: str, recipient: str, subject: str, html_body: str) -> bool:
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": from_email,
        "to": [recipient],
        "subject": subject,
        "html": html_body,
        "headers": {
            "Precedence": "bulk",
            "X-Auto-Response-Suppress": "All",
            "List-Unsubscribe": "<mailto:unsubscribe@delegatex.com?subject=unsubscribe>"
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_body = response.read().decode("utf-8")
            logger.info(f"Resend email dispatched successfully: {resp_body}")
            return True
    except urllib.error.HTTPError as http_err:
        err_body = http_err.read().decode("utf-8")
        logger.error(f"Resend HTTP Error: {http_err.code} - {err_body}")
        raise http_err
    except Exception as e:
        logger.error(f"Resend connection error: {str(e)}")
        raise e


async def send_email(recipient: str, subject: str, html_template: str) -> bool:
    print("CLIENT EMAIL:", recipient)
    print("Sending email to:", recipient)
    print("Subject:", subject)
    print("HTML TEMPLATE:")
    print(html_template)
    
    # Check if professional transactional provider (Resend) key is configured
    resend_api_key = os.getenv("RESEND_API_KEY")
    if resend_api_key:
        print("[SMTP-DEBUG] Production Resend API key found. Executing transactional send...")
        from_email = os.getenv("RESEND_FROM_EMAIL") or "DelegateX CRM <onboarding@resend.dev>"
        try:
            # Simulate logs compatibility for SMTP-like checks
            print("SMTP CONNECTED")
            print("SMTP LOGIN SUCCESS")
            
            await asyncio.to_thread(_send_resend_sync, resend_api_key, from_email, recipient, subject, html_template)
            print("EMAIL SENT SUCCESSFULLY")
            return True
        except Exception as e:
            print("EMAIL ERROR:", str(e))
            raise e
            
    # Fallback to legay Gmail SMTP
    print("[SMTP-DEBUG] Resend API key not found. Falling back to Gmail SMTP connection...")
    email_user = EMAIL_USER
    email_pass = EMAIL_PASSWORD
    
    if not email_user:
        print("[SMTP-DEBUG] Error: EMAIL_USER environment variable is not defined.")
        raise ValueError("EMAIL_USER environment variable is not set.")
    if not email_pass:
        print("[SMTP-DEBUG] Error: EMAIL_PASSWORD environment variable is not defined.")
        raise ValueError("EMAIL_PASSWORD environment variable is not set.")

    email_pass_cleaned = email_pass.replace(" ", "").strip()
    
    msg = EmailMessage()
    msg["From"] = email_user
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content("HTML email body requires HTML support.")
    msg.add_alternative(html_template, subtype="html")
    
    try:
        smtp = aiosmtplib.SMTP(hostname=SMTP_HOST, port=SMTP_PORT, use_tls=False, start_tls=False)
        
        await smtp.connect()
        print("SMTP CONNECTED")
        
        await smtp.starttls()
        
        await smtp.login(email_user, email_pass_cleaned)
        print("SMTP LOGIN SUCCESS")
        
        await smtp.send_message(msg)
        print("EMAIL SENT SUCCESSFULLY")
        
        await smtp.quit()
        return True
    except Exception as e:
        print("EMAIL ERROR:", str(e))
        raise e


async def send_email_async(recipient: str, subject: str, body: str, is_html: bool = False) -> bool:
    """
    Sends an email asynchronously using Gmail SMTP and credentials from environment variables.
    
    Args:
        recipient (str): Receiver email address.
        subject (str): Email subject.
        body (str): Email message content (text or HTML).
        is_html (bool): If True, send email as HTML.
        
    Returns:
        bool: True if email is sent successfully, False otherwise.
    """
    print("[SMTP-DEBUG] Loading credentials from environment variables...")
    email_user = EMAIL_USER
    email_pass = EMAIL_PASSWORD
    
    if not email_user:
        print("[SMTP-DEBUG] Error: EMAIL_USER environment variable is not defined.")
        logger.error("EMAIL_USER environment variable is missing.")
        raise ValueError("EMAIL_USER environment variable is not set.")
    if not email_pass:
        print("[SMTP-DEBUG] Error: EMAIL_PASSWORD environment variable is not defined.")
        logger.error("EMAIL_PASSWORD environment variable is missing.")
        raise ValueError("EMAIL_PASSWORD environment variable is not set.")

    # Remove any extra whitespace and ALL spaces from the App Password if present (App Password is 16 letters with no spaces)
    email_pass_cleaned = email_pass.replace(" ", "").strip()
    print(f"[SMTP-DEBUG] Credentials loaded successfully. User: {email_user}. Host: {SMTP_HOST}:{SMTP_PORT}")
    
    # Create the email message using dynamically assigned recipient
    msg = EmailMessage()
    msg["From"] = email_user
    lead_email = recipient  # Dynamic recipient logic assignment
    msg["To"] = lead_email
    msg["Subject"] = subject
    
    if is_html:
        msg.set_content("HTML email body requires HTML support.")
        msg.add_alternative(body, subtype="html")
    else:
        msg.set_content(body)
        
    try:
        print(f"[SMTP-DEBUG] === PRE-SEND DIAGNOSTIC ===")
        print(f"[SMTP-DEBUG] Recipient : {recipient}")
        print(f"[SMTP-DEBUG] Subject   : {subject}")
        print(f"[SMTP-DEBUG] From      : {email_user}")
        print(f"[SMTP-DEBUG] SMTP Host : {SMTP_HOST}:{SMTP_PORT}")
        print(f"[SMTP-DEBUG] HTML Mode  : {is_html}")
        print(f"[SMTP-DEBUG] ===========================")

        print(f"[SMTP-DEBUG] Connecting to SMTP server {SMTP_HOST}:{SMTP_PORT} (plaintext)...")
        smtp = aiosmtplib.SMTP(hostname=SMTP_HOST, port=SMTP_PORT, use_tls=False, start_tls=False)
        await smtp.connect()
        print("SMTP CONNECTED")
        print("[SMTP-DEBUG] Plaintext connection established successfully.")

        print("[SMTP-DEBUG] Upgrading connection via STARTTLS...")
        await smtp.starttls()
        print("[SMTP-DEBUG] STARTTLS upgrade successful. Connection is now encrypted.")

        print(f"[SMTP-DEBUG] Attempting login authentication for user {email_user}...")
        await smtp.login(email_user, email_pass_cleaned)
        print("[SMTP-DEBUG] Authentication successful.")
        
        print(f"[SMTP-DEBUG] Dispatching email message to {recipient}...")
        await smtp.send_message(msg)
        print("EMAIL SENT SUCCESSFULLY")
        print(f"EMAIL DELIVERED TO: {recipient}")
        
        await smtp.quit()
        logger.info(f"Successfully sent email to {recipient} with subject '{subject}'")
        return True
    except aiosmtplib.SMTPAuthenticationError as auth_err:
        print("SMTP authentication failure:", str(auth_err))
        logger.error(f"SMTP Authentication Error: {str(auth_err)}")
        raise auth_err
    except aiosmtplib.SMTPRecipientRefused as rec_err:
        print("SMTP recipient error:", str(rec_err))
        logger.error(f"SMTP Recipient Error: {str(rec_err)}")
        raise rec_err
    except asyncio.TimeoutError as time_err:
        print("SMTP timeout error:", str(time_err))
        logger.error(f"SMTP Timeout Error: {str(time_err)}")
        raise time_err
    except aiosmtplib.SMTPException as smtp_err:
        print("SMTP error:", str(smtp_err))
        logger.error(f"SMTP Protocol Exception: {str(smtp_err)}")
        raise smtp_err
    except Exception as e:
        print("SMTP error:", str(e))
        logger.error(f"Failed to send email to {recipient}: {str(e)}")
        raise e


def load_template(template_name: str, **kwargs) -> str:
    """Helper to load and format HTML email templates dynamically."""
    try:
        # Resolve absolute template path relative to this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        templates_dir = os.path.join(current_dir, "..", "templates")
        
        # Load base template
        base_path = os.path.join(templates_dir, "base_email.html")
        with open(base_path, "r", encoding="utf-8") as f:
            base_html = f.read()
            
        # Load specific template content
        content_path = os.path.join(templates_dir, template_name)
        with open(content_path, "r", encoding="utf-8") as f:
            content_html = f.read()
            
        # Standardize badges / priority styling
        priority = kwargs.get("priority", "Medium").strip().capitalize()
        priority_style = "background-color: #fef3c7; color: #92400e;"  # Default Medium
        if priority == "High":
            priority_style = "background-color: #fee2e2; color: #991b1b;"
        elif priority == "Low":
            priority_style = "background-color: #dcfce7; color: #166534;"
        
        # Inject style variables
        kwargs["priority_style"] = priority_style
        kwargs["priority"] = priority
        
        # Format template content using safe replacement
        formatted_content = content_html
        for key, val in kwargs.items():
            formatted_content = formatted_content.replace(f"{{{key}}}", str(val))
            
        # Inject into base layout using safe replacement
        subject = kwargs.get("subject", "DelegateX Notification")
        final_html = base_html.replace("{subject}", subject).replace("{content}", formatted_content)
        return final_html
    except Exception as e:
        logger.error(f"Error loading email template {template_name}: {str(e)}")
        # Fallback basic markup if file fails to load
        return f"<html><body><p>{kwargs.get('description', 'Notification')}</p></body></html>"


async def send_task_assignment_notification(task_data: dict) -> bool:
    """
    Sends a task assignment notification email to the assigned employee.
    Queries the database to find the employee's email dynamically.
    """
    emp_name = task_data.get("employee") or task_data.get("employee_name")
    if not emp_name:
        logger.error("No employee name provided in task assignment data.")
        return False

    try:
        recipient_email = await get_employee_email(emp_name)
    except ValueError as ve:
        logger.error(f"Failed to resolve employee email: {str(ve)}")
        return False

    subject = f"New Task Assigned: {task_data.get('title', 'Action Required')}"
    
    html_body = load_template(
        "task_assignment.html",
        subject=subject,
        employee_name=emp_name,
        task_title=task_data.get('title', 'N/A'),
        project=task_data.get('project', 'N/A'),
        priority=task_data.get('priority', 'Medium'),
        deadline=task_data.get('deadline', 'N/A'),
        assigned_date=task_data.get('assignedDate', 'Today'),
        description=task_data.get('description', 'No description provided.')
    )
    
    try:
        await send_email_async(
            recipient=recipient_email,
            subject=subject,
            body=html_body,
            is_html=True
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send task assignment notification email: {str(e)}")
        return False


async def get_employee_email(emp_name: str) -> str:
    """Helper to lookup an employee email dynamically from the database."""
    from app.config.database import employee_collection
    recipient_email = None
    if emp_name:
        try:
            emp_doc = employee_collection.find_one({"name": emp_name})
            if emp_doc:
                recipient_email = emp_doc.get("email")
                logger.info(f"[EMAIL-DEBUG] Employee '{emp_name}' email resolved from database: {recipient_email}")
        except Exception as e:
            logger.error(f"[EMAIL-DEBUG] Database error during employee email lookup for '{emp_name}': {str(e)}")
            pass
            
    # Check if emp_name is already a valid email
    if not recipient_email and emp_name and "@" in emp_name and validate_email_address(emp_name):
        recipient_email = emp_name
            
    if not recipient_email:
        raise ValueError(f"No email could be resolved dynamically for employee: {emp_name}")
            
    return recipient_email


async def send_lead_created_notification(lead_data: dict) -> bool:
    """
    Sends email notifications when a new lead is created.
    - Sends lead assignment email to the assigned employee.
    - Sends welcome email to the client/lead email.
    Each send is fully independent — one failing will NOT block the other.
    """
    _print(f"\n{'='*60}")
    _print(f"[EMAIL-DEBUG] send_lead_created_notification TRIGGERED")
    _print(f"[EMAIL-DEBUG] Incoming frontend payload: {lead_data}")
    _print(f"{'='*60}")
    logger.info(f"[EMAIL-DEBUG] Incoming frontend payload: {lead_data}")

    emp_name = lead_data.get("assignedTo") or "Sarah Jenkins"
    client_name = lead_data.get("name") or "Valued Client"
    client_email = lead_data.get("email")
    client_phone = lead_data.get("phone") or "N/A"
    project_type = lead_data.get("projectType") or "Residential"

    _print(f"[EMAIL-DEBUG] incoming frontend email: {client_email}")
    _print(f"[EMAIL-DEBUG] backend lead.email value: {client_email}")
    logger.info(f"[EMAIL-DEBUG] incoming frontend email: {client_email}")
    logger.info(f"[EMAIL-DEBUG] backend lead.email value: {client_email}")

    employee_send_success = False
    client_send_success = False

    # ── STEP 1: Employee Assignment Email (independent try/except) ──
    try:
        emp_email = lead_data.get("employee_email")
        if not emp_email:
            try:
                emp_email = await get_employee_email(emp_name)
            except Exception as e:
                _print(f"[EMAIL-DEBUG] Failed to resolve employee email for '{emp_name}': {str(e)}")
                logger.error(f"[EMAIL-DEBUG] Failed to resolve employee email for '{emp_name}': {str(e)}")
                emp_email = None

        _print(f"[EMAIL-DEBUG] Selected Employee: {emp_name} ({emp_email})")
        logger.info(f"[EMAIL-DEBUG] Selected Employee: {emp_name} ({emp_email})")

        if emp_email and validate_email_address(emp_email):
            emp_subject = f"New CRM Lead Assigned: {client_name}"
            emp_html = load_template(
                "lead_created.html",
                subject=emp_subject,
                employee_name=emp_name,
                lead_name=client_name,
                lead_email=client_email or "N/A",
                lead_phone=client_phone,
                priority=lead_data.get("priority", "Medium"),
                assigned_date=lead_data.get("date", "N/A"),
                referrer=lead_data.get("referredBy") or lead_data.get("leadSource") or "N/A"
            )
            try:
                _print(f"[EMAIL-DEBUG] Triggering SMTP send to Employee: {emp_email}")
                logger.info(f"[EMAIL-DEBUG] Triggering SMTP send to Employee: {emp_email}")
                status = await send_email_async(
                    recipient=emp_email,
                    subject=emp_subject,
                    body=emp_html,
                    is_html=True
                )
                employee_send_success = status
                _print(f"[EMAIL-DEBUG] Employee email send status: {'Success' if status else 'Failure'}")
                logger.info(f"[EMAIL-DEBUG] Employee email send status: {'Success' if status else 'Failure'}")
            except Exception as e:
                _print(f"[EMAIL-DEBUG] SMTP failed sending to Employee '{emp_email}': {str(e)}")
                logger.error(f"[EMAIL-DEBUG] SMTP failed sending to Employee '{emp_email}': {str(e)}")
        else:
            _print(f"[EMAIL-DEBUG] Skipped employee email: '{emp_email}' is missing or invalid.")
            logger.warning(f"[EMAIL-DEBUG] Skipped employee email: '{emp_email}' is missing or invalid.")
    except Exception as emp_exc:
        _print(f"[EMAIL-DEBUG] EMPLOYEE EMAIL BLOCK EXCEPTION (non-fatal): {str(emp_exc)}")
        logger.error(f"[EMAIL-DEBUG] Employee email block exception: {str(emp_exc)}")

    _print(f"\n[EMAIL-DEBUG] FINAL RESULT: employee={employee_send_success}")
    _print(f"{'='*60}\n")
    return employee_send_success


async def send_task_assigned_client_notification(task_data: dict) -> bool:
    """
    Sends an email notification to the customer/client when a task is assigned.
    """
    from app.config.database import crm_lead_collection
    
    logger.info(f"[EMAIL-DEBUG] Project Update Notification incoming payload: {task_data}")
    
    client_email = None
    client_name = "Valued Client"
    
    # Lookup client email and name from CRM lead collection by project or employee
    try:
        # First, try to query by project name matching projectType or project field
        proj_name = task_data.get("project")
        if proj_name:
            lead = crm_lead_collection.find_one({"projectType": proj_name})
            if lead:
                client_email = lead.get("email")
                client_name = lead.get("name") or "Valued Client"
                logger.info(f"[EMAIL-DEBUG] Resolved client {client_name} ({client_email}) by project name '{proj_name}'")
        
        # If not resolved yet, fallback to looking up by assigned employee
        if not client_email and task_data.get("employee"):
            lead = crm_lead_collection.find_one({"assignedTo": task_data.get("employee")})
            if lead:
                client_email = lead.get("email")
                client_name = lead.get("name") or "Valued Client"
                logger.info(f"[EMAIL-DEBUG] Resolved client {client_name} ({client_email}) by assigned employee '{task_data.get('employee')}'")
    except Exception as e:
        logger.error(f"[EMAIL-DEBUG] Database error during client lookup for project update: {str(e)}")
        
    # Check if client email is missing
    if not client_email:
        logger.warning("[EMAIL-DEBUG] Skipped sending project update: Client email is missing.")
        return False
        
    # Validate client email format
    if not validate_email_address(client_email):
        logger.warning(f"[EMAIL-DEBUG] Skipped sending project update: Client email '{client_email}' is invalid.")
        return False
        
    subject = f"Notification: Update on your project request - {task_data.get('title', 'N/A')}"
    
    html_body = load_template(
        "task_client_notification.html",
        subject=subject,
        customer_name=client_name,
        project=task_data.get('project', 'N/A'),
        task_title=task_data.get('title', 'N/A'),
        employee_name=task_data.get('employee', 'N/A'),
        status=task_data.get('status', 'Pending'),
        deadline=task_data.get('deadline', 'N/A'),
        description=task_data.get('description', 'No description provided.')
    )
    
    try:
        logger.info(f"[EMAIL-DEBUG] Triggering SMTP send to Client (project update): {client_email}")
        status = await send_email_async(
            recipient=client_email,
            subject=subject,
            body=html_body,
            is_html=True
        )
        logger.info(f"[EMAIL-DEBUG] SMTP Send Status to Client ({client_email}) (project update): {status}")
        return status
    except Exception as e:
        logger.error(f"[EMAIL-DEBUG] SMTP failed sending to Client '{client_email}' (project update): {str(e)}")
        return False





