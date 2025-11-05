from fastapi import APIRouter, Depends, status
from app.core.auth.dependencies import get_current_user
from app.core.db import get_session
from app.models import Subscription
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel


router = APIRouter(prefix="/billing")

class SubscriptionResponse(BaseModel):
    plan_name: str
    status: str
    billing_frequency: str
    current_period_end: str


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_session),
    user=Depends(get_current_user)):

    subscription = (
        select(Subscription.plan_name,
               Subscription.status,
               Subscription.billing_frequency,
               Subscription.current_period_end)
               .where(Subscription.org_id == user.org_id)
               )
    result = await db.execute(subscription)
    plan_name, status, billing_frequency, current_period_end = result.first()

    return SubscriptionResponse(
        plan_name=plan_name,
        status=status,
        billing_frequency=billing_frequency,
        current_period_end=str(current_period_end)
    )


@router.post("/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_subscription(user=Depends(get_current_user)):
    # TODO: integrate provider logic
    return

@router.post("/renew", status_code=status.HTTP_204_NO_CONTENT)
async def renew_subscription(user=Depends(get_current_user)):
    # TODO: integrate provider logic
    return
