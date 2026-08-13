"""
WhatsApp Automation — Chat Access Audit Service
Handles manager chat access logging, manager identity resolution,
reply tracking association, and Excel report generation.
"""

import logging
from io import BytesIO
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.whatsapp.repository import ChatAccessLogRepository, MessageRepository

logger = logging.getLogger("whatsapp.chat_access_service")


def resolve_manager_from_request(request=None, payload: dict = None) -> dict:
    """
    Resolve the authenticated manager's name, email, and ID.
    Priority:
    1. Request headers (X-Manager-Email, X-User-Email, X-Manager-Name, Authorization)
    2. Payload parameters
    3. Default system fallback ("Admin User" / "admin@delegatex.com")
    """
    headers = request.headers if request else {}
    payload = payload or {}

    manager_email = (
        headers.get("x-manager-email")
        or headers.get("x-user-email")
        or payload.get("manager_email")
        or "admin@delegatex.com"
    ).strip()

    manager_name = (
        headers.get("x-manager-name")
        or headers.get("x-user-name")
        or payload.get("manager_name")
        or ("Admin User" if manager_email == "admin@delegatex.com" else manager_email.split("@")[0].replace(".", " ").title())
    ).strip()

    manager_id = (
        headers.get("x-manager-id")
        or payload.get("manager_id")
        or manager_email
    ).strip()

    return {
        "manager_id": manager_id,
        "manager_name": manager_name,
        "manager_email": manager_email,
    }


def record_chat_access(conversation_id: str, payload: dict = None, request=None) -> dict:
    """
    Record an access event whenever a manager opens a customer conversation.
    Creates a distinct, immutable audit record.
    """
    payload = payload or {}
    manager = resolve_manager_from_request(request, payload)

    c_phone = payload.get("contact_phone") or payload.get("recipient_phone") or ""
    c_name = payload.get("contact_name") or payload.get("recipient") or "Customer"

    # Contextual campaign/template lookup from conversation
    camp_name = ""
    camp_id = ""
    tmpl_name = ""
    tmpl_id = ""

    try:
        messages = MessageRepository.find_by_conversation(conversation_id)
        if messages:
            last_msg = messages[-1]
            c_phone = c_phone or last_msg.get("sender_phone") or last_msg.get("recipient_phone") or ""
            if last_msg.get("direction") == "inbound" and c_name == "Customer":
                c_name = last_msg.get("sender") or c_name

            outbound = [m for m in messages if m.get("direction") == "outbound"]
            if outbound:
                last_out = outbound[-1]
                meta = last_out.get("metadata", {}) or {}
                camp_name = meta.get("campaign_name") or last_out.get("automation_workflow") or ""
                camp_id = meta.get("campaign_id") or ""
                tmpl_name = meta.get("template_name") or ""
                tmpl_id = last_out.get("template_id") or meta.get("template_id") or ""
    except Exception as e:
        logger.warning(f"[Chat Access Audit] Conversation context error: {e}")

    access_record = {
        "conversation_id": conversation_id,
        "contact_id": payload.get("contact_id") or c_phone,
        "contact_name": c_name,
        "contact_phone": c_phone,
        "manager_id": manager["manager_id"],
        "manager_name": manager["manager_name"],
        "manager_email": manager["manager_email"],
        "chat_opened_at": datetime.utcnow().isoformat(),
        "replied_to_customer": False,
        "reply_time": None,
        "reply_message_id": None,
        "campaign_id": camp_id,
        "campaign_name": camp_name,
        "template_id": tmpl_id,
        "template_name": tmpl_name,
    }

    created = ChatAccessLogRepository.create(access_record)
    logger.info(f"[Chat Access Audit] Logged chat open: Manager='{manager['manager_name']}' Customer='{c_name}' Conv='{conversation_id}'")
    return created


def record_manager_reply(conversation_id: str, manager_identifier: str, reply_message_id: str = None, reply_time: str = None, contact_phone: str = None) -> bool:
    """
    Find the latest unreplied access record for THAT manager and conversation/phone,
    and mark replied_to_customer = True.
    """
    if (not conversation_id and not contact_phone) or not manager_identifier:
        return False

    latest_log = ChatAccessLogRepository.find_latest_unreplied(
        manager_id_or_email=manager_identifier,
        conversation_id=conversation_id,
        contact_phone=contact_phone,
    )

    if latest_log:
        success = ChatAccessLogRepository.mark_replied(
            log_id=latest_log["_id"],
            reply_time=reply_time or datetime.utcnow().isoformat(),
            reply_message_id=reply_message_id
        )
        logger.info(f"[Chat Access Audit] Marked replied=True for Manager='{manager_identifier}' LogId='{latest_log['_id']}'")
        return success
    else:
        logger.info(f"[Chat Access Audit] No unreplied open record found for Manager='{manager_identifier}' in Conv='{conversation_id}' Phone='{contact_phone}'")
        return False



def generate_access_history_excel(access_logs: list) -> BytesIO:
    """
    Generate an openpyxl Excel workbook for Chat Access History Audit.
    Returns in-memory BytesIO byte stream.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Chat Access History"

    headers = [
        "Sr. No.",
        "Manager Name",
        "Manager Email",
        "Customer Name",
        "WhatsApp Phone",
        "Chat Opened At",
        "Replied?",
        "Reply Time",
        "Conversation ID",
        "Campaign Name",
        "Template Name",
    ]

    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    ws.append(headers)
    ws.row_dimensions[1].height = 28

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    row_font = Font(name="Calibri", size=10, color="0F172A")
    alt_row_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    for idx, log in enumerate(access_logs, start=1):
        opened_raw = log.get("chat_opened_at") or ""
        reply_raw = log.get("reply_time") or ""

        opened_fmt = opened_raw
        if opened_raw:
            try:
                dt = datetime.fromisoformat(opened_raw.replace("Z", "+00:00"))
                opened_fmt = dt.strftime("%d-%b-%Y %I:%M:%S %p")
            except Exception:
                opened_fmt = opened_raw

        reply_fmt = "—"
        if reply_raw:
            try:
                dt_r = datetime.fromisoformat(reply_raw.replace("Z", "+00:00"))
                reply_fmt = dt_r.strftime("%d-%b-%Y %I:%M:%S %p")
            except Exception:
                reply_fmt = reply_raw

        replied_str = "YES" if log.get("replied_to_customer") else "NO"

        row_data = [
            int(idx),
            str(log.get("manager_name") or "Admin User"),
            str(log.get("manager_email") or "admin@delegatex.com"),
            str(log.get("contact_name") or "Customer"),
            str(log.get("contact_phone") or ""),
            str(opened_fmt),
            str(replied_str),
            str(reply_fmt),
            str(log.get("conversation_id") or ""),
            str(log.get("campaign_name") or ""),
            str(log.get("template_name") or ""),
        ]

        ws.append(row_data)
        row_num = idx + 1
        ws.row_dimensions[row_num].height = 22

        is_even = idx % 2 == 0
        for col_num, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_num, column=col_num)
            cell.font = row_font
            cell.border = thin_border
            if is_even:
                cell.fill = alt_row_fill

            if col_num in (1, 6, 7, 8):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    ws.freeze_panes = "A2"
    if ws.dimensions:
        ws.auto_filter.ref = ws.dimensions

    column_widths = {
        1: 8,    # Sr. No.
        2: 22,   # Manager Name
        3: 26,   # Manager Email
        4: 22,   # Customer Name
        5: 18,   # WhatsApp Phone
        6: 24,   # Chat Opened At
        7: 12,   # Replied?
        8: 24,   # Reply Time
        9: 20,   # Conversation ID
        10: 24,  # Campaign Name
        11: 22,  # Template Name
    }

    for col_num, width in column_widths.items():
        col_letter = get_column_letter(col_num)
        ws.column_dimensions[col_letter].width = width

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
