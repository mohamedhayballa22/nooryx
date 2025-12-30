import jwt
from datetime import datetime, timedelta, timezone
from jwt import ExpiredSignatureError, InvalidTokenError
from app.core.config import settings


def create_access_grant_token(email: str, subscription_months: int) -> tuple[str, datetime]:
    """
    Create a secure token for access grant with subscription details.
    Returns (token, expires_at)
    """
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.ACCESS_GRANT_TOKEN_EXPIRE_HOURS)
    payload = {
        "email": email,
        "subscription_months": subscription_months,
        "exp": expires_at,
        "type": "access_grant"
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, expires_at


def decode_access_grant_token(token: str) -> dict:
    """
    Decode and validate access grant token.
    Raises ValueError if invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        if payload.get("type") != "access_grant":
            raise ValueError("Invalid token type")
        
        return payload
    except (ExpiredSignatureError, InvalidTokenError):
        raise ValueError("Invalid or expired access grant token")
    