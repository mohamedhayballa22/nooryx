from fastapi import APIRouter, Body, Depends, Query, HTTPException, status
from app.services.barcodes import link_barcode
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session
from app.models import User, SKU, Barcode


router = APIRouter()

class LookupResponse(BaseModel):
    code: str
    name: str
    alerts: bool
    low_stock_threshold: int
    reorder_point: int
    
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


@router.post("/link", status_code=status.HTTP_204_NO_CONTENT)
async def link_barcode_to_sku(
    sku_code: str = Body(..., description="The SKU code to link"),
    barcode_value: str = Body(..., min_length=1, description="The barcode value to link"),
    barcode_format: Optional[str] = Body(None, description="The barcode format (e.g., EAN13, UPC)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Link a barcode to an SKU.
    
    Creates a barcode-SKU relationship. If the barcode already exists,
    the operation is idempotent and will succeed without modification.
    """
    # Verify SKU exists
    sku_stmt = select(SKU).where(
        SKU.org_id == current_user.org_id,
        SKU.code == sku_code
    )
    result = await db.execute(sku_stmt)
    sku = result.scalar_one_or_none()
    
    if not sku:
        raise HTTPException(
            status_code=404,
            detail=f"SKU '{sku_code}' not found"
        )
    
    # Link barcode to SKU
    await link_barcode(
        db=db,
        org_id=current_user.org_id,
        value=barcode_value,
        sku_code=sku_code,
        format=barcode_format
    )
    
    await db.commit()
    
    return
