from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.db import get_session
from app.models import Organization
from app.core.auth.dependencies import get_current_user
from app.services.emails.feedback import send_feedback_notification_email
from app.schemas.feedback import FeedbackCreateRequest
from app.models import Feedback

router = APIRouter()

@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def submit_feedback(
    payload: FeedbackCreateRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user),
):
    """Submit feedback from an authenticated user."""
    
    # Get organization details
    org = await session.scalar(
        select(Organization).where(Organization.org_id == user.org_id)
    )
    
    # Create feedback record
    feedback = Feedback(
        org_id=user.org_id,
        user_id=user.id,
        message=payload.message,
        category=payload.category,
        feedback_metadata=payload.metadata,
    )
    
    session.add(feedback)
    await session.commit()
    await session.refresh(feedback)
    
    # Queue notification email in background
    background_tasks.add_task(
        send_feedback_notification_email,
        user_email=user.email,
        user_name=f"{user.first_name} {user.last_name}",
        org_name=org.name,
        feedback_message=payload.message,
        category=payload.category,
        feedback_id=str(feedback.id),
    )
    
    return None
