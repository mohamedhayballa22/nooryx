from typing import Optional, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.auth.dependencies import get_current_user
from app.models import User
from app.services.alert_service import AlertService
from app.schemas.alerts import (
    AlertListResponse,
    UnreadCountResponse,
    MarkReadResponse
)


router = APIRouter()


# ============================================================================
# Main Alert Endpoints
# ============================================================================

@router.get(
    "",
    response_model=AlertListResponse,
    summary="Get paginated alerts",
    description="""
    Retrieve alerts for the authenticated user's organization with pagination.
    
    Supports filtering by:
    - Read status (read/unread/all)
    - Alert type (team_member_joined/low_stock/all)
    
    Results are ordered by creation date (newest first).
    """
)
async def get_alerts(
    read: Optional[Literal["read", "unread"]] = None,
    type: Optional[Literal["team_member_joined", "low_stock"]] = None,
    page: int = 1,
    per_page: int = 25,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get paginated alerts for the current user's organization."""
    
    # Validate pagination params
    if page < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page must be >= 1"
        )
    if per_page < 1 or per_page > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Per page must be between 1 and 100"
        )
    
    alert_service = AlertService(session, current_user.org_id)
    
    alerts, total = await alert_service.get_alerts(
        user_id=current_user.id,
        read_filter=read,
        alert_type=type,
        page=page,
        per_page=per_page
    )
    
    # Get unread count for response
    unread_count = await alert_service.get_unread_count(current_user.id)
    
    # Calculate total pages
    pages = (total + per_page - 1) // per_page if total > 0 else 0
    
    return AlertListResponse(
        alerts=alerts,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
        unread_count=unread_count
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread alert count",
    description="""
    Fast endpoint for sidebar badge that returns only the count of unread alerts.
    
    Frontend should poll this endpoint every 30 seconds or on navigation.
    """
)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get count of unread alerts for sidebar badge."""
    
    alert_service = AlertService(session, current_user.org_id)
    count = await alert_service.get_unread_count(current_user.id)
    
    return UnreadCountResponse(count=count)


@router.post(
    "/{alert_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark alert as read",
    description="Mark a specific alert as read for the current user."
)
async def mark_alert_as_read(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Mark a single alert as read."""
    
    alert_service = AlertService(session, current_user.org_id)
    
    try:
        await alert_service.mark_as_read(alert_id, current_user.id)
        await session.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/read-all",
    response_model=MarkReadResponse,
    summary="Mark all alerts as read",
    description="Mark all alerts as read for the current user in one operation."
)
async def mark_all_alerts_as_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Mark all alerts as read for the current user."""
    
    alert_service = AlertService(session, current_user.org_id)
    
    marked_count = await alert_service.mark_all_as_read(current_user.id)
    await session.commit()
    
    return MarkReadResponse(marked_count=marked_count)
