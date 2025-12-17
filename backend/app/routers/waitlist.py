from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr
from app.core.db import get_session
from app.models import Waitlist


router = APIRouter()


class WaitlistRequest(BaseModel):
    email: EmailStr


class WaitlistResponse(BaseModel):
    email: str
    created_at: str


@router.post("", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    request: WaitlistRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Add an email to the waitlist.
    
    - **email**: Valid email address (automatically deduplicated)
    
    Returns the waitlist entry. If email already exists, returns existing entry without error.
    """
    entry = Waitlist(email=request.email.lower())
    
    db.add(entry)
    
    try:
        await db.commit()
        await db.refresh(entry)
    except IntegrityError:
        # Email already exists - fetch and return existing entry
        await db.rollback()
        result = await db.get(Waitlist, request.email.lower())
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve waitlist entry"
            )
        entry = result
    
    return WaitlistResponse(
        email=entry.email,
        created_at=entry.created_at.isoformat()
    )
    