from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.db import get_session
from app.services.transaction.exceptions import NotFound
from app.models import InventoryState, Location, InventoryTransaction
from app.services.transaction.exceptions import TransactionBadRequest
from app.schemas.report import (
    DashboardMetricsResponse, 
    DashboardSummaryResponse, 
    TopSKUsItem, 
    TopSKUsResponse,
    OnHandValue,
    TrendResponse
)
from sqlalchemy.orm import selectinload
from app.services.metrics import calculate_weekly_delta
from app.services.trends import get_inventory_trend_points
from app.services.stock_counts import get_stock_status_counts
from app.services.movers import (
    get_top_skus_by_criteria, 
    determine_stock_status,
    get_fast_movers_with_stock_condition,
    get_inactive_skus_with_stock
)

router = APIRouter(prefix="/reports")

@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    location: Optional[str] = Query(None, description="Location name (None = aggregate across all locations)"),
    db: AsyncSession = Depends(get_session)
):
    """Get aggregated inventory metrics across all SKUs for dashboard display."""

    # Validate location exists if provided
    location_id = None
    if location is not None:
        loc_stmt = select(Location.id).where(Location.name == location)
        loc_result = await db.execute(loc_stmt)
        location_id = loc_result.scalar_one_or_none()
        if location_id is None:
            raise TransactionBadRequest(detail=f"Location '{location}' not found")

    # Auto-assign location if only one exists globally
    if location is None:
        loc_count_stmt = select(func.count(Location.id))
        loc_count_result = await db.execute(loc_count_stmt)
        total_locations = loc_count_result.scalar() or 0
        
        if total_locations == 1:
            single_loc_stmt = select(Location.name).limit(1)
            single_loc_result = await db.execute(single_loc_stmt)
            location = single_loc_result.scalar()

    # Query aggregated inventory totals
    if location_id is not None:
        # For specific location, sum directly
        totals_stmt = select(
            func.sum(InventoryState.available).label("total_available"),
            func.sum(InventoryState.on_hand).label("total_on_hand"),
        ).where(InventoryState.location_id == location_id)
        
        totals_result = await db.execute(totals_stmt)
        totals_row = totals_result.one()
        total_available = totals_row.total_available or 0
        total_on_hand = totals_row.total_on_hand or 0
    else:
        # For all locations, aggregate by SKU first to avoid double-counting
        totals_stmt = select(
            func.sum(InventoryState.available).label("total_available"),
            func.sum(InventoryState.on_hand).label("total_on_hand"),
        )
        
        totals_result = await db.execute(totals_stmt)
        totals_row = totals_result.one()
        total_available = totals_row.total_available or 0
        total_on_hand = totals_row.total_on_hand or 0

    # Get stock status counts using centralized service
    stockouts, low_stock = await get_stock_status_counts(db, location_id)

    # Calculate weekly delta (same logic as SKU endpoint, but aggregated)
    delta_pct = await calculate_weekly_delta(db, total_on_hand, sku_id=None, location_id=location_id)

    return DashboardMetricsResponse(
        total_available=total_available,
        total_on_hand=OnHandValue(value=total_on_hand, delta_pct=delta_pct),
        stockouts=stockouts,
        low_stock=low_stock,
        location=location,
    )


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_session)
):
    """Get comprehensive dashboard summary including SKU movement analysis."""
    
    # Get stock status counts using centralized service
    out_of_stock, low_stock = await get_stock_status_counts(db)

    # Check if inventory is empty (no transactions with qty != 0)
    empty_inventory_stmt = select(func.count(InventoryTransaction.id)).where(
        InventoryTransaction.qty != 0
    )
    empty_inventory_result = await db.execute(empty_inventory_stmt)
    has_movements = (empty_inventory_result.scalar() or 0) > 0
    empty_inventory = not has_movements

    # Get all locations
    locations_stmt = select(Location.name).order_by(Location.name)
    locations_result = await db.execute(locations_stmt)
    locations = [loc for (loc,) in locations_result.all()]

    # Fast movers with low stock (top 5 SKUs with highest outbound movement and total available < 10)
    fast_mover_low_stock_sku = await get_fast_movers_with_stock_condition(
        db, available_min=1, available_max=9, limit=5
    )

    # Fast movers out of stock (top 5 SKUs with highest outbound movement and total available = 0)
    fast_mover_out_of_stock_sku = await get_fast_movers_with_stock_condition(
        db, available_min=0, available_max=0, limit=5
    )

    # Inactive SKUs with stock (SKUs with no activity in last 10 days but have total on_hand > 0)
    inactive_sku_in_stock = await get_inactive_skus_with_stock(db)

    return DashboardSummaryResponse(
        first_name="User",  # Hard-coded for now, replace with auth user's first name
        low_stock=low_stock,
        out_of_stock=out_of_stock,
        fast_mover_low_stock_sku=fast_mover_low_stock_sku,
        fast_mover_out_of_stock_sku=fast_mover_out_of_stock_sku,
        inactive_sku_in_stock=inactive_sku_in_stock,
        empty_inventory=empty_inventory,
        locations=locations,
    )


@router.get("/top-movers", response_model=TopSKUsResponse)
async def get_top_movers(
    location: Optional[str] = Query(None, description="Filter by location name"),
    period: str = Query("7d", description="Time period to analyze (e.g., '7d', '30d', '365 days')"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get top SKUs by outbound movement volume.
    """
    result = await get_top_skus_by_criteria(
        db=db,
        location=location,
        period=period,
        inactives=False,
        limit=5
    )
    
    return TopSKUsResponse(
        location=result['location'],
        skus=[
            TopSKUsItem(
                sku=data['sku_id'],
                product_name=data['product_name'],
                available=data['available'],
                status=determine_stock_status(data['available'])
            )
            for data in result['skus']
        ]
    )


@router.get("/top-inactives", response_model=TopSKUsResponse)
async def get_top_inactives(
    location: Optional[str] = Query(None, description="Filter by location name"),
    period: str = Query("7d", description="Time period to analyze (e.g., '7d', '30d', '365 days')"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get top 5 SKUs with no outbound movement (inactive SKUs).
    """
    result = await get_top_skus_by_criteria(
        db=db,
        location=location,
        period=period,
        inactives=True,
        limit=5
    )
    
    return TopSKUsResponse(
        location=result['location'],
        skus=[
            TopSKUsItem(
                sku=data['sku_id'],
                product_name=data['product_name'],
                available=data['available'],
                status=determine_stock_status(data['available'])
            )
            for data in result['skus']
        ]
    )


@router.get("/trend/inventory", response_model=TrendResponse)
async def get_overall_inventory_trend(
    period: str = Query("30d", pattern=r"^\d+d$"),
    location: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    # Query inventory states to check existence and location count
    inventory_states_query = select(InventoryState).options(selectinload(InventoryState.location))
    if location is not None:
        inventory_states_query = inventory_states_query.join(Location).where(Location.name == location)
    
    inventory_states_result = await session.execute(inventory_states_query)
    inventory_states = inventory_states_result.scalars().all()
    
    if not inventory_states:
        raise NotFound
    
    # Get trend data
    days = int(period.rstrip('d'))
    points, oldest_data_point = await get_inventory_trend_points(
        session, days, sku_id=None, location_name=location
    )
    
    # Auto-assign location name if only one location exists
    final_location = location
    if location is None and len(set(state.location_id for state in inventory_states)) == 1:
        final_location = inventory_states[0].location.name
    
    return TrendResponse(
        location=final_location,
        points=points,
        oldest_data_point=oldest_data_point
    )


@router.get("/trend/inventory/{sku_id}", response_model=TrendResponse)
async def get_inventory_trend(
    sku_id: str,
    period: str = Query("30d", pattern=r"^\d+d$"),
    location: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    # Check if SKU exists
    sku_exists_query = select(InventoryState.sku_id).where(InventoryState.sku_id == sku_id)
    if location is not None:
        sku_exists_query = sku_exists_query.join(InventoryState.location).where(Location.name == location)
    
    sku_exists_result = await session.execute(sku_exists_query)
    if sku_exists_result.scalar() is None:
        raise NotFound
    
    # Get inventory states for location name resolution
    inventory_states_query = (
        select(InventoryState)
        .options(selectinload(InventoryState.location))
        .where(InventoryState.sku_id == sku_id)
    )
    if location is not None:
        inventory_states_query = inventory_states_query.join(Location).where(Location.name == location)
    
    inventory_states_result = await session.execute(inventory_states_query)
    inventory_states = inventory_states_result.scalars().all()
    
    # Get trend data
    days = int(period.rstrip('d'))
    points, oldest_data_point = await get_inventory_trend_points(
        session, days, sku_id=sku_id, location_name=location
    )
    
    # Auto-assign location name if only one location exists
    final_location = location
    if location is None and len(inventory_states) == 1:
        final_location = inventory_states[0].location.name
    
    return TrendResponse(
        sku=sku_id,
        location=final_location,
        points=points,
        oldest_data_point=oldest_data_point
    )
