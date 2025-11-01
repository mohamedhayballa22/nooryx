from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException

from app.models import User, Organization, CostRecord, SKU
from app.schemas.valuation import (
    InventoryValuationRow,
    ValuationHeader,
)
from app.core.auth.dependencies import get_current_user
from app.core.db import get_session
from fastapi_pagination.ext.sqlalchemy import apaginate
from fastapi_pagination import Page
from app.services.currency_service import CurrencyService

router = APIRouter(prefix="/valuation")

@router.get("/skus", response_model=Page[InventoryValuationRow])
async def get_inventory_valuation(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Return a paginated SKU-wise valuation breakdown for an organization.
    Shows quantity, average cost, and total value per SKU.
    """

    # Fetch valuation method + currency
    result = await db.execute(
        select(Organization.currency)
        .where(Organization.org_id == user.org_id)
    )
    currency_row = result.first()
    
    if not currency_row:
        raise HTTPException(status_code=404, detail="Organization currency not found")
    
    currency = currency_row[0]

    # Base query: aggregate remaining cost records by SKU
    query = (
        select(
            CostRecord.sku_code.label("sku_code"),
            SKU.name.label("name"),
            func.sum(CostRecord.qty_remaining).label("total_qty"),
            func.sum(CostRecord.qty_remaining * CostRecord.cost_price).label("total_value"),
        )
        .join(SKU, (SKU.code == CostRecord.sku_code) & (SKU.org_id == CostRecord.org_id))
        .where(CostRecord.org_id == user.org_id)
        .where(CostRecord.qty_remaining > 0)
        .group_by(CostRecord.sku_code, SKU.name)
        .order_by(SKU.name.asc())
    )

    currency_service = CurrencyService()

    return await apaginate(
        db,
        query,
        transformer=lambda rows: [
            InventoryValuationRow(
                sku_code=row.sku_code,
                name=row.name,
                total_qty=row.total_qty,
                avg_cost=currency_service.to_major_units(
                    (row.total_value // row.total_qty) if row.total_qty else 0, 
                    currency
                    ),
                total_value=currency_service.to_major_units(row.total_value, currency),
                currency=currency,
            )
            for row in rows
        ],
    )


@router.get("/", response_model=ValuationHeader)
async def get_valuation_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Return organization-wide valuation summary:
    total inventory value, currency, valuation method, and timestamp.
    """

    # Fetch org valuation method & currency
    result = await db.execute(
        select(
            Organization.valuation_method,
            Organization.currency
        ).where(Organization.org_id == user.org_id)
    )
    org = result.first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    valuation_method, currency = org

    # Sum all remaining cost record values
    value_result = await db.execute(
        select(func.sum(CostRecord.qty_remaining * CostRecord.cost_price))
        .where(CostRecord.org_id == user.org_id)
        .where(CostRecord.qty_remaining > 0)
    )

    total_value_minor = value_result.scalar() or 0

    currency_service = CurrencyService()
    total_value_major = currency_service.to_major_units(total_value_minor, currency)

    # Optional: map valuation method to its full name
    method_map = {
        "FIFO": "First-In, First-Out",
        "LIFO": "Last-In, First-Out",
        "WAC": "Weighted Average Cost",
    }

    return ValuationHeader(
        total_value=str(total_value_major),
        currency=currency,
        method=valuation_method,
        method_full_name=method_map.get(valuation_method, valuation_method),
        timestamp=datetime.now(timezone.utc).isoformat(),
        locale="en-US",  # temporary hardcoded
    )
