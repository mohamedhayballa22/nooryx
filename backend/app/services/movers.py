"""
Top SKUs Analytics Service Layer
===========================

**Top Movers (get_top_skus_by_criteria with include_inactive=False)**
- Returns SKUs with the highest outbound movement WITHIN the specified period
- Period defines the time window for measuring volume (e.g., "7d" = last 7 days)
- Ranking is by total quantity moved within that window
- Use case: "What's selling best this week/month/year?"

**Top Inactives (get_top_skus_by_criteria with include_inactive=True)**
- Returns SKUs with NO outbound movement for AT LEAST the specified period
- Period acts as a minimum inactivity threshold filter (e.g., "7d" = inactive for 7+ days)
- Ranking is by absolute inactivity time (longest inactive first), not the period window
- Use case: "Show me items that haven't sold in at least 7/30/365 days"
- UI Note: Labels should reflect threshold concept (e.g., "Inactive for 7+ days" not "Last 7 days")
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, distinct
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.models import Location, Transaction, State, SKU


async def get_top_skus_by_criteria(
    org_id: str,
    db: AsyncSession,
    location: Optional[str] = None,
    period: str = "7d",
    inactives: bool = False,
    limit: int = 5
) -> Dict[str, Any]:
    """
    Get top SKUs based on outbound activity or inactivity.
    
    Args:
        db: Database session
        location: Optional location name to filter by
        period: Time period string (e.g., '7d', '30d')
        inactives: If True, returns inactive SKUs; if False, returns top movers
        limit: Maximum number of SKUs to return
    
    Returns:
        Dict containing 'location' (str or None) and 'skus' (list of dicts with keys: 
        sku_code, sku_name, available, low_stock_threshold)
    """
    # Parse period to cutoff date
    cutoff_date = _parse_period_to_cutoff(period)
    
    # Get location info
    location_id, single_location_name = await _resolve_location(org_id, db, location)
    
    # Get SKU data based on criteria
    if inactives:
        sku_data_list = await _get_inactive_skus(org_id, db, location_id, cutoff_date, limit)
    else:
        sku_data_list = await _get_top_movers(org_id, db, location_id, cutoff_date, limit)
    
    # Determine response location
    response_location = location if location else single_location_name
    
    # Return structured response with location at root
    return {
        'location': response_location,
        'skus': sku_data_list
    }


def _parse_period_to_cutoff(period: str) -> datetime:
    """Parse period string and return cutoff datetime."""
    period_str = period.strip().lower()
    match = re.match(r'(\d+)\s*(d|day|days)', period_str)
    if match:
        days = int(match.group(1))
    else:
        days = 7  # Default to 7 days
    
    return datetime.now(timezone.utc) - timedelta(days=days)


async def _resolve_location(
    org_id: str,
    db: AsyncSession,
    location: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    """
    Resolve location name to ID and determine if auto-assignment should occur.
    
    Returns:
        Tuple of (location_id, single_location_name)
    """
    location_id = None
    single_location_name = None
    
    # Get location_id if location is provided
    if location:
        location_stmt = select(Location.id).where(and_(Location.name == location, Location.org_id == org_id))
        location_result = await db.execute(location_stmt)
        location_row = location_result.first()
        if location_row:
            location_id = str(location_row[0])  # Convert UUID to string
    
    # Check if only one location exists for auto-assignment
    total_locations_stmt = select(func.count(Location.id)).where(Location.org_id == org_id)
    total_locations_result = await db.execute(total_locations_stmt)
    total_locations = total_locations_result.scalar() or 0
    
    if total_locations == 1 and not location:
        single_location_stmt = select(Location.name).where(Location.org_id == org_id)
        single_location_result = await db.execute(single_location_stmt)
        single_location_row = single_location_result.first()
        if single_location_row:
            single_location_name = single_location_row[0]
    
    return location_id, single_location_name


async def _get_top_movers(
    org_id: str,
    db: AsyncSession,
    location_id: Optional[str],
    cutoff_date: datetime,
    limit: int
) -> List[Dict[str, Any]]:
    """Get top SKUs by outbound movement volume."""
    # Build movement query
    movement_conditions = [
        Transaction.is_outbound,
        Transaction.created_at >= cutoff_date,
        Transaction.org_id == org_id
    ]
    if location_id:
        movement_conditions.append(Transaction.location_id == location_id)
    
    movement_stmt = (
        select(
            Transaction.sku_code,
            func.sum(func.abs(Transaction.qty)).label("total_outbound")
        )
        .where(and_(*movement_conditions))
        .group_by(Transaction.sku_code)
        .order_by(func.sum(func.abs(Transaction.qty)).desc())
        .limit(limit)
    )
    
    movement_result = await db.execute(movement_stmt)
    top_sku_codes = [row.sku_code for row in movement_result.all()]
    
    if not top_sku_codes:
        return []
    
    # Get inventory state for these SKUs
    state_map = await _get_inventory_state(org_id, db, location_id, top_sku_codes)
    
    # Build response maintaining order from movement query
    return [
        {
            'sku_code': sku_code,
            'sku_name': state_map[sku_code]['sku_name'],
            'available': state_map[sku_code]['available'],
            'low_stock_threshold': state_map[sku_code]['low_stock_threshold']
        }
        for sku_code in top_sku_codes if sku_code in state_map
    ]


async def _get_inactive_skus(
    org_id: str,
    db: AsyncSession,
    location_id: Optional[str],
    cutoff_date: datetime,
    limit: int
) -> List[Dict[str, Any]]:
    """
    Get top SKUs with no recent outbound movement.
    """
    # 1. Subquery for last outbound activity per SKU
    last_activity_sub = (
        select(
            Transaction.sku_code,
            func.max(Transaction.created_at).label("last_outbound")
        )
        .where(Transaction.is_outbound == True,
               Transaction.org_id == org_id,)
    )
    
    if location_id:
        last_activity_sub = last_activity_sub.where(Transaction.location_id == location_id)
    
    last_activity_sub = last_activity_sub.group_by(Transaction.sku_code).subquery()

    # 2. Main Query: Join SKU + State + Last Activity Subquery
    stmt = (
        select(
            SKU.code.label("sku_code"),
            SKU.name.label("sku_name"),
            SKU.low_stock_threshold,
            # Aggregate available if no location_id, otherwise take direct value
            func.sum(State.available).label("available") if not location_id else State.available,
            last_activity_sub.c.last_outbound
        )
        .join(State, SKU.code == State.sku_code)
        .join(last_activity_sub, SKU.code == last_activity_sub.c.sku_code, isouter=True)
    )

    # 3. Filters
    conditions = []
    if location_id:
        conditions.append(State.location_id == location_id)
    
    # Inactive Filter: Never sold (None) OR sold before cutoff
    conditions.append(
        (last_activity_sub.c.last_outbound == None) | 
        (last_activity_sub.c.last_outbound < cutoff_date)
    )
    
    stmt = stmt.where(and_(*conditions))

    # 4. Grouping (Required for sum calculation)
    if not location_id:
        stmt = stmt.group_by(SKU.code, SKU.name, SKU.low_stock_threshold, last_activity_sub.c.last_outbound)

    # 5. Sorting: Oldest movement first, Never-sold (NULLs) last
    stmt = stmt.order_by(
        last_activity_sub.c.last_outbound.is_(None),  # Falses (has date) come before Trues (None)
        last_activity_sub.c.last_outbound.asc()
    ).limit(limit)

    result = await db.execute(stmt)
    
    return [
        {
            'sku_code': row.sku_code,
            'sku_name': row.sku_name,
            'available': row.available,
            'low_stock_threshold': row.low_stock_threshold,
            'last_activity': row.last_outbound
        }
        for row in result.all()
    ]


async def _get_inventory_state(
    org_id: str,
    db: AsyncSession,
    location_id: Optional[str],
    sku_codes: Optional[List[str]] = None
) -> Dict[str, Dict[str, Any]]:
    """Get inventory state including SKU-specific low stock thresholds."""
    if location_id:
        state_conditions = [State.location_id == location_id, State.org_id == org_id]
        if sku_codes:
            state_conditions.append(State.sku_code.in_(sku_codes))
        
        state_stmt = (
            select(
                State.sku_code,
                SKU.name.label("sku_name"),
                SKU.low_stock_threshold,
                State.available
            )
            .join(SKU, State.sku_code == SKU.code)
            .where(and_(*state_conditions))
        )
    else:
        state_stmt = (
            select(
                State.sku_code,
                SKU.name.label("sku_name"),
                SKU.low_stock_threshold,
                func.sum(State.available).label("available")
            )
            .where(State.org_id == org_id)
            .join(SKU, State.sku_code == SKU.code)
            .group_by(State.sku_code, SKU.name, SKU.low_stock_threshold)
        )
        if sku_codes:
            state_stmt = state_stmt.where(State.sku_code.in_(sku_codes))
    
    state_result = await db.execute(state_stmt)
    return {
        row.sku_code: {
            'sku_name': row.sku_name,
            'available': row.available,
            'low_stock_threshold': row.low_stock_threshold
        }
        for row in state_result.all()
    }


def determine_stock_status(available: int, low_stock_threshold: int) -> str:
    """Determine stock status based on available quantity and SKU-specific threshold."""
    if available == 0:
        return "Out of Stock"
    elif available < low_stock_threshold:
        return "Low Stock"
    else:
        return "In Stock"


async def get_fast_movers_with_stock_condition(
    org_id: str,
    db: AsyncSession,
    available_min: int,
    available_max: Optional[int] = None,
    limit: int = 5,
    check_low_stock: bool = False
) -> Optional[List[str]]:
    """
    Aggregates availability across all locations per SKU.

    Args:
        db: Database session
        available_min: Minimum total available quantity across all locations (inclusive)
        available_max: Maximum total available quantity across all locations (inclusive).
                      If None and check_low_stock is True, uses SKU-specific thresholds.
        limit: Number of SKUs to return
        check_low_stock: If True, filters for SKUs below their individual low_stock_threshold

    Returns:
        List of SKU codes or None if no results
    """
    
    # 1. Define the Stock Filter Subquery
    # We aggregate State to the SKU level and apply filters via HAVING
    stock_filter_stmt = (
        select(
            State.sku_code,
            func.sum(State.available).label("total_available"),
            SKU.low_stock_threshold
        )
        .join(SKU, and_(
            State.sku_code == SKU.code, 
            State.org_id == SKU.org_id
        ))
        .where(State.org_id == org_id)
        .group_by(State.sku_code, SKU.low_stock_threshold)
    )

    if check_low_stock:
        # Condition: min <= total < SKU threshold
        stock_filter_stmt = stock_filter_stmt.having(
            and_(
                func.sum(State.available) >= available_min,
                func.sum(State.available) < SKU.low_stock_threshold
            )
        )
    else:
        # Condition: min <= total <= max
        having_conds = [func.sum(State.available) >= available_min]
        if available_max is not None:
            having_conds.append(func.sum(State.available) <= available_max)
        stock_filter_stmt = stock_filter_stmt.having(and_(*having_conds))

    stock_subquery = stock_filter_stmt.subquery()

    # 2. Main Query: Join Transactions with the filtered SKU list
    # This ensures we only calculate movement for SKUs that meet stock criteria
    stmt = (
        select(
            Transaction.sku_code,
            func.sum(func.abs(Transaction.qty)).label("total_outbound")
        )
        .join(stock_subquery, Transaction.sku_code == stock_subquery.c.sku_code)
        .where(
            and_(
                Transaction.org_id == org_id,
                Transaction.is_outbound == True
            )
        )
        .group_by(Transaction.sku_code)
        .order_by(func.sum(func.abs(Transaction.qty)).desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    skus = [row.sku_code for row in result.all()]

    return skus if skus else None


async def get_inactive_skus_with_stock(
    org_id: str,
    db: AsyncSession,
    days: int = 10,
    limit: int = 5
) -> Optional[List[str]]:
    """
    Get top SKUs that have stock but no transaction activity in the last N days.
    Aggregates on_hand across all locations per SKU.

    Args:
        db: Database session
        days: Number of days to look back for activity
        limit: Number of SKUs to return

    Returns:
        List of SKU codes or None if no results
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Subquery: Get SKUs with any activity in the last N days
    active_skus_subquery = (
        select(distinct(Transaction.sku_code))
        .where(Transaction.created_at >= cutoff_date,
               Transaction.org_id == org_id,
               )
    ).scalar_subquery()

    # Main query: Get SKUs with stock but not in active list (aggregated across locations)
    stmt = (
        select(State.sku_code, func.sum(State.on_hand).label("total_on_hand"))
        .where(~State.sku_code.in_(active_skus_subquery),
               State.org_id == org_id,
               )
        .group_by(State.sku_code)
        .having(func.sum(State.on_hand) > 0)
        .order_by(func.sum(State.on_hand).desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    skus = [row.sku_code for row in result.all()]

    return skus if skus else None
