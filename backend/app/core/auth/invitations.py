import jwt
from datetime import datetime, timedelta, timezone
from uuid import UUID
from app.core.config import settings
from jwt import ExpiredSignatureError, InvalidTokenError

def create_invitation_token(org_id: UUID, org_name: str, email: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.INVITATION_TOKEN_EXPIRE_HOURS)
    payload = {
        "org_id": str(org_id),
        "org_name": org_name,
        "email": email,
        "exp": expires_at
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, expires_at


def decode_invitation_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except (ExpiredSignatureError, InvalidTokenError):
        raise ValueError("Invalid or expired invitation token")
