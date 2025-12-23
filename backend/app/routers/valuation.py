from datetime import date, datetime, timezone, timedelta
import re
from typing import Annotated, Literal
from sqlalchemy import select, func, exists
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate

from app.models import User, Organization, CostRecord, SKU, Transaction
from app.schemas.valuation import (
    InventoryValuationRow,
    ValuationHeader,
    COGSResponse,
    COGSTrendResponse,
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

    # Calculate delta (only when start_date is provided)
    delta = None
    
    if start_date:
        # Use end_date if provided, otherwise use now
        effective_end_date = end_date if end_date else datetime.now(timezone.utc)
        
        # Calculate the period duration
        period_duration = effective_end_date - start_date
        
        # Calculate previous period dates
        previous_period_end = start_date
        previous_period_start = start_date - period_duration
        
        # Query for current period COGS
        current_period_query = (
            select(func.sum(func.coalesce(Transaction.total_cost_minor, 0)))
            .where(Transaction.org_id == user.org_id)
            .where(Transaction.action == 'ship')
            .where(Transaction.total_cost_minor.is_not(None))
            .where(Transaction.created_at >= start_date)
            .where(Transaction.created_at <= effective_end_date)
        )
        if sku_code:
            current_period_query = current_period_query.where(Transaction.sku_code == sku_code)
        
        current_period_result = await db.execute(current_period_query)
        current_period_cogs = current_period_result.scalar() or 0
        
        # Query for previous period COGS
        previous_period_query = (
            select(func.sum(func.coalesce(Transaction.total_cost_minor, 0)))
            .where(Transaction.org_id == user.org_id)
            .where(Transaction.action == 'ship')
            .where(Transaction.total_cost_minor.is_not(None))
            .where(Transaction.created_at >= previous_period_start)
            .where(Transaction.created_at < previous_period_end)
        )
        if sku_code:
            previous_period_query = previous_period_query.where(Transaction.sku_code == sku_code)
        
        previous_period_result = await db.execute(previous_period_query)
        previous_period_cogs = previous_period_result.scalar() or 0
        
        # Calculate percentage change
        if previous_period_cogs > 0:
            delta = ((current_period_cogs - previous_period_cogs) / previous_period_cogs) * 100
        else:
            delta = None
    else:
        delta = 0.0

    # Format output
    currency_service = CurrencyService()
    total_cogs_major = currency_service.to_major_units(total_cogs_minor, currency)

    return COGSResponse(
        total_cogs=total_cogs_major,
        currency=currency,
        sku_code=sku_code,
        period_start=start_date,
        period_end=end_date,
        delta_percentage=delta,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    
    
@router.get("/cogs/trend", response_model=COGSTrendResponse)
async def get_cogs_trend(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
    granularity: Annotated[
        Literal["daily", "weekly", "monthly"],
        Query(description="Time interval for aggregation")
    ] = "daily",
    period: Annotated[
        str,
        Query(
            description="Lookback period in days (e.g., '30d'). Only applies to 'daily' granularity.",
            pattern=r"^\d+d$"
        )
    ] = "30d",
    sku_code: Annotated[
        str | None,
        Query(description="Optional SKU code to filter COGS for a specific item")
    ] = None,
):
    """
    Get COGS trend data for plotting over time.
    
    For 'daily' granularity: Returns data points for the specified period (up to the oldest data point).
    For 'weekly' and 'monthly': Returns all available data up to the oldest data point.
    
    Always returns complete data - intervals with no shipments show COGS of 0.
    Never extrapolates before the oldest available data.
    """
    
    # Parse and validate period
    match = re.match(r"^(\d+)d$", period)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Period must be in format '<number>d' (e.g., '30d')"
        )
    
    days = int(match.group(1))
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=400,
            detail="Period must be between 1 and 365 days"
        )
    
    # Validate SKU if provided
    if sku_code:
        from app.models import SKU
        sku_exists = await db.scalar(
            select(func.count()).where(
                (SKU.code == sku_code) & (SKU.org_id == user.org_id)
            )
        )
        if not sku_exists:
            raise HTTPException(
                status_code=404,
                detail=f"SKU '{sku_code}' not found in your organization"
            )
    
    # Fetch organization currency
    currency = await db.scalar(
        select(Organization.currency).where(Organization.org_id == user.org_id)
    )
    if not currency:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Find the oldest transaction date
    oldest_query = (
        select(func.min(Transaction.created_at))
        .where(Transaction.org_id == user.org_id)
        .where(Transaction.action == 'ship')
        .where(Transaction.total_cost_minor.is_not(None))
    )
    if sku_code:
        oldest_query = oldest_query.where(Transaction.sku_code == sku_code)
    
    oldest_transaction = await db.scalar(oldest_query)
    oldest_data_point = oldest_transaction.date() if oldest_transaction else None
    
    # Return empty if no data exists
    if not oldest_data_point:
        return COGSTrendResponse(oldest_data_point=None, points=[])
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    
    if granularity == "daily":
        # Use requested period, but don't extrapolate before oldest data
        start_date = max(
            end_date - timedelta(days=days),
            datetime.combine(oldest_data_point, datetime.min.time()).replace(tzinfo=timezone.utc)
        )
    else:
        # For weekly/monthly, go back to oldest data point
        start_date = datetime.combine(oldest_data_point, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    # Query aggregated COGS data
    trunc_map = {"daily": "day", "weekly": "week", "monthly": "month"}
    date_col = func.date_trunc(trunc_map[granularity], Transaction.created_at).label("period")
    
    cogs_query = (
        select(
            date_col,
            func.sum(func.coalesce(Transaction.total_cost_minor, 0)).label("total_cogs")
        )
        .where(Transaction.org_id == user.org_id)
        .where(Transaction.action == 'ship')
        .where(Transaction.total_cost_minor.is_not(None))
        .where(Transaction.created_at >= start_date)
        .where(Transaction.created_at <= end_date)
        .group_by(date_col)
    )
    
    if sku_code:
        cogs_query = cogs_query.where(Transaction.sku_code == sku_code)
    
    result = await db.execute(cogs_query)
    cogs_map = {row.period.date(): row.total_cogs for row in result.all()}
    
    # Generate complete date series with zero-filling
    currency_service = CurrencyService()
    points = []
    seen_dates = set()
    
    current_date = start_date
    while current_date <= end_date:
        # Determine bucket date based on granularity
        if granularity == "daily":
            bucket_date = current_date.date()
            increment = timedelta(days=1)
        elif granularity == "weekly":
            days_since_monday = current_date.weekday()
            bucket_date = (current_date - timedelta(days=days_since_monday)).date()
            increment = timedelta(weeks=1)
        else:  # monthly
            bucket_date = current_date.replace(day=1).date()
            if current_date.month == 12:
                next_month = current_date.replace(year=current_date.year + 1, month=1, day=1)
            else:
                next_month = current_date.replace(month=current_date.month + 1, day=1)
            increment = next_month - current_date.replace(day=1)
        
        # Skip if already seen (prevents duplicates in monthly bucketing)
        if bucket_date in seen_dates:
            current_date += increment
            continue
        
        seen_dates.add(bucket_date)
        
        # Get COGS for this bucket
        cogs_minor = cogs_map.get(bucket_date, 0)
        cogs_major = currency_service.to_major_units(cogs_minor, currency)
        
        # For monthly: exclude current month if it has zero COGS
        if granularity == "monthly":
            current_month = end_date.replace(day=1).date()
            if bucket_date == current_month and cogs_major == 0:
                current_date += increment
                continue
        
        points.append({"date": bucket_date, "cogs": cogs_major})
        current_date += increment
    
    return COGSTrendResponse(
        oldest_data_point=oldest_data_point,
        points=points,
    )
    