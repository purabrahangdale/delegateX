import os
from fpdf import FPDF

# ──────────────────────────────────────────────────────────────────
# DelegateX – Delegation Form PDF Generator
# Uses fpdf2 (pure Python) — compatible with all Python versions
# ──────────────────────────────────────────────────────────────────

# Brand colours (R, G, B)
PRIMARY    = (49,  46,  129)   # #312e81  dark indigo
SECONDARY  = (79,  70,  229)   # #4f46e5  indigo
TEXT_DARK  = (30,  41,  59)    # #1e293b
TEXT_MID   = (100, 116, 139)   # #64748b
TEXT_LIGHT = (148, 163, 184)   # #94a3b8
BG_ROW     = (248, 250, 252)   # #f8fafc  alternating row bg
BORDER     = (226, 232, 240)   # #e2e8f0


def _set_color(pdf: FPDF, rgb: tuple, fill=False, draw=False, text=False):
    r, g, b = rgb
    if fill:
        pdf.set_fill_color(r, g, b)
    if draw:
        pdf.set_draw_color(r, g, b)
    if text:
        pdf.set_text_color(r, g, b)


def _hr(pdf: FPDF, color: tuple, lw: float = 0.3):
    _set_color(pdf, color, draw=True)
    pdf.set_line_width(lw)
    pdf.line(20, pdf.get_y(), pdf.w - 20, pdf.get_y())


def _format_value(value) -> str:
    if value is None:
        return "N/A"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value) if value else "-"
    s = str(value).strip()
    return s if s else "-"


def generate_delegation_pdf(
    form_title: str,
    form_description: str,
    answers: dict,
    fields: list,
    response_id: str,
    timestamp: str
) -> str:

    # ── Output path ────────────────────────────────────────────────
    pdf_dir = os.path.join("static", "delegation_pdfs")
    os.makedirs(pdf_dir, exist_ok=True)
    file_path = os.path.join(pdf_dir, f"response_{response_id}.pdf")

    # ── Document setup ─────────────────────────────────────────────
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    page_w = pdf.w - 40   # usable width (A4 = 210 mm, margins = 2×20)

    # ── HEADER ─────────────────────────────────────────────────────
    # Left – "DelegateX Portal"
    pdf.set_font("Helvetica", "B", 13)
    _set_color(pdf, PRIMARY, text=True)
    pdf.set_xy(20, 20)
    pdf.cell(page_w * 0.55, 6, "DelegateX Portal", ln=False)

    # Right – Submission ID + date (small, right-aligned)
    pdf.set_font("Helvetica", "", 7)
    _set_color(pdf, TEXT_MID, text=True)
    right_x = 20 + page_w * 0.56
    right_w = page_w * 0.44
    pdf.set_xy(right_x, 20)
    pdf.multi_cell(right_w, 4, f"Submission ID: {response_id}\nDate: {timestamp}", align="R")

    # Thin separator
    pdf.set_y(28)
    _hr(pdf, BORDER, lw=0.3)
    pdf.ln(5)

    # ── TITLE ──────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 18)
    _set_color(pdf, PRIMARY, text=True)
    pdf.multi_cell(page_w, 9, form_title, align="L")

    if form_description and form_description.strip():
        pdf.set_font("Helvetica", "", 9)
        _set_color(pdf, TEXT_MID, text=True)
        pdf.multi_cell(page_w, 5, form_description, align="L")

    pdf.ln(4)

    # ── SECTION HEADING ────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 11)
    _set_color(pdf, SECONDARY, text=True)
    pdf.cell(page_w, 7, "Submitted Details", ln=True)

    _hr(pdf, SECONDARY, lw=0.6)
    pdf.ln(5)

    # ── Q&A ROWS ───────────────────────────────────────────────────
    fields_map = {f["id"]: f for f in fields}

    col_label_w = page_w * 0.36
    col_value_w = page_w * 0.64
    pad_v = 3      # vertical padding inside cell
    pad_h = 4      # horizontal padding inside cell
    line_h = 5     # line height for text

    has_rows = False
    row_idx  = 0

    for field_id, raw_value in answers.items():
        field_info = fields_map.get(field_id)
        if not field_info:
            continue

        label     = field_info.get("label", "Field")
        value_str = _format_value(raw_value)

        # Estimate number of lines needed for each column
        # approx characters per line (font 9, col width - 2*pad)
        chars_per_line_label = max(1, int((col_label_w - 2 * pad_h) / 2.2))
        chars_per_line_value = max(1, int((col_value_w - 2 * pad_h) / 2.2))

        label_lines = max(1, -(-len(label) // chars_per_line_label))   # ceiling div
        value_lines = max(1, -(-len(value_str) // chars_per_line_value))
        row_h = max(label_lines, value_lines) * line_h + 2 * pad_v

        row_y = pdf.get_y()

        # Row background
        _set_color(pdf, BG_ROW, fill=True)
        _set_color(pdf, BORDER, draw=True)
        pdf.set_line_width(0.2)
        pdf.rect(20, row_y, page_w, row_h, style="F")

        # Label
        pdf.set_font("Helvetica", "B", 9)
        _set_color(pdf, TEXT_DARK, text=True)
        pdf.set_xy(20 + pad_h, row_y + pad_v)
        pdf.multi_cell(col_label_w - 2 * pad_h, line_h, label, align="L")

        # Value
        pdf.set_font("Helvetica", "", 9)
        _set_color(pdf, (51, 65, 85), text=True)
        pdf.set_xy(20 + col_label_w + pad_h, row_y + pad_v)
        pdf.multi_cell(col_value_w - 2 * pad_h, line_h, value_str, align="L")

        # Bottom border
        next_y = row_y + row_h
        _hr(pdf, BORDER, lw=0.2)

        pdf.set_xy(20, next_y)
        row_idx  += 1
        has_rows  = True

    if not has_rows:
        pdf.set_font("Helvetica", "I", 9)
        _set_color(pdf, TEXT_MID, text=True)
        pdf.cell(page_w, 8, "No details submitted.", ln=True)

    # ── FOOTER ─────────────────────────────────────────────────────
    pdf.ln(10)
    _hr(pdf, BORDER, lw=0.3)
    pdf.ln(4)

    pdf.set_font("Helvetica", "I", 7)
    _set_color(pdf, TEXT_LIGHT, text=True)
    pdf.cell(
        page_w, 5,
        "This is a system-generated document from DelegateX. All rights reserved.",
        align="C",
        ln=True
    )

    # ── Save ───────────────────────────────────────────────────────
    pdf.output(file_path)
    return file_path
