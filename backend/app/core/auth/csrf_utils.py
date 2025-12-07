import secrets
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from app.core.config import settings


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(32)


def create_csrf_token_with_timestamp() -> str:
    """
    Create a CSRF token with embedded timestamp for expiration checking.
    """
    timestamp = int(datetime.now(timezone.utc).timestamp())
    token = generate_csrf_token()
    
    # Create HMAC signature of token + timestamp
    message = f"{token}:{timestamp}".encode()
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        message,
        hashlib.sha256
    ).hexdigest()
    
    return f"{token}:{timestamp}:{signature}"


def verify_csrf_token(token: str) -> bool:
    """
    Verify CSRF token is valid and not expired.
    Returns True if valid, False otherwise.
    """
    if not token:
        return False
    
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return False
        
        token_value, timestamp_str, signature = parts
        timestamp = int(timestamp_str)
        
        # Verify HMAC signature
        message = f"{token_value}:{timestamp_str}".encode()
        expected_signature = hmac.new(
            settings.SECRET_KEY.encode(),
            message,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            return False
        
        # Check expiration
        token_age = datetime.now(timezone.utc).timestamp() - timestamp
        max_age = settings.CSRF_TOKEN_EXPIRE_MINUTES * 60
        
        if token_age > max_age:
            return False
        
        return True
        
    except (ValueError, AttributeError):
        return False
    