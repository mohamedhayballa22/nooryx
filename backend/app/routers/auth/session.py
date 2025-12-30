from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.models import RefreshToken, User
from app.core.auth.jwt import get_jwt_strategy, cookie_transport
from app.core.config import settings
from app.core.auth.refresh_utils import generate_raw_refresh_token, hash_refresh_token, refresh_expiry
from app.core.auth.dependencies import get_current_user
from datetime import datetime, timezone
from sqlalchemy import select, update, delete
from typing import List
from app.core.logger_config import logger
import hashlib
from app.core.auth.csrf_utils import create_csrf_token_with_timestamp

router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


@router.post("/issue_refresh")
async def issue_refresh(
    response: Response,
    request: Request,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Issue a new refresh token after successful login.
    
    This endpoint should be called immediately after login while the access token
    is still valid. It creates a fresh refresh token, stores its hash in the database,
    and sets a secure HTTP-only cookie.
    
    Security features:
    - Automatically cleans up expired tokens
    - Tracks device and IP information for audit purposes
    """
    # Clean up any expired tokens for this user first
    now = datetime.now(timezone.utc)
    await session.execute(
        delete(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.expires_at < now)
    )
    
    # Generate new refresh token
    raw = generate_raw_refresh_token()
    h = hash_refresh_token(raw)
    expires = refresh_expiry()

    # Capture device and network information for security auditing
    device_info = request.headers.get("User-Agent", None)
    ip = request.client.host if request.client else None

    token = RefreshToken(
        user_id=user.id,
        token_hash=h,
        created_at=now,
        last_used_at=now,
        expires_at=expires,
        device_info=device_info,
        ip_address=ip,
        revoked=0,
    )

    session.add(token)
    await session.commit()

    # Set secure refresh token cookie
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/",
    )

    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """
    Rotate refresh token and issue new access token and CSRF token.
    
    This endpoint implements refresh token rotation for enhanced security. When a valid
    refresh token is presented, it:
    1. Validates the token and checks for expiration/revocation
    2. Issues a new access token and refresh token
    3. Issues a new CSRF token (if enabled)
    4. Invalidates the old refresh token (by updating the same DB row)
    
    Security features:
    - Token rotation prevents replay attacks
    - Automatic breach detection: if a revoked/expired token is reused, all user sessions are terminated
    - Updates existing token row instead of creating new ones to prevent table bloat
    - Tracks last_used_at for session monitoring
    - CSRF token is refreshed alongside access token to prevent expiration issues
    """
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Missing refresh token"
        )

    h = hash_refresh_token(raw)
    now = datetime.now(timezone.utc)

    # Look up the token by hash and join with user
    q = await session.execute(
        select(RefreshToken, User)
        .join(User, RefreshToken.user_id == User.id)
        .where(RefreshToken.token_hash == h)
        .with_for_update()
    )
    result = q.one_or_none()

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid refresh token"
        )
    
    row, user = result

    if row.expires_at < now:
        await session.execute(
            delete(RefreshToken).where(RefreshToken.user_id == row.user_id)
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Refresh token expired"
        )

    if row.revoked:
        logger.warning(
            f"Revoked token reuse detected for user '{row.user_id}' - possible token theft. "
            f"Revoking all sessions. IP: {request.client.host if request.client else 'unknown'}"
        )
        await session.execute(
            delete(RefreshToken).where(RefreshToken.user_id == row.user_id)
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token compromised - all sessions revoked"
        )

    # Token is valid - perform rotation by updating the existing row
    new_raw = generate_raw_refresh_token()
    new_hash = hash_refresh_token(new_raw)
    new_expires = refresh_expiry()

    # Update the existing token row with new values
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.id == row.id)
        .values(
            token_hash=new_hash,
            last_used_at=now,
            expires_at=new_expires,
            revoked=0,
        )
    )
    await session.commit()

    # Generate new access token using the user from the refresh token
    jwt_strategy = get_jwt_strategy()
    access_token = await jwt_strategy.write_token(user)

    # Set new access token cookie
    response.set_cookie(
        key=cookie_transport.cookie_name,
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=cookie_transport.cookie_max_age,
        path="/",
    )

    # Set new refresh token cookie
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=new_raw,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/",
    )

    # Generate and set NEW CSRF token
    if settings.CSRF_ENABLED:
        csrf_token = create_csrf_token_with_timestamp()
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=csrf_token,
            httponly=False,  # Must be readable by JS
            secure=True,
            samesite="lax",
            max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
        )

    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Logout the user and terminate all active sessions.
    
    This endpoint revokes the refresh token for the current user and clears
    authentication cookies. This effectively logs the user out from their current session.
    """
    current_token = request.cookies.get("refresh_token")
    current_token_hash = (
        hashlib.sha256(current_token.encode()).hexdigest() if current_token else None
    )

    # Delete all refresh tokens for this user (cleanup instead of soft delete)
    await session.execute(
        delete(RefreshToken).where(RefreshToken.token_hash == current_token_hash, RefreshToken.user_id == user.id)
    )
    await session.commit()

    # Clear authentication cookies with matching parameters
    response.delete_cookie(
        key=cookie_transport.cookie_name,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax"
    )
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax"
    )
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path="/",
        secure=True,
        httponly=False,
        samesite="lax"
    )

    response.status_code = status.HTTP_204_NO_CONTENT
    return response

@router.delete("/{session_id}")
async def logout_session(
    session_id: str,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Revoke a specific refresh token/session by ID.
    
    This allows users to selectively terminate individual sessions from their
    active sessions list (e.g., "Sign out from my phone").
    
    Args:
        session_id: The ID of the refresh token to revoke
    """
    # Verify the session belongs to the current user before revoking
    result = await session.execute(
        select(RefreshToken)
        .where(RefreshToken.id == session_id)
        .where(RefreshToken.user_id == user.id)
    )
    token = result.scalar_one_or_none()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or does not belong to user"
        )
    
    # Delete the specific session
    await session.delete(token)
    await session.commit()
    
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("", response_model=List[dict])
async def sessions(
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve all active sessions for the current user.
    
    Returns a list of active refresh tokens with metadata useful for displaying
    on a "Manage Sessions" page. Each session includes:
    - Unique session ID
    - Creation and last use timestamps
    - Expiration date
    - Device information (User-Agent)
    - IP address
    
    Only non-revoked, non-expired sessions are returned.
    """
    now = datetime.now(timezone.utc)
    
    # Clean up expired tokens before returning the list
    await session.execute(
        delete(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.expires_at < now)
    )
    
    # Fetch active sessions
    q = await session.execute(
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.revoked == 0)
        .order_by(RefreshToken.last_used_at.desc())
    )
    rows = q.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "device_info": r.device_info,
            "ip_address": r.ip_address,
        }
        for r in rows
    ]


@router.get("/current")
async def get_current_session(
    request: Request,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Retrieve the current active session information.
    
    Returns metadata about the current session based on the refresh token cookie.
    Used by frontend on page reload to verify session validity and display user info.
    
    Returns:
    - Session metadata (creation time, last used, expiration, device info)
    - User information (id, email, name, org)
    - Session validity status
    
    If no valid refresh token is found, returns minimal user info from access token only.
    """
    now = datetime.now(timezone.utc)
    
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    
    # Base response with user info (always available from access token)
    response_data = {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "org_id": str(user.org_id),
        },
        "session": None,
    }
    
    # If refresh token exists, get session details
    if raw:
        h = hash_refresh_token(raw)
        
        q = await session.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == h)
            .where(RefreshToken.user_id == user.id)
            .where(RefreshToken.revoked == 0)
        )
        token = q.scalar_one_or_none()
        
        # Only include session info if token is valid and not expired
        if token and token.expires_at > now:
            response_data["session"] = {
                "id": str(token.id),
                "created_at": token.created_at.isoformat() if token.created_at else None,
                "last_used_at": token.last_used_at.isoformat() if token.last_used_at else None,
                "expires_at": token.expires_at.isoformat() if token.expires_at else None,
            }
    
    return response_data
