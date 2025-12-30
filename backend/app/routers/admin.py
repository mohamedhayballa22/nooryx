from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import get_session
from app.core.auth.dependencies import get_current_admin
from app.models import Organization, Waitlist, NooryxAdmin
from fastapi_pagination.ext.sqlalchemy import apaginate
from fastapi_pagination import Page
from pydantic import BaseModel, EmailStr
from datetime import datetime


router = APIRouter()


# Response schemas
class UserInOrgResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    role: Optional[str]
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrganizationResponse(BaseModel):
    org_id: UUID
    name: str
    valuation_method: str
    currency: str
    created_at: datetime
    updated_at: Optional[datetime]
    users: list[UserInOrgResponse]
    
    class Config:
        from_attributes = True


class WaitlistResponse(BaseModel):
    email: EmailStr
    created_at: datetime
    
    class Config:
        from_attributes = True


class AdminUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True
        
        
class FeedbackResponse(BaseModel):
    id: UUID
    org_id: UUID
    org_name: str
    user_id: Optional[UUID]
    user_email: Optional[str]
    user_name: Optional[str]
    message: str
    category: Optional[str]
    feedback_metadata: Optional[dict]
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get(
    "/organizations",
    response_model=Page[OrganizationResponse],
    summary="Get paginated organizations",
    description="""
    Retrieve all organizations with their users.
    
    Results are ordered by creation date (newest first).
    Includes user count and full user details for each organization.
    
    Admin access only.
    """
)
async def get_organizations(
    current_admin: NooryxAdmin = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Get paginated list of all organizations with users."""
    
    query = (
        select(Organization)
        .options(selectinload(Organization.users))
        .order_by(Organization.created_at.desc())
    )
    
    page = await apaginate(session, query)
    
    # Transform to include user_count
    items = []
    for org in page.items:
        org_dict = {
            "org_id": org.org_id,
            "name": org.name,
            "valuation_method": org.valuation_method,
            "currency": org.currency,
            "created_at": org.created_at,
            "updated_at": org.updated_at,
            "user_count": len(org.users),
            "users": [
                UserInOrgResponse(
                    id=user.id,
                    email=user.email,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    role=user.role,
                    is_active=user.is_active,
                    is_verified=user.is_verified,
                    created_at=user.created_at
                )
                for user in org.users
            ]
        }
        items.append(OrganizationResponse(**org_dict))
    
    return Page(
        items=items,
        total=page.total,
        page=page.page,
        size=page.size,
        pages=page.pages
    )


@router.get(
    "/waitlist",
    response_model=Page[WaitlistResponse],
    summary="Get paginated waitlist emails",
    description="""
    Retrieve all waitlist email signups.
    
    Results are ordered by signup date (newest first).
    
    Admin access only.
    """
)
async def get_waitlist(
    current_admin: NooryxAdmin = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Get paginated list of waitlist emails."""
    
    query = (
        select(Waitlist)
        .order_by(Waitlist.created_at.desc())
    )
    
    return await apaginate(session, query)


@router.get(
    "/admins",
    response_model=Page[AdminUserResponse],
    summary="Get paginated admin users",
    description="""
    Retrieve all Nooryx admin users.
    
    Results are ordered by creation date (newest first).
    
    Admin access only.
    """
)
async def get_admin_users(
    current_admin: NooryxAdmin = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session)
):
    """Get paginated list of admin users."""
    
    query = (
        select(NooryxAdmin)
        .order_by(NooryxAdmin.created_at.desc())
    )
    
    return await apaginate(session, query)
