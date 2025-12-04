from datetime import datetime, timezone
from typing import Annotated
from sqlalchemy import select, func, exists
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate

from app.models import User, Organization, CostRecord, SKU, Transaction
from app.schemas.valuation import (
    InventoryValuationRow,
    ValuationHeader,
    COGSResponse,
)
from app.core.auth.dependencies import get_current_user
from app.core.db import get_session
from app.services.currency_service import CurrencyService

router = APIRouter()


@router.get("/skus", response_model=Page[InventoryValuationRow])
async def get_inventory_valuation(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
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
            func.sum(CostRecord.qty_remaining * CostRecord.unit_cost_minor).label("total_value"),
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


@router.get("", response_model=ValuationHeader)
async def get_valuation(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
    sku_code: Annotated[
        str | None, 
        Query(
            description="Optional SKU code to filter valuation for a specific item",
        )
    ] = None,
):
    """
    Return organization-wide valuation summary (or for a specific SKU).
    
    Returns total inventory value, currency, valuation method, and timestamp.
    Can be filtered by SKU code to get valuation for a specific item.
    """

    # Validate SKU if provided
    if sku_code:
        sku_exists_query = select(exists().where(
            (SKU.code == sku_code) & 
            (SKU.org_id == user.org_id)
        ))
        sku_exists = await db.scalar(sku_exists_query)
        if not sku_exists:
            raise HTTPException(
                status_code=404, 
                detail=f"SKU '{sku_code}' not found in your workspace"
            )

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

    # Sum all remaining cost record values (with optional SKU filter)
    value_query = (
        select(func.sum(CostRecord.qty_remaining * CostRecord.unit_cost_minor))
        .where(CostRecord.org_id == user.org_id)
        .where(CostRecord.qty_remaining > 0)
    )
    
    if sku_code:
        value_query = value_query.where(CostRecord.sku_code == sku_code)
    
    value_result = await db.execute(value_query)
    total_value_minor = value_result.scalar() or 0

    currency_service = CurrencyService()
    total_value_major = currency_service.to_major_units(total_value_minor, currency)

    # Map valuation method to its full name
    method_map = {
        "FIFO": "First-In, First-Out",
        "LIFO": "Last-In, First-Out",
        "WAC": "Weighted Average Cost",
    }

    return ValuationHeader(
        total_value=total_value_major,
        currency=currency,
        method=valuation_method,
        method_full_name=method_map.get(valuation_method, valuation_method),
        timestamp=datetime.now(timezone.utc).isoformat(),
        sku_code=sku_code,  # Include in response if filtered
    )


@router.get("/cogs", response_model=COGSResponse)
async def get_cogs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
    sku_code: Annotated[
        str | None, 
        Query(
            description="Optional SKU code to calculate COGS for a specific item",
        )
    ] = None,
    start_date: Annotated[
        datetime | None,
        Query(
            description="Start date for COGS calculation period (ISO 8601 format)",
        )
    ] = None,
    end_date: Annotated[
        datetime | None,
        Query(
            description="End date for COGS calculation period (ISO 8601 format)",
        )
    ] = None,
):
    """
    Calculate total Cost of Goods Sold (COGS) for a specific period.
    
    COGS is calculated based on shipment transactions ('ship' action) and can be
    filtered by SKU code and/or date range.
    
    **Parameters:**
    - **sku_code**: Filter COGS for a specific item
    - **start_date**: Beginning of the calculation period (inclusive)
    - **end_date**: End of the calculation period (inclusive)
    """
    
    # Validate SKU existence
    if sku_code:
        sku_exists_query = select(exists().where(
            (SKU.code == sku_code) & 
            (SKU.org_id == user.org_id)
        ))
        sku_exists = await db.scalar(sku_exists_query)
        if not sku_exists:
            raise HTTPException(
                status_code=404, 
                detail=f"SKU '{sku_code}' not found in your organization"
            )

    # Fetch organization currency
    currency_query = select(Organization.currency).where(
        Organization.org_id == user.org_id
    )
    currency_result = await db.execute(currency_query)
    currency_row = currency_result.first()
    
    if not currency_row:
        raise HTTPException(
            status_code=404, 
            detail="Organization configuration not found"
        )
    
    currency = currency_row[0]

    # Build the COGS query
    query = (
        select(func.sum(func.coalesce(Transaction.total_cost_minor, 0)))
        .where(Transaction.org_id == user.org_id)
        .where(Transaction.action == 'ship')  # Only shipments count as COGS
        .where(Transaction.total_cost_minor.is_not(None))
    )

    # Apply filters
    if sku_code:
        query = query.where(Transaction.sku_code == sku_code)

    if start_date:
        query = query.where(Transaction.created_at >= start_date)
    
    if end_date:
        query = query.where(Transaction.created_at <= end_date)

    # Execute query
    result = await db.execute(query)
    total_cogs_minor = result.scalar() or 0

    # Format output
    currency_service = CurrencyService()
    total_cogs_major = currency_service.to_major_units(total_cogs_minor, currency)

    return COGSResponse(
        total_cogs=total_cogs_major,
        currency=currency,
        sku_code=sku_code,
        period_start=start_date,
        period_end=end_date
    )
    