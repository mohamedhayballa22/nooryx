
from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from enum import Enum
from datetime import datetime, timedelta

from app.schemas import (
    InventoryItemResponse,
    SkuInventoryResponse,
    LocationInventory,
    InventorySummary,
    OnHandValue,
    InventoryTrendResponse,
    TrendPoint,
)
from app.models import InventoryState, Location, InventoryTransaction
from app.core.db import get_session
from app.services.transaction.exceptions import TransactionBadRequest


router = APIRouter()


class StockStatus(str, Enum):
    OUT_OF_STOCK = "Out of Stock"
    LOW_STOCK = "Low Stock"
    IN_STOCK = "In Stock"


@router.get("/inventory", response_model=Page[InventoryItemResponse])
async def get_inventory(
    db: AsyncSession = Depends(get_session),
    # Filtering parameters
    search: Optional[str] = Query(
        None, description="Search across SKU and location (partial match)"
    ),
    stock_status: Optional[List[StockStatus]] = Query(
        None, description="Filter by stock status (can specify multiple)"
    ),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "sku",
        description="Sort by field",
        regex="^(sku|product_name|location|available|status)$",
    ),
    order: Optional[str] = Query("asc", description="Sort order", regex="^(asc|desc)$"),
):
    """
    Returns current inventory status across all SKUs and locations.
    Efficiently joins inventory state with latest transaction per SKU/location.

    Supports searching across SKU and location, filtering by stock status, and sorting by multiple fields.
    """

    # Subquery to get the most recent transaction for each SKU/location
    latest_txn_subq = (
        select(
            InventoryTransaction.sku_id,
            InventoryTransaction.location_id,
            func.max(InventoryTransaction.id).label("max_txn_id"),
        )
        .group_by(InventoryTransaction.sku_id, InventoryTransaction.location_id)
        .subquery()
    )

    # Define the status case expression for reuse
    status_expr = case(
        (InventoryState.available == 0, "Out of Stock"),
        (InventoryState.available < 10, "Low Stock"),
        else_="In Stock",
    ).label("status")

    # Main query joining inventory state with latest transaction
    query = (
        select(
            InventoryState.sku_id.label("sku"),
            InventoryState.product_name.label("product_name"),
            Location.name.label("location"),
            InventoryState.available.label("available"),
            InventoryTransaction,
            status_expr,
        )
        .join(Location, InventoryState.location_id == Location.id)
        .outerjoin(
            latest_txn_subq,
            (InventoryState.sku_id == latest_txn_subq.c.sku_id)
            & (InventoryState.location_id == latest_txn_subq.c.location_id),
        )
        .outerjoin(
            InventoryTransaction, InventoryTransaction.id == latest_txn_subq.c.max_txn_id
        )
        .options(selectinload(InventoryTransaction.location))
    )

    # Apply search filter across SKU and location
    if search:
        query = query.where(
            or_(
                InventoryState.sku_id.ilike(f"%{search}%"),
                Location.name.ilike(f"%{search}%"),
            )
        )

    # Apply stock_status filter at the database level if possible
    if stock_status:
        status_conditions = []
        for status in stock_status:
            if status == StockStatus.OUT_OF_STOCK:
                status_conditions.append(InventoryState.available == 0)
            elif status == StockStatus.LOW_STOCK:
                status_conditions.append(
                    and_(InventoryState.available > 0, InventoryState.available < 10)
                )
            elif status == StockStatus.IN_STOCK:
                status_conditions.append(InventoryState.available >= 10)

        if status_conditions:
            query = query.where(or_(*status_conditions))

    # Apply sorting
    sort_mapping = {
        "sku": InventoryState.sku_id,
        "product_name": InventoryState.product_name,
        "location": Location.name,
        "available": InventoryState.available,
        "status": status_expr,
    }

    sort_column = sort_mapping.get(sort_by, InventoryState.sku_id)

    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    if sort_by != "location":
        query = query.order_by(Location.name)

    return await apaginate(
        db,
        query,
        transformer=lambda rows: [
            InventoryItemResponse(
                sku=row.sku,
                product_name=row.product_name,
                location=row.location,
                available=row.available,
                last_transaction=row.InventoryTransaction.narrative
                if row.InventoryTransaction
                else "No transactions yet",
                status=row.status,
            )
            for row in rows
        ],
    )


@router.get("/inventory/{sku_id}", response_model=SkuInventoryResponse)
async def get_sku_inventory(sku_id: str, db: AsyncSession = Depends(get_session)):
    """Get comprehensive inventory view for a SKU across all locations."""

    # Fetch current inventory states with eager loading
    stmt = (
        select(InventoryState)
        .options(selectinload(InventoryState.location))
        .where(InventoryState.sku_id == sku_id)
        .order_by(InventoryState.location_id)
    )
    result = await db.execute(stmt)
    states = result.scalars().all()

    if not states:
        raise TransactionBadRequest(detail=f"SKU {sku_id} not found")

    # Build locations list and calculate totals
    locations = []
    total_available = 0
    total_reserved = 0
    total_on_hand = 0
    product_name = states[0].product_name

    for state in states:
        # Calculate delta for this specific location
        delta_pct = await _calculate_weekly_delta(
            db, sku_id, state.location_id, state.on_hand
        )

        # Determine per-location status
        if state.available == 0:
            location_status = "Out of Stock"
        elif state.available < 10:
            location_status = "Low Stock"
        else:
            location_status = "In Stock"

        locations.append(
            LocationInventory(
                id=state.location_id,
                name=state.location.name,
                status=location_status,
                available=state.available,
                reserved=state.reserved,
                on_hand=OnHandValue(value=state.on_hand, delta_pct=delta_pct),
            )
        )
        total_available += state.available
        total_reserved += state.reserved
        total_on_hand += state.on_hand

    # Determine overall status
    if total_available == 0:
        status = "Out of Stock"
    elif total_available < 10:
        status = "Low Stock"
    else:
        status = "In Stock"

    # Calculate aggregate week-over-week delta
    total_delta_pct = await _calculate_weekly_delta(db, sku_id, None, total_on_hand)

    return SkuInventoryResponse(
        sku=sku_id,
        product_name=product_name,
        status=status,
        locations=locations,
        summary=InventorySummary(
            available=total_available,
            reserved=total_reserved,
            on_hand=OnHandValue(value=total_on_hand, delta_pct=total_delta_pct),
            locations=len(locations),
        ),
    )


async def _calculate_weekly_delta(
    db: AsyncSession, sku_id: str, location_id: int | None, current_on_hand: int
) -> float:
    """Calculate percentage change in on-hand inventory from last week."""

    # Special case: current stock is 0
    if current_on_hand == 0:
        one_week_ago = datetime.now() - timedelta(days=7)
        two_weeks_ago = datetime.now() - timedelta(days=14)

        filters = [
            InventoryTransaction.sku_id == sku_id,
            InventoryTransaction.created_at >= two_weeks_ago,
            InventoryTransaction.created_at <= one_week_ago,
        ]
        if location_id is not None:
            filters.append(InventoryTransaction.location_id == location_id)

        stmt = (
            select(InventoryTransaction)
            .where(and_(*filters))
            .order_by(InventoryTransaction.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        last_week_txn = result.scalar_one_or_none()

        if last_week_txn:
            last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)
            if last_week_on_hand > 0:
                return -100.0

        return 0.0

    # Find transaction from 5-11 days ago, closest to 7 days
    today = datetime.now()
    min_date = today - timedelta(days=11)
    max_date = today - timedelta(days=5)

    filters = [
        InventoryTransaction.sku_id == sku_id,
        InventoryTransaction.created_at >= min_date,
        InventoryTransaction.created_at <= max_date,
    ]
    if location_id is not None:
        filters.append(InventoryTransaction.location_id == location_id)

    if location_id is None:
        stmt = (
            select(
                InventoryTransaction.created_at,
                func.sum(
                    case(
                        (
                            InventoryTransaction.action.in_(["reserve", "unreserve"]),
                            InventoryTransaction.qty_before,
                        ),
                        else_=InventoryTransaction.qty_before
                        + InventoryTransaction.qty,
                    )
                ).label("total_on_hand"),
            )
            .where(and_(*filters))
            .group_by(InventoryTransaction.created_at)
            .order_by(
                func.abs(
                    func.extract(
                        "epoch",
                        InventoryTransaction.created_at
                        - (today - timedelta(days=7)),
                    )
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()
        if not row or row.total_on_hand == 0:
            return 0.0
        last_week_on_hand = row.total_on_hand
    else:
        stmt = (
            select(InventoryTransaction)
            .where(and_(*filters))
            .order_by(
                func.abs(
                    func.extract(
                        "epoch",
                        InventoryTransaction.created_at
                        - (today - timedelta(days=7)),
                    )
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        last_week_txn = result.scalar_one_or_none()
        if not last_week_txn:
            return 0.0
        last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)
        if last_week_on_hand == 0:
            return 0.0

    delta_pct = ((current_on_hand - last_week_on_hand) / last_week_on_hand) * 100
    return round(delta_pct, 1)


def _calculate_on_hand_from_txn(txn: InventoryTransaction) -> int:
    """Calculate on-hand quantity at the time of a transaction."""
    if txn.action in ["reserve", "unreserve"]:
        return txn.qty_before
    else:
        return txn.qty_before + txn.qty
    
@router.get("/inventory/trend/{sku_id}", response_model=InventoryTrendResponse)
async def get_inventory_trend(
    sku_id: str,
    period: str = Query("30d", pattern=r"^\d+d$"),
    location: Optional[str] = Query(None, description="Location name (None = aggregate across all locations)"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get historical on-hand inventory trend for a SKU.
    
    Args:
        sku_id: SKU identifier
        period: Time period in format "Xd" (e.g., "30d" for 30 days)
        location: Optional location name. If None, aggregates across all locations.
        
    Returns:
        Daily on-hand inventory levels with interpolation (no extrapolation)
    """
    # Parse period (e.g., "30d" -> 30)
    days = int(period.rstrip('d'))
    start_date = datetime.utcnow().date() - timedelta(days=days - 1)  # -1 so we get 'days' points including today
    today = datetime.utcnow().date()
    
    # Build base query - get ALL transactions, not just within period
    # We need earlier ones to initialize the starting on_hand
    query = (
        select(InventoryTransaction)
        .join(Location, InventoryTransaction.location_id == Location.id)
        .where(InventoryTransaction.sku_id == sku_id)
        .order_by(InventoryTransaction.created_at)
    )
    
    # Filter by location if specified
    if location is not None:
        query = query.where(Location.name == location)
    
    result = await session.execute(query)
    transactions = result.scalars().all()
    
    if not transactions:
        return InventoryTrendResponse(sku=sku_id, location=location, points=[])
    
    # Find the earliest transaction date
    earliest_txn_date = transactions[0].created_at.date()
    
    # Adjust start_date to not go before earliest transaction (no extrapolation)
    actual_start_date = max(start_date, earliest_txn_date)
    
    if location is not None:
        # Single location: simple case
        daily_on_hand = {}
        
        for txn in transactions:
            txn_date = txn.created_at.date()
            
            # Calculate on_hand after this transaction
            if txn.action in ["reserve", "unreserve"]:
                on_hand = txn.qty_before
            else:
                on_hand = txn.qty_before + txn.qty
            
            # Keep the last transaction's on_hand for each day
            daily_on_hand[txn_date] = on_hand
    else:
        # Multiple locations: need to aggregate
        # Track on_hand per location per day, then sum
        location_daily_on_hand = {}  # {location_id: {date: on_hand}}
        
        for txn in transactions:
            txn_date = txn.created_at.date()
            loc_id = txn.location_id
            
            if loc_id not in location_daily_on_hand:
                location_daily_on_hand[loc_id] = {}
            
            # Calculate on_hand after this transaction
            if txn.action in ["reserve", "unreserve"]:
                on_hand = txn.qty_before
            else:
                on_hand = txn.qty_before + txn.qty
            
            # Keep the last transaction's on_hand for each day per location
            location_daily_on_hand[loc_id][txn_date] = on_hand
        
        # Now aggregate across locations for each day
        all_dates = set()
        for loc_data in location_daily_on_hand.values():
            all_dates.update(loc_data.keys())
        
        if not all_dates:
            return InventoryTrendResponse(sku=sku_id, location=None, points=[])
        
        earliest_date = min(all_dates)
        
        # Build interpolated series per location
        location_series = {}  # {location_id: {date: on_hand}}
        
        for loc_id, loc_daily in location_daily_on_hand.items():
            location_series[loc_id] = {}
            last_known = None
            loc_earliest = min(loc_daily.keys())
            
            current_date = earliest_date
            
            while current_date <= today:
                if current_date < loc_earliest:
                    # Before this location's earliest transaction
                    current_date += timedelta(days=1)
                    continue
                
                if current_date in loc_daily:
                    last_known = loc_daily[current_date]
                    location_series[loc_id][current_date] = last_known
                elif last_known is not None:
                    location_series[loc_id][current_date] = last_known
                
                current_date += timedelta(days=1)
        
        # Now sum across locations for each date
        daily_on_hand = {}
        current_date = earliest_date
        
        while current_date <= today:
            total = 0
            has_data = False
            
            for loc_id, loc_series in location_series.items():
                if current_date in loc_series:
                    total += loc_series[current_date]
                    has_data = True
            
            if has_data:
                daily_on_hand[current_date] = total
            
            current_date += timedelta(days=1)
    
    # Build the response with interpolation for the requested period
    points = []
    
    if not daily_on_hand:
        return InventoryTrendResponse(sku=sku_id, location=location, points=[])
    
    # Initialize with the last known on_hand before or at actual_start_date
    last_known_on_hand = None
    for date in sorted(daily_on_hand.keys()):
        if date <= actual_start_date:
            last_known_on_hand = daily_on_hand[date]
        else:
            break
    
    # Iterate through each day in the requested period (respecting earliest transaction)
    current_date = actual_start_date
    
    while current_date <= today:
        if current_date in daily_on_hand:
            # We have actual data for this day
            last_known_on_hand = daily_on_hand[current_date]
            points.append(TrendPoint(date=current_date, on_hand=last_known_on_hand))
        elif last_known_on_hand is not None:
            # Interpolate: use last known value
            points.append(TrendPoint(date=current_date, on_hand=last_known_on_hand))
        
        current_date += timedelta(days=1)
    
    return InventoryTrendResponse(sku=sku_id, location=location, points=points)
