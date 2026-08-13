"""
WhatsApp Automation — Report Service
Generates business-ready Excel (.xlsx) reports for customer replies using openpyxl.
"""

from io import BytesIO
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def generate_customer_replies_excel(replies: list) -> BytesIO:
    """
    Generate a professional Excel workbook for customer replies.
    Returns in-memory BytesIO object ready for FastAPI StreamingResponse.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Customer Replies"

    # Define headers
    headers = [
        "Sr. No.",
        "Date",
        "Time",
        "Customer Name",
        "WhatsApp Number",
        "Campaign Name",
        "Campaign ID",
        "Template Name",
        "Template ID",
        "Customer Reply",
        "Reply Type",
        "Conversation ID",
        "Assigned Agent",
        "Source",
        "Mode",
        "Message ID",
        "Reply Status",
        "Created At",
    ]

    # Header styling (Emerald theme)
    header_fill = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    # Write headers
    ws.append(headers)
    ws.row_dimensions[1].height = 28

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    # Data row styling
    row_font = Font(name="Calibri", size=10, color="0F172A")
    alt_row_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    for idx, reply in enumerate(replies, start=1):
        created_raw = reply.get("created_at") or ""
        date_str = ""
        time_str = ""
        
        if created_raw:
            try:
                dt = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
                date_str = dt.strftime("%d-%b-%Y")
                time_str = dt.strftime("%I:%M %p")
            except Exception:
                date_str = created_raw[:10] if len(created_raw) >= 10 else created_raw
                time_str = created_raw[11:16] if len(created_raw) >= 16 else ""

        meta = reply.get("metadata", {}) or {}

        # Safely extract associated fields without fabricating data
        c_name = reply.get("sender") or reply.get("recipient") or "Customer"
        c_phone = reply.get("sender_phone") or reply.get("recipient_phone") or ""
        camp_name = reply.get("campaign_name") or meta.get("campaign_name") or meta.get("campaignName") or reply.get("automation_workflow") or ""
        camp_id = reply.get("campaign_id") or meta.get("campaign_id") or meta.get("campaignId") or ""
        tmpl_name = reply.get("template_name") or meta.get("template_name") or meta.get("templateName") or ""
        tmpl_id = reply.get("template_id") or meta.get("template_id") or meta.get("templateId") or ""
        content = reply.get("content") or ""
        msg_type = (reply.get("reply_type") or reply.get("message_type") or "text").title()
        conv_id = reply.get("conversation_id") or ""
        assigned = reply.get("assigned_agent") or meta.get("assigned_agent") or ""
        src = (reply.get("source") or meta.get("source") or "simulation").title()
        mode_val = (reply.get("mode") or meta.get("mode") or "simulation").title()
        msg_id = reply.get("wamid") or meta.get("wamid") or reply.get("_id") or ""
        status_val = (reply.get("status") or "Received").title()

        row_data = [
            int(idx),
            str(date_str),
            str(time_str),
            str(c_name),
            str(c_phone),
            str(camp_name),
            str(camp_id),
            str(tmpl_name),
            str(tmpl_id),
            str(content),
            str(msg_type),
            str(conv_id),
            str(assigned),
            str(src),
            str(mode_val),
            str(msg_id),
            str(status_val),
            str(created_raw),
        ]


        ws.append(row_data)
        row_num = idx + 1
        ws.row_dimensions[row_num].height = 22

        # Apply row styling
        is_even = idx % 2 == 0
        for col_num, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_num, column=col_num)
            cell.font = row_font
            cell.border = thin_border
            if is_even:
                cell.fill = alt_row_fill

            # Alignment rules
            if col_num == 1:  # Sr. No.
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_num in (2, 3):  # Date, Time
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_num == 10:  # Customer Reply
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    # Freeze header row
    ws.freeze_panes = "A2"

    # Enable auto filter
    if ws.dimensions:
        ws.auto_filter.ref = ws.dimensions

    # Auto-adjust column widths
    column_widths = {
        1: 8,    # Sr. No.
        2: 14,   # Date
        3: 12,   # Time
        4: 20,   # Customer Name
        5: 18,   # WhatsApp Number
        6: 22,   # Campaign Name
        7: 18,   # Campaign ID
        8: 22,   # Template Name
        9: 18,   # Template ID
        10: 45,  # Customer Reply
        11: 14,  # Reply Type
        12: 18,  # Conversation ID
        13: 18,  # Assigned Agent
        14: 14,  # Source
        15: 14,  # Mode
        16: 24,  # Message ID
        17: 14,  # Reply Status
        18: 24,  # Created At
    }

    for col_num, width in column_widths.items():
        col_letter = get_column_letter(col_num)
        ws.column_dimensions[col_letter].width = width

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
