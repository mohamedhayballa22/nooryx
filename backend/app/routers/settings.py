from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session
from app.models import User, Organization, RefreshToken, UserSettings, OrganizationSettings
from app.schemas.settings import UserAccountResponse
from datetime import datetime, timezone
from app.schemas.settings import SettingsUpdateRequest, ORG_SETTINGS_DEFAULTS, USER_SETTINGS_DEFAULTS, SUPPORTED_LOCALES
import hashlib

router = APIRouter()


@router.get("/account", response_model=UserAccountResponse)
async def get_user_profile(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Get the current user's profile information including organization details
    and all active sessions, with the current session listed first.
    """

    # Fetch organization info
    org_stmt = select(Organization).where(Organization.org_id == user.org_id)
    organization = (await db.execute(org_stmt)).scalar_one()

    # Fetch active sessions for user
    now = datetime.now(timezone.utc)
    sessions_stmt = (
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user.id,
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
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at,
        },
        organization={
            "name": organization.name,
            "created_at": organization.created_at,
        },
        sessions=session_dicts,
    )


@router.get("/")
async def get_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Return combined settings for the current user.
    Includes both user-specific and organization-wide settings,
    merged into a single flat object.
    """

    # Fetch user-level settings
    user_stmt = select(UserSettings).where(UserSettings.user_id == user.id)
    user_settings = (await db.execute(user_stmt)).scalar_one_or_none()

    # Fetch org-level settings
    org_stmt = select(OrganizationSettings).where(
        OrganizationSettings.org_id == user.org_id
    )
    org_settings = (await db.execute(org_stmt)).scalar_one_or_none()

    combined_settings = {**ORG_SETTINGS_DEFAULTS, **USER_SETTINGS_DEFAULTS}
    
    if org_settings:
        combined_settings.update({
            "low_stock_threshold": org_settings.low_stock_threshold,
            "reorder_point": org_settings.reorder_point,
        })
    
    if user_settings:
        combined_settings.update({
            "locale": user_settings.locale,
            "pagination": user_settings.pagination,
            "date_format": user_settings.date_format,
        })

    return combined_settings


@router.patch("/", status_code=status.HTTP_204_NO_CONTENT)
async def update_settings(
    settings_update: SettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Update user or organization settings.
    Creates settings records if they don't exist.
    Only updates provided fields.
    """
    
    # Check if any fields were provided
    update_data = settings_update.model_dump(exclude_unset=True)
    if not update_data:
        return

    # Organization-level settings
    org_fields = {"low_stock_threshold", "reorder_point"}
    org_updates = {k: v for k, v in update_data.items() if k in org_fields}
    
    # User-level settings
    user_fields = {"locale", "pagination", "date_format"}
    user_updates = {k: v for k, v in update_data.items() if k in user_fields}

    # Validate numeric fields
    if "pagination" in user_updates and (user_updates["pagination"] < 1 or user_updates["pagination"] > 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pagination must be between 1 and 100",
        )
    
    if "low_stock_threshold" in org_updates and org_updates["low_stock_threshold"] < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Low stock threshold must be non-negative",
        )

    if "reorder_point" in org_updates and org_updates["reorder_point"] < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reorder point must be non-negative",
        )
    
    # User job title field
    if "role" in update_data:
        user.role = update_data["role"]
    
    # Update or create OrganizationSettings
    if org_updates:
        if "locale" in user_updates and user_updates["locale"] not in [
            "en-US", "en-GB", "fr-FR", "es-ES", "de-DE", "pt-BR"
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid locale",
            )
            for key, value in org_updates.items():
                setattr(org_settings, key, value)
        else:
            # Create new
            org_settings = OrganizationSettings(
                org_id=user.org_id,
                **org_updates
            )
            db.add(org_settings)
    
    # Update or create UserSettings
    if user_updates:
        if "locale" in user_updates and user_updates["locale"] not in SUPPORTED_LOCALES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid locale",
            )
        
        user_stmt = select(UserSettings).where(UserSettings.user_id == user.id)
        user_settings = (await db.execute(user_stmt)).scalar_one_or_none()
        
        if user_settings:
            # Update existing
            for key, value in user_updates.items():
                setattr(user_settings, key, value)
        else:
            # Create new
            user_settings = UserSettings(
                user_id=user.id,
                **user_updates
            )
            db.add(user_settings)
    
    await db.commit()
    
    return
