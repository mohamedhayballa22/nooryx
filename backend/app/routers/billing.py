from fastapi import APIRouter, Depends, status
from app.core.auth.dependencies import get_current_user
from app.core.db import get_session
from app.models import Subscription
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel


router = APIRouter()


@router.post("/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_subscription(user=Depends(get_current_user)):
    # TODO: integrate provider logic
    return

@router.post("/renew", status_code=status.HTTP_204_NO_CONTENT)
async def renew_subscription(user=Depends(get_current_user)):
    # TODO: integrate provider logic
    return
