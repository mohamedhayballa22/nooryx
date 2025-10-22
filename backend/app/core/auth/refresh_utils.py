import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from app.core.config import settings

REFRESH_TOKEN_LENGTH = 64

def generate_raw_refresh_token() -> str:
    return secrets.token_urlsafe(REFRESH_TOKEN_LENGTH)

def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def refresh_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
