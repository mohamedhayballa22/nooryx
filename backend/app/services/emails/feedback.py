import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from app.core.logger_config import logger
from app.core.config import settings


async def send_feedback_notification_email(
    user_email: str,
    user_name: str,
    org_name: str,
    feedback_message: str,
    category: str | None,
    feedback_id: str,
):
    """Send internal notification email when feedback is submitted."""
    
    try:
        # Create plain text version
        category_text = f"Category: {category}\n" if category else ""
        
        text_content = f"""
New Feedback Received

From: {user_name} ({user_email})
Organization: {org_name}
{category_text}
Feedback ID: {feedback_id}

Message:
{feedback_message}

---

This is an automated notification from Nooryx.
        """.strip()
        
        # Create HTML version
        category_html = f"<p style='margin: 4px 0; font-size: 14px; color: #666666;'><strong>Category:</strong> {category}</p>" if category else ""
        
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #fafafa;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px;">
                    <tr>
                        <td style="padding: 32px;">
                            <h1 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #0a0a0a;">
                                New Feedback Received
                            </h1>
                            
                            <div style="margin-bottom: 24px; padding: 16px; background-color: #f5f5f5; border-radius: 8px;">
                                <p style="margin: 4px 0; font-size: 14px; color: #666666;"><strong>From:</strong> {user_name} ({user_email})</p>
                                <p style="margin: 4px 0; font-size: 14px; color: #666666;"><strong>Organization:</strong> {org_name}</p>
                                {category_html}
                                <p style="margin: 4px 0; font-size: 14px; color: #666666;"><strong>Feedback ID:</strong> {feedback_id}</p>
                            </div>
                            
                            <div style="margin-bottom: 16px;">
                                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a;">Message:</p>
                                <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6; white-space: pre-wrap;">{feedback_message}</p>
                            </div>
                            
                            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;">
                            
                            <p style="margin: 0; font-size: 13px; color: #999999;">
                                This is an automated notification from Nooryx.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        """.strip()
        
        # Create email message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"New Feedback from {org_name}"
        message["From"] = formataddr(("Nooryx Feedback", settings.FROM_EMAIL))
        message["To"] = settings.FROM_EMAIL  # Send to ourselves
        
        part1 = MIMEText(text_content, "plain")
        message.attach(part1)
        
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
        logger.error(f"Failed to send feedback notification email for ID {feedback_id}: {str(e)}", exc_info=True)
        