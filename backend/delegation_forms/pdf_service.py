import os
from fpdf import FPDF

def generate_delegation_pdf(form_title: str, form_description: str, answers: dict, fields: list, response_id: str, timestamp: str) -> str:
    # Ensure static directory exists
    pdf_dir = os.path.join("static", "delegation_pdfs")
    os.makedirs(pdf_dir, exist_ok=True)

    file_path = os.path.join(pdf_dir, f"response_{response_id}.pdf")

    # Colors (RGB)
    PRIMARY    = (49, 46, 129)    # #312e81 dark indigo
    SECONDARY  = (79, 70, 229)    # #4f46e5 indigo
    TEXT_DARK  = (30, 41, 59)     # #1e293b dark slate
    TEXT_MID   = (100, 116, 139)  # #64748b mid slate
    TEXT_LIGHT = (148, 163, 184)  # #94a3b8 light slate
    BG_LIGHT   = (248, 250, 252)  # #f8fafc very light
    BORDER     = (226, 232, 240)  # #e2e8f0

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    page_w = pdf.w - 40  # usable width

    # ── HEADER ─────────────────────────────────────────────────────────
    # Left: DelegateX Portal
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(page_w * 0.55, 8, "DelegateX Portal", ln=False)

    # Right: Submission ID + Date (two lines, right-aligned)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*TEXT_MID)
    right_x = pdf.w - 20 - page_w * 0.44
    pdf.set_xy(right_x, pdf.get_y())
    pdf.multi_cell(page_w * 0.44, 4,
                   f"Submission ID: {response_id}\nDate: {timestamp}",
                   align="R")

    # HR line
    pdf.ln(2)
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.3)
    pdf.line(20, pdf.get_y(), pdf.w - 20, pdf.get_y())
    pdf.ln(8)

    # ── TITLE & DESCRIPTION ────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*PRIMARY)
    pdf.multi_cell(page_w, 10, form_title, align="L")

    if form_description:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEXT_MID)
        pdf.multi_cell(page_w, 6, form_description, align="L")

    pdf.ln(6)

    # ── SECTION HEADING ────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*SECONDARY)
    pdf.cell(page_w, 8, "Submitted Details", ln=True)

    # Indigo underline
    pdf.set_draw_color(*SECONDARY)
    pdf.set_line_width(0.5)
    pdf.line(20, pdf.get_y(), pdf.w - 20, pdf.get_y())
    pdf.ln(6)

    # ── Q&A TABLE ──────────────────────────────────────────────────────
    fields_map = {f['id']: f for f in fields}

    col_label = page_w * 0.35
    col_value = page_w * 0.65
    row_h = 8
    pad = 4

    has_rows = False
    for field_id, value in answers.items():
        field_info = fields_map.get(field_id)
        if not field_info:
            continue

        label = field_info.get('label', 'Field')

        # Format value
        if isinstance(value, list):
            formatted_val = ", ".join(map(str, value))
        elif isinstance(value, bool):
            formatted_val = "Yes" if value else "No"
        elif value is None:
            formatted_val = "N/A"
        else:
            formatted_val = str(value)

        # Row background
        pdf.set_fill_color(*BG_LIGHT)
        row_y = pdf.get_y()

        # Measure heights
        pdf.set_font("Helvetica", "B", 10)
        label_lines = pdf.multi_cell(col_label - 2*pad, row_h, label, dry_run=True, output="LINES")
        pdf.set_font("Helvetica", "", 10)
        value_lines = pdf.multi_cell(col_value - 2*pad, row_h, formatted_val, dry_run=True, output="LINES")
        
        actual_h = max(len(label_lines), len(value_lines)) * row_h + 2*pad

        # Draw row rect
        pdf.set_xy(20, row_y)
        pdf.rect(20, row_y, page_w, actual_h, style="F")

        # Label cell
        pdf.set_xy(20 + pad, row_y + pad)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*TEXT_DARK)
        pdf.multi_cell(col_label - 2*pad, row_h, label, align="L")

        # Value cell
        pdf.set_xy(20 + col_label + pad, row_y + pad)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(col_value - 2*pad, row_h, formatted_val, align="L")

        # Bottom border
        next_y = row_y + actual_h
        pdf.set_draw_color(*BORDER)
        pdf.set_line_width(0.2)
        pdf.line(20, next_y, pdf.w - 20, next_y)

        pdf.set_xy(20, next_y)
        has_rows = True

    if not has_rows:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEXT_MID)
        pdf.cell(page_w, 8, "No details submitted.", ln=True)

    # ── FOOTER ─────────────────────────────────────────────────────────
    pdf.ln(16)
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.3)
    pdf.line(20, pdf.get_y(), pdf.w - 20, pdf.get_y())
    pdf.ln(5)

    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*TEXT_LIGHT)
    pdf.cell(page_w, 6,
             "This is a system generated document from DelegateX. All rights reserved.",
             align="C", ln=True)

    pdf.output(file_path)
    return file_path
