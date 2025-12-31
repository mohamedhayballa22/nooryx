from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi_users import BaseUserManager
from fastapi_users.exceptions import UserAlreadyExists
from datetime import datetime, timedelta, timezone
from uuid import UUID
from uuid6 import uuid7

from app.core.auth.users import get_user_manager
from app.core.db import get_session
from app.models import Organization, User, Subscription
from app.core.auth.dependencies import get_current_admin
from app.core.auth.schemas import (
    AccessGrantRequest,
    AccessClaimRequest,
    AccessClaimResponse,
    UserCreate,
)
from app.core.auth.access_grants import create_access_grant_token, decode_access_grant_token
from app.services.emails.access_grant import send_access_grant_email, validate_access_grant_email
from app.core.logger_config import logger


router = APIRouter()


@router.post("/admin/access/grant", status_code=status.HTTP_204_NO_CONTENT)
async def grant_access(
    payload: AccessGrantRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    admin_user: User = Depends(get_current_admin),
):
    """
    [ADMIN ONLY] Grant access to create a new workspace.
    Generates a link with asecure token and sends it via email.
    """
    # Validate email synchronously
    normalized_email = validate_access_grant_email(payload.email)
    
    # Check if user already exists
    existing_user = await session.scalar(
        select(User.id)
        .where(User.email == normalized_email)
        .limit(1)
    )
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    
    # Generate token
    token, expires_at = create_access_grant_token(
        email=normalized_email,
        subscription_months=payload.subscription_months,
    )
    
    # Queue email sending in background
    background_tasks.add_task(
        send_access_grant_email,
        to_email=normalized_email,
        token=token,
        expires_at=expires_at,
    )
    
    logger.info(
        f"Access granted by admin {admin_user.email} to {normalized_email} "
        f"({payload.subscription_months} months)"
    )
    
    return None


@router.post("/access/claim", response_model=AccessClaimResponse, status_code=status.HTTP_201_CREATED)
async def claim_access(
    payload: AccessClaimRequest,
    request: Request,
    user_manager: BaseUserManager[User, UUID] = Depends(get_user_manager),
    session: AsyncSession = Depends(get_session),
):
    """
    Claim access using a token and create the workspace (organization, subscription, and user).
    All operations are atomic - if any step fails, everything rolls back.
    """
    # Decode and validate token
    try:
        token_data = decode_access_grant_token(payload.token)
        email = token_data["email"]
        subscription_months = token_data["subscription_months"]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Verify that the email from token matches (optional security check)
    if email != payload.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email in token"
        )
    
    
    # Check if user already exists (double-check)
    existing_user = await session.scalar(
        select(User.id).where(User.email == email).limit(1)
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists. Access already claimed or token invalid."
        )
    
    try:
        # Create Organization with data provided by beneficiary
        new_org = Organization(
            org_id=uuid7(),
            name=payload.company_name,
            currency=payload.currency,
            valuation_method=payload.valuation_method,
        )
        session.add(new_org)
        await session.flush()  # Ensures org_id is available
        
        # Calculate subscription period
        current_period_start = datetime.now(timezone.utc)
        current_period_end = current_period_start + timedelta(days=30 * subscription_months)
        
        # Create Subscription
        new_subscription = Subscription(
            org_id=new_org.org_id,
            plan_name="pro",
            status="active",
            current_period_start=current_period_start,
            current_period_end=current_period_end,
        )
        session.add(new_subscription)
        await session.flush()
        
        # Create the first user (admin of the org)
        user_create = UserCreate(
            email=email,
            password=payload.password,
            org_id=new_org.org_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        
        user = await user_manager.create(user_create, safe=True, request=request)
        
        await session.commit()
        
        logger.info(
            f"Access claimed successfully: user={user.email}, org={new_org.name}, "
            f"subscription_end={current_period_end}"
        )
        
        return AccessClaimResponse(
            org_id=new_org.org_id,
            user_id=user.id,
            email=user.email,
            org_name=new_org.name,
            subscription_end_date=current_period_end,
        )
        
    except UserAlreadyExists:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists. Access already claimed."
        )
    except Exception as e:
        await session.rollback()
        logger.error(f"Failed to claim access for {email}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workspace: {str(e)}"
        )
        