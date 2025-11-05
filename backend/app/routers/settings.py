from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session
from app.models import User, Organization, RefreshToken
from app.schemas.settings import UserAccountResponse
from datetime import datetime, timezone
import hashlib

router = APIRouter()


@router.get("/account", response_model=UserAccountResponse)
async def get_user_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Get the current user's profile information including organization details
    and all active sessions, with the current session listed first.
    """

    # Fetch organization info
    org_stmt = select(Organization).where(Organization.org_id == current_user.org_id)
    organization = (await db.execute(org_stmt)).scalar_one()

    # Fetch active sessions for user
    now = datetime.now(timezone.utc)
    sessions_stmt = (
        select(RefreshToken)
        .where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked == 0,
            RefreshToken.expires_at > now,
        )
        .order_by(RefreshToken.last_used_at.desc())
    )
    sessions = (await db.execute(sessions_stmt)).scalars().all()

    # Compute current session hash
    current_token = request.cookies.get("refresh_token")
    current_token_hash = (
        hashlib.sha256(current_token.encode()).hexdigest() if current_token else None
    )

    # Prepare sessions list with is_current flag
    session_dicts = [
        {
            "id": str(session.id),
            "device_info": session.device_info,
            "ip_address": session.ip_address,
            "last_used_at": session.last_used_at,
            "expires_at": session.expires_at,
            "is_current": session.token_hash == current_token_hash,
        }
        for session in sessions
    ]

    # Ensure current session is listed first
    session_dicts.sort(key=lambda s: not s["is_current"])

    # Build and return response
    return UserAccountResponse(
        user={
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
            "role": current_user.role,
            "created_at": current_user.created_at,
        },
        organization={
            "name": organization.name,
            "created_at": organization.created_at,
        },
        sessions=session_dicts,
    )
