from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.models import Location, State, Transaction, User, SKU
from app.schemas.report import (
    DashboardMetricsResponse,
    DashboardSummaryResponse, 
    TopSKUsItem, 
    TopSKUsResponse,
    OnHandValue,
    TrendResponse
)
from sqlalchemy.orm import selectinload
from app.services.exceptions import TransactionBadRequest, NotFound
from app.services.metrics import calculate_weekly_delta_all_skus
from app.services.stock_counts import get_stock_status_counts
from app.services.trends import get_inventory_trend_points
from app.services.movers import (
    get_top_skus_by_criteria, 
    determine_stock_status,
    get_fast_movers_with_stock_condition,
    get_inactive_skus_with_stock
)
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session


router = APIRouter()

@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    location: Optional[str] = Query(None, description="Location name (None = aggregate across all locations)"),
    db: AsyncSession = Depends(get_tenant_session),
    user: User = Depends(get_current_user)
):
    """Get aggregated inventory metrics across all SKUs for dashboard display."""

    # Validate location exists if provided
    location_id = None
    if location is not None:
        loc_stmt = select(Location.id).where(Location.name == location, Location.org_id == user.org_id)
        loc_result = await db.execute(loc_stmt)
        location_id = loc_result.scalar_one_or_none()
        if location_id is None:
            raise TransactionBadRequest(detail=f"Location '{location}' not found")

    # Auto-assign location if only one exists
    if location is None:
        loc_count_stmt = select(func.count(Location.id)).where(Location.org_id == user.org_id)
        loc_count_result = await db.execute(loc_count_stmt)
        total_locations = loc_count_result.scalar() or 0
        
        if total_locations == 1:
            single_loc_stmt = select(Location.id, Location.name).where(Location.org_id == user.org_id).limit(1)
            single_loc_result = await db.execute(single_loc_stmt)
            single_loc = single_loc_result.one_or_none()
            if single_loc:
                location_id, location = single_loc

    # Query aggregated inventory totals
    if location_id is not None:
        # For specific location, sum directly
        totals_stmt = select(
            func.sum(State.available).label("total_available"),
            func.sum(State.on_hand).label("total_on_hand"),
        ).where(State.location_id == location_id)
        
        totals_result = await db.execute(totals_stmt)
        totals_row = totals_result.one()
        total_available = totals_row.total_available or 0
        total_on_hand = totals_row.total_on_hand or 0
    else:
        # For all locations, aggregate
        totals_stmt = select(
            func.sum(State.available).label("total_available"),
            func.sum(State.on_hand).label("total_on_hand"),
        ).where(State.org_id == user.org_id)
        
        totals_result = await db.execute(totals_stmt)
        totals_row = totals_result.one()
        total_available = totals_row.total_available or 0
        total_on_hand = totals_row.total_on_hand or 0

    # Get stock status counts using centralized service (now handles SKU-specific thresholds)
    stockouts, low_stock = await get_stock_status_counts(db, location_id)

    # Calculate weekly delta (same logic as SKU endpoint, but aggregated)
    delta_pct = await calculate_weekly_delta_all_skus(db, total_on_hand, location_id=location_id)

    return DashboardMetricsResponse(
        total_available=total_available,
        total_on_hand=OnHandValue(value=total_on_hand, delta_pct=delta_pct),
        stockouts=stockouts,
        low_stock=low_stock,
        location=location,
    )


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_tenant_session),
    user: User = Depends(get_current_user)
):
    """Get comprehensive dashboard summary including SKU movement analysis."""
    
    # Get stock status counts using centralized service (now handles SKU-specific thresholds)
    out_of_stock, low_stock = await get_stock_status_counts(db)

    # Check if inventory is empty (no transactions with qty != 0)
    empty_inventory_stmt = select(func.count(Transaction.id)).where(
        Transaction.qty != 0, Transaction.org_id == user.org_id
    )
    empty_inventory_result = await db.execute(empty_inventory_stmt)
    has_movements = (empty_inventory_result.scalar() or 0) > 0
    empty_inventory = not has_movements

    # Get all locations
    locations_stmt = select(Location.name).order_by(Location.name)
    locations_result = await db.execute(locations_stmt)
    locations = [loc for (loc,) in locations_result.all()]

    # Fast movers with low stock (uses SKU-specific thresholds internally)
    fast_mover_low_stock_sku = await get_fast_movers_with_stock_condition(
        user.org_id, db, available_min=1, available_max=None, limit=5, check_low_stock=True
    )

    # Fast movers out of stock (top 5 SKUs with highest outbound movement and total available = 0)
    fast_mover_out_of_stock_sku = await get_fast_movers_with_stock_condition(
        user.org_id, db, available_min=0, available_max=0, limit=5
    )

    # Inactive SKUs with stock (SKUs with no activity in last 10 days but have total on_hand > 0)
    inactive_sku_in_stock = await get_inactive_skus_with_stock(user.org_id, db)

    return DashboardSummaryResponse(
        first_name=user.first_name,
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
    db: AsyncSession = Depends(get_tenant_session),
    user: User = Depends(get_current_user)
):
    """
    Get top SKUs by outbound movement volume.

    The stock status for each SKU is determined using each SKU's individual `low_stock_threshold`.
    """
    result = await get_top_skus_by_criteria(
        org_id=user.org_id,
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
                sku=data['sku_code'],
                sku_name=data['sku_name'],
                available=data['available'],
                status=determine_stock_status(data['available'], data['low_stock_threshold'])
            )
            for data in result['skus']
        ]
    )


@router.get("/top-inactives", response_model=TopSKUsResponse)
async def get_top_inactives(
    location: Optional[str] = Query(None, description="Filter by location name"),
    period: str = Query("7d", description="Time period to analyze (e.g., '7d', '30d', '365 days')"),
    db: AsyncSession = Depends(get_tenant_session),
    user: User = Depends(get_current_user)
):
    """
    Get top 5 SKUs with no outbound movement (inactive SKUs).

    The stock status for each SKU is determined using each SKU's individual `low_stock_threshold`.
    """
    result = await get_top_skus_by_criteria(
        org_id=user.org_id,
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
                sku=data['sku_code'],
                sku_name=data['sku_name'],
                available=data['available'],
                status=determine_stock_status(data['available'], data['low_stock_threshold'])
            )
            for data in result['skus']
        ]
    )


@router.get("/trend/inventory", response_model=TrendResponse)
async def get_overall_inventory_trend(
    period: str = Query("30d", pattern=r"^\d+d$"),
    location: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_tenant_session),
    user: User = Depends(get_current_user),
):
    """Get overall inventory trend across all SKUs."""
    # Query states to check existence and location count
    states_query = select(State).options(selectinload(State.location)).where(State.org_id == user.org_id)
    
    if location is not None:
        states_query = states_query.join(Location).where(Location.name == location)
    
    states_result = await session.execute(states_query)
    states = states_result.scalars().all()
    
    # Get trend data
    days = int(period.rstrip('d'))
    points, oldest_data_point = await get_inventory_trend_points(
        session, user.org_id, days, sku_code=None, location_name=location
    )
    
    # Auto-assign location name if only one location exists
    final_location = location
    if location is None and len(set(state.location_id for state in states)) == 1:
        final_location = states[0].location.name
    
    return TrendResponse(
        location=final_location,
        points=points,
        oldest_data_point=oldest_data_point
    )


@router.get("/trend/inventory/{sku_code}", response_model=TrendResponse)
async def get_inventory_trend(
    sku_code: str,
    period: str = Query("30d", pattern=r"^\d+d$"),
    location: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_tenant_session),
    user: User = Depends(get_current_user),
):
    """Get inventory trend for a specific SKU."""
    # Check if SKU exists
    sku_exists_query = select(State.sku_code).where(State.sku_code == sku_code)
    
    if location is not None:
        sku_exists_query = sku_exists_query.join(Location).where(Location.name == location)
    
    sku_exists_result = await session.execute(sku_exists_query)
    if sku_exists_result.scalar() is None:
        raise NotFound
    
    # Get states for location name resolution
    states_query = (
        select(State)
        .options(selectinload(State.location))
        .where(State.sku_code == sku_code)
    )
    
    if location is not None:
        states_query = states_query.join(Location).where(Location.name == location)
    
    states_result = await session.execute(states_query)
    states = states_result.scalars().all()
    
    # Get trend data
    days = int(period.rstrip('d'))
    points, oldest_data_point = await get_inventory_trend_points(
        session, user.org_id, days, sku_code=sku_code, location_name=location
    )
    
    # Auto-assign location name if only one location exists
    final_location = location
    if location is None and len(set(state.location_id for state in states)) == 1:
        final_location = states[0].location.name
    
    return TrendResponse(
        sku=sku_code,
        location=final_location,
        points=points,
        oldest_data_point=oldest_data_point
    )
