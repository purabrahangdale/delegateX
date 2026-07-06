from .styles import STYLES

CLIENT_WELCOME_TEMPLATE = """<h1 style="{h1_style}">Welcome to DelegateX</h1>

<p style="{p_style}">
  Dear {client_name},
</p>

<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">
  Thank you for connecting with us.
</p>

<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">
  We have received your enquiry regarding <strong>{enquiry_name}</strong> and our team is reviewing your requirements.
</p>

<p style="{p_style}">
  Our team will contact you shortly.
</p>
"""

def get_client_welcome_content(client_name: str, enquiry_name: str) -> str:
    return CLIENT_WELCOME_TEMPLATE.format(
        client_name=client_name,
        enquiry_name=enquiry_name,
        h1_style=STYLES["h1"],
        p_style=STYLES["p"]
    )
