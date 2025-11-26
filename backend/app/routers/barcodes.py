from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session
from app.models import User, SKU, Barcode


router = APIRouter()

class LookupResponse(BaseModel):
    code: str
    org_id: UUID
    name: str
    alerts: bool
    low_stock_threshold: int
    reorder_point: int
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/lookup", response_model=Optional[LookupResponse])
async def lookup_barcode(
    value: str = Query(..., min_length=1, description="The barcode value to look up"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Look up a barcode and return its associated SKU.
    
    Returns the complete SKU if found, or null if not found.
    Uses the current user's organization context for the lookup.
    """
    stmt = (
        select(SKU)
        .join(Barcode, (Barcode.sku_code == SKU.code) & (Barcode.org_id == SKU.org_id))
        .where(
            Barcode.org_id == current_user.org_id,
            Barcode.value == value
        )
    )
    
    result = await db.execute(stmt)
    sku = result.scalar_one_or_none()
    
    if not sku:
        return None
    
    return sku
