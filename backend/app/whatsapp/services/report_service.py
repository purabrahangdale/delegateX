"""
WhatsApp Automation — Report Service
Generates business-ready Excel (.xlsx) reports for customer replies using openpyxl.
"""

import re
from io import BytesIO
from datetime import datetime, timedelta, timezone
from typing import Optional
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
        "Button Option Color",
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
        btn_color = (meta.get("button_color") or reply.get("button_color") or "Standard").upper()
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
            str(btn_color),
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


# ═══════════════════════════════════════════════════════════════════
# INBOX CHATS EXPORT
# ═══════════════════════════════════════════════════════════════════

_BUSINESS_SENDER = "DelegateX"
_BUSINESS_PHONE = "+91-DELEGATEX"


def _parse_utc(raw) -> Optional[datetime]:
    """Stored timestamps are naive UTC ISO strings (occasionally datetimes or 'Z'-suffixed)."""
    if not raw:
        return None
    if isinstance(raw, datetime):
        dt = raw
    else:
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _contact_of(msg: dict) -> tuple:
    """(name, phone) of the external party, regardless of message direction."""
    inbound = msg.get("direction") == "inbound"
    name = msg.get("sender") if inbound else msg.get("recipient")
    phone = msg.get("sender_phone") if inbound else msg.get("recipient_phone")
    if phone == _BUSINESS_PHONE:
        phone = msg.get("recipient_phone") if inbound else msg.get("sender_phone")
    if name == _BUSINESS_SENDER:
        name = None
    return (name or "Unknown"), (phone or "")


def _phone_key(phone: str, fallback: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-10:] if len(digits) >= 10 else (digits or fallback)


def _style_sheet(ws, column_count: int, widths: list, wrap_cols: set, center_cols: set, row_count: int):
    header_fill = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    row_font = Font(name="Calibri", size=10, color="0F172A")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    side = Side(style="thin", color="E2E8F0")
    border = Border(left=side, right=side, top=side, bottom=side)

    ws.row_dimensions[1].height = 28
    for col in range(1, column_count + 1):
        cell = ws.cell(row=1, column=col)
        cell.fill, cell.font, cell.border = header_fill, header_font, border
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row in range(2, row_count + 2):
        for col in range(1, column_count + 1):
            cell = ws.cell(row=row, column=col)
            cell.font, cell.border = row_font, border
            if row % 2 == 1:
                cell.fill = alt_fill
            cell.alignment = Alignment(
                horizontal="center" if col in center_cols else "left",
                vertical="top" if col in wrap_cols else "center",
                wrap_text=col in wrap_cols,
            )

    for col, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col)].width = width
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(column_count)}{row_count + 1}"


def generate_inbox_chats_excel(messages: list, tz_offset_minutes: int = 0) -> BytesIO:
    """
    Export every inbox conversation as an Excel workbook.

    Sheet "Inbox Chats": one row per message (sent and received), grouped by contact in chronological
    order, so each conversation reads like the chat window.
    Sheet "Conversations Summary": one row per contact with sent/received counts and latest activity.

    `tz_offset_minutes` is the viewer's offset east of UTC (IST = 330) so Date/Time match the inbox.
    """
    offset = timedelta(minutes=tz_offset_minutes)

    def local(raw):
        dt = _parse_utc(raw)
        return dt + offset if dt else None

    # Group by contact phone: one contact's conversation ids can differ between legacy and current records.
    conversations: dict = {}
    for msg in messages:
        name, phone = _contact_of(msg)
        key = _phone_key(phone, msg.get("conversation_id") or "unknown")
        conv = conversations.setdefault(key, {"name": None, "phone": phone, "messages": []})
        # Prefer the name the customer is known by on their own messages.
        if name != "Unknown" and (conv["name"] is None or msg.get("direction") == "inbound"):
            conv["name"] = name
        if phone and not conv["phone"]:
            conv["phone"] = phone
        conv["messages"].append(msg)

    for conv in conversations.values():
        conv["messages"].sort(key=lambda m: _parse_utc(m.get("created_at")) or datetime.min)
        conv["last_at"] = _parse_utc(conv["messages"][-1].get("created_at")) or datetime.min
    # Most recent conversation first, like the inbox sidebar.
    ordered = sorted(conversations.values(), key=lambda c: c["last_at"], reverse=True)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inbox Chats"
    chat_headers = [
        "Sr. No.", "Date", "Time", "Customer Name", "WhatsApp Number", "Direction", "Sent By",
        "Message", "Message Type", "Status", "Campaign Name", "Campaign ID", "Template Name",
        "Template ID", "Conversation ID", "Message ID",
    ]
    ws.append(chat_headers)

    summary_rows = []
    sr = 0
    for conv in ordered:
        name = conv["name"] or "Unknown"
        sent = received = 0
        last_reply = None
        campaigns = []
        for msg in conv["messages"]:
            meta = msg.get("metadata") or {}
            inbound = msg.get("direction") == "inbound"
            at = local(msg.get("created_at"))
            if inbound:
                received += 1
                last_reply = msg
            else:
                sent += 1

            camp_name = msg.get("campaign_name") or meta.get("campaign_name") or meta.get("campaignName") or ""
            if camp_name and camp_name not in campaigns:
                campaigns.append(camp_name)

            sr += 1
            ws.append([
                sr,
                at.strftime("%d-%b-%Y") if at else "",
                at.strftime("%I:%M %p") if at else "",
                name,
                conv["phone"],
                "Received" if inbound else "Sent",
                name if inbound else (meta.get("manager_name") or msg.get("sender") or "Business"),
                msg.get("content") or "",
                (msg.get("message_type") or "text").title(),
                (msg.get("status") or "").title(),
                camp_name,
                str(msg.get("campaign_id") or meta.get("campaign_id") or meta.get("campaignId") or ""),
                msg.get("template_name") or meta.get("template_name") or meta.get("templateName") or "",
                str(msg.get("template_id") or meta.get("template_id") or meta.get("templateId") or ""),
                msg.get("conversation_id") or "",
                msg.get("wamid") or meta.get("wamid") or str(msg.get("_id") or ""),
            ])

        last_at = conv["last_at"] + offset if conv["last_at"] != datetime.min else None
        reply_at = local(last_reply.get("created_at")) if last_reply else None
        summary_rows.append([
            name,
            conv["phone"],
            len(conv["messages"]),
            sent,
            received,
            "Yes" if received else "No",
            (last_reply.get("content") or "") if last_reply else "",
            reply_at.strftime("%d-%b-%Y %I:%M %p") if reply_at else "",
            last_at.strftime("%d-%b-%Y %I:%M %p") if last_at else "",
            ", ".join(campaigns),
        ])

    _style_sheet(
        ws, len(chat_headers),
        widths=[8, 14, 11, 22, 18, 11, 18, 60, 13, 12, 24, 26, 24, 26, 20, 40],
        wrap_cols={8}, center_cols={1, 2, 3, 6, 9, 10}, row_count=sr,
    )

    ws_sum = wb.create_sheet("Conversations Summary")
    summary_headers = [
        "Customer Name", "WhatsApp Number", "Total Messages", "Messages Sent", "Replies Received",
        "Customer Replied", "Last Customer Reply", "Last Reply At", "Last Activity", "Campaigns",
    ]
    ws_sum.append(summary_headers)
    for row in summary_rows:
        ws_sum.append(row)
    _style_sheet(
        ws_sum, len(summary_headers),
        widths=[22, 18, 14, 14, 15, 15, 50, 20, 20, 30],
        wrap_cols={7}, center_cols={3, 4, 5, 6, 8, 9}, row_count=len(summary_rows),
    )

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
