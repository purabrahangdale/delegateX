import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def generate_delegation_pdf(form_title: str, form_description: str, answers: dict, fields: list, response_id: str, timestamp: str) -> str:
    # Ensure static directory exists
    pdf_dir = os.path.join("static", "delegation_pdfs")
    os.makedirs(pdf_dir, exist_ok=True)
    
    file_path = os.path.join(pdf_dir, f"response_{response_id}.pdf")
    
    # Setup document
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Palette (DelegateX styling)
    PRIMARY_COLOR = colors.HexColor("#312e81")  # Dark Indigo
    SECONDARY_COLOR = colors.HexColor("#4f46e5")  # Indigo
    TEXT_COLOR = colors.HexColor("#1e293b")  # Dark Slate
    BG_LIGHT = colors.HexColor("#f8fafc")  # Very Light Slate
    BORDER_COLOR = colors.HexColor("#e2e8f0")
    
    # Define custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=PRIMARY_COLOR,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=SECONDARY_COLOR,
        spaceBefore=12,
        spaceAfter=6
    )
    
    label_style = ParagraphStyle(
        'FieldLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=TEXT_COLOR
    )
    
    value_style = ParagraphStyle(
        'FieldValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor("#334155")
    )
    
    footer_style = ParagraphStyle(
        'FooterText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        textColor=colors.HexColor("#94a3b8"),
        alignment=TA_CENTER
    )
    
    story = []
    
    # Header logo / info
    header_data = [
        [Paragraph("<b>DelegateX</b> Portal", ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=14, textColor=PRIMARY_COLOR)), 
         Paragraph(f"Submission ID: {response_id}<br/>Date: {timestamp}", ParagraphStyle('H2', fontName='Helvetica', fontSize=8, textColor=colors.HexColor("#64748b"), alignment=TA_RIGHT))]
    ]
    header_table = Table(header_data, colWidths=[200, 332])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(header_table)
    
    # Horizontal line
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=15))
    
    # Title & description
    story.append(Paragraph(form_title, title_style))
    if form_description:
        story.append(Paragraph(form_description, subtitle_style))
    story.append(Spacer(1, 10))
    
    # Response fields mapping
    story.append(Paragraph("Submitted Details", section_heading))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY_COLOR, spaceBefore=2, spaceAfter=10))
    
    # Build list of Q&A
    qa_data = []
    
    # Create lookup map for field labels/types
    fields_map = {f['id']: f for f in fields}
    
    for field_id, value in answers.items():
        field_info = fields_map.get(field_id)
        if not field_info:
            continue
        
        label = field_info.get('label', 'Field')
        
        # Format values nicely
        if isinstance(value, list):
            formatted_val = ", ".join(map(str, value))
        elif isinstance(value, bool):
            formatted_val = "Yes" if value else "No"
        elif value is None:
            formatted_val = "N/A"
        else:
            formatted_val = str(value)
            
        qa_data.append([
            Paragraph(f"<b>{label}</b>", label_style),
            Paragraph(formatted_val, value_style)
        ])
        
    if qa_data:
        # Create Table for Q&A
        qa_table = Table(qa_data, colWidths=[180, 352])
        qa_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ('LINEBELOW', (0,0), (-1,-2), 0.5, BORDER_COLOR),
            ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ]))
        story.append(qa_table)
    else:
        story.append(Paragraph("No details submitted.", value_style))
        
    story.append(Spacer(1, 30))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceBefore=20, spaceAfter=8))
    
    # Footer
    story.append(Paragraph("This is a system generated document from DelegateX. All rights reserved.", footer_style))
    
    # Build PDF
    doc.build(story)
    
    return file_path
