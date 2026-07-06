from .styles import STYLES

BASE_EMAIL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>{subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root {{
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }}
    @media (prefers-color-scheme: dark) {{
      body {{
        background-color: #09090b !important;
        color: #f4f4f5 !important;
      }}
      .email-wrapper {{
        background-color: #09090b !important;
      }}
      .email-container {{
        background-color: #18181b !important;
        border-color: #27272a !important;
      }}
      .header-area {{
        border-bottom-color: #27272a !important;
      }}
      .brand-text {{
        color: #f4f4f5 !important;
      }}
      .brand-accent {{
        color: #6366f1 !important;
      }}
      .system-badge {{
        color: #a1a1aa !important;
      }}
      .table-header {{
        color: #a1a1aa !important;
        border-bottom-color: #27272a !important;
      }}
      .table-data {{
        color: #e4e4e7 !important;
        border-bottom-color: #27272a !important;
      }}
      .well {{
        background-color: #27272a !important;
        border-left-color: #4f46e5 !important;
      }}
      .description-text {{
        color: #e4e4e7 !important;
      }}
      .footer-area {{
        background-color: #18181b !important;
        border-top-color: #27272a !important;
      }}
      .footer-text {{
        color: #a1a1aa !important;
      }}
      .footer-subtext {{
        color: #71717a !important;
      }}
      h1, h2, h3, p, td, span {{
        color: #f4f4f5 !important;
      }}
      a {{
        color: #818cf8 !important;
      }}
    }}
  </style>
</head>
<body style="{body_style}">
  <div class="email-wrapper" style="{wrapper_style}">
    <!--[if mso]>
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="width:600px;">
    <tr>
    <td>
    <![endif]-->
    <div class="email-container" style="{container_style}">
      
      <!-- Header -->
      <div class="header-area" style="{header_style}">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <span class="brand-text" style="{brand_text_style}">Delegate<span class="brand-accent" style="{brand_accent_style}">X</span></span>
            </td>
            <td align="right">
              <span class="system-badge" style="{system_badge_style}">CRM Notification</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Content Area -->
      <div style="{content_style}">
        {content}
      </div>

      <!-- Footer -->
      <div class="footer-area" style="{footer_style}">
        <p class="footer-text" style="{footer_text_style}">
          This is an automated notification from your DelegateX workspace.
        </p>
        <p class="footer-subtext" style="{footer_subtext_style}">
          Please do not reply directly to this email.
        </p>
      </div>

    </div>
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
  </div>
</body>
</html>
"""

def get_base_template(subject: str, content: str) -> str:
    return BASE_EMAIL_HTML.format(
        subject=subject,
        content=content,
        body_style=STYLES["body"],
        wrapper_style=STYLES["wrapper"],
        container_style=STYLES["container"],
        header_style=STYLES["header"],
        brand_text_style=STYLES["brand_text"],
        brand_accent_style=STYLES["brand_accent"],
        system_badge_style=STYLES["system_badge"],
        content_style=STYLES["content"],
        footer_style=STYLES["footer"],
        footer_text_style=STYLES["footer_text"],
        footer_subtext_style=STYLES["footer_subtext"]
    )
