from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session
from app.models import User, Organization, RefreshToken, UserSettings, OrganizationSettings, Subscription
from datetime import datetime, timezone
from app.schemas.settings import (
    SettingsUpdateRequest, ORG_SETTINGS_DEFAULTS, 
    USER_SETTINGS_DEFAULTS, SUPPORTED_LOCALES,
    SettingsResponse, SKUThresholdsUpdateRequest,
    UserAccountResponse)
from app.models import SKU
import hashlib

router = APIRouter()


@router.get("/account", response_model=UserAccountResponse)
async def get_user_profile(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Get the current user's profile information including organization details,
    subscription information, and all active sessions.
    """
    now = datetime.now(timezone.utc)
    
    # Fetch organization info
    org_stmt = select(Organization).where(Organization.org_id == user.org_id)
    organization = (await db.execute(org_stmt)).scalar_one()
    
    # Fetch subscription info
    subscription_stmt = select(
        Subscription.plan_name,
        Subscription.status,
        Subscription.billing_frequency,
        Subscription.current_period_end
    ).where(Subscription.org_id == user.org_id)
    subscription_data = (await db.execute(subscription_stmt)).first()
    
    # Fetch active sessions for user
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
    
    # Build subscription response (handle case where subscription might not exist)
    subscription = None
    if subscription_data:
        subscription = {
            "plan_name": subscription_data[0],
            "status": subscription_data[1],
            "billing_frequency": subscription_data[2],
            "current_period_end": str(subscription_data[3]),
        }
    
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
        subscription=subscription,
        sessions=session_dicts,
    )


@router.get("", response_model=SettingsResponse)
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

    # Fetch organization
    org_query = select(Organization).where(Organization.org_id == user.org_id)
    organization = (await db.execute(org_query)).scalar_one()

    combined_settings = {**ORG_SETTINGS_DEFAULTS, **USER_SETTINGS_DEFAULTS}
    
    if org_settings:
        combined_settings.update({
            "alerts": org_settings.alerts,
            "default_reorder_point": org_settings.default_reorder_point,
            "default_low_stock_threshold": org_settings.default_low_stock_threshold,
        })
    
    combined_settings.update({
        "currency": organization.currency,
        "valuation_method": organization.valuation_method,
    })
    
    if user_settings:
        combined_settings.update({
            "locale": user_settings.locale,
            "pagination": user_settings.pagination,
            "date_format": user_settings.date_format,
        })

    return combined_settings


@router.patch("", status_code=status.HTTP_204_NO_CONTENT)
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
    print(f"Update settings: {settings_update}")

    # Check if any fields were provided
    update_data = settings_update.model_dump(exclude_unset=True)
    if not update_data:
        return

    # Organization-level settings
    org_fields = {"default_low_stock_threshold", "default_reorder_point", "alerts"}
    org_updates = {k: v for k, v in update_data.items() if k in org_fields}
    
    # User-level settings
    user_fields = {"locale", "pagination", "date_format"}
    user_updates = {k: v for k, v in update_data.items() if k in user_fields}

    # Validate locale if present (applies to both user and org settings)
    if "locale" in user_updates and user_updates["locale"] not in SUPPORTED_LOCALES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported locale",
        )
    
    # Update user role field
    if "role" in update_data:
        user_update_stmt = (
            update(User)
            .where(User.id == user.id)
            .values(role=update_data["role"])
        )
        await db.execute(user_update_stmt)
    
    # Update or create OrganizationSettings
    if org_updates:
        org_stmt = select(OrganizationSettings).where(OrganizationSettings.org_id == user.org_id)
        org_settings = (await db.execute(org_stmt)).scalar_one_or_none()
        
        if org_settings:
            # Update existing
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


@router.patch("/{sku_code}", status_code=status.HTTP_204_NO_CONTENT)
async def update_stock_optimized(
    sku_code: str,
    update_data: SKUThresholdsUpdateRequest,
    db: AsyncSession = Depends(get_tenant_session),
):
    """ Update the stock thresholds and alerts for a specific SKU. """
    
    update_data_dict = update_data.model_dump(exclude_unset=True)
    
    if not update_data_dict:
        return
        
    update_stmt = (
        update(SKU)
        .where(SKU.code == sku_code)
        .values(update_data_dict)
    )
    
    result = await db.execute(update_stmt)
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SKU '{sku_code}' not found.",
        )
    
    await db.commit()
        
    return
