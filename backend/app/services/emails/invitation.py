import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader
from datetime import datetime
from pathlib import Path
from app.core.logger_config import logger
from app.core.config import settings
from email_validator import validate_email, EmailNotValidError


# Setup Jinja2
template_dir = Path(__file__).parent.parent.parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(template_dir)))


def validate_invitation_email(email: str, inviter_email: str) -> str:
    """
    Validate email address synchronously before queuing.
    Returns normalized email if valid, raises HTTPException otherwise.
    """
    try:
        valid = validate_email(email, check_deliverability=True)
        normalized = valid.normalized
    except EmailNotValidError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid email address: {str(e)}"
        )
    
    # Prevent self-invitation
    if normalized.lower() == inviter_email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself"
        )
    
    return normalized


async def send_invitation_email(
    to_email: str,
    org_name: str,
    inviter_name: str,
    token: str,
    expires_at: datetime,
):
    """Send an invitation email to a user. Email is pre-validated."""
    
    try:
        # Construct URLs
        invitation_url = f"{settings.FRONTEND_URL}/invitation?token={token}"
        web_version_url = f"{settings.FRONTEND_URL}/emails/invitation/{token}"
        
        # Render HTML template
        try:
            template = jinja_env.get_template("invitation_email.html")
            html_content = template.render(
                org_name=org_name,
                inviter_name=inviter_name,
                invitation_url=invitation_url,
                web_version_url=web_version_url,
                expires_at=expires_at.strftime("%B %d, %Y at %I:%M %p UTC"),
                support_email=settings.SUPPORT_EMAIL,
            )
        except Exception as e:
            logger.error(f"Template rendering failed for invitation email: {str(e)}", exc_info=True)
            html_content = None
        
        # Create plain text version
        text_content = f"""
You've been invited to join {org_name} on Nooryx

{inviter_name} has invited you to join {org_name}.

Click the link below to accept the invitation:
{invitation_url}

This invitation expires on {expires_at.strftime("%B %d, %Y at %I:%M %p UTC")}

---

If you weren't expecting this invitation, you can safely ignore this email.

View this email in your browser: {web_version_url}

Questions? Contact us at {settings.SUPPORT_EMAIL}
        """.strip()
        
        # Create email message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"Join {org_name} on Nooryx"
        message["From"] = formataddr(("Nooryx", settings.FROM_EMAIL))
        message["To"] = to_email
        
        part1 = MIMEText(text_content, "plain")
        message.attach(part1)
        
        if html_content:
            part2 = MIMEText(html_content, "html")
            message.attach(part2)
        
        # Send email
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
            timeout=10,
        )
        
    except Exception as e:
        # Log but don't raise - this is in background task
        logger.error(f"Failed to send invitation email to {to_email}: {str(e)}", exc_info=True)
