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

from app.models import Location, InventoryTransaction, InventoryState


async def get_top_skus_by_criteria(
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
        Dict containing 'location' (str or None) and 'skus' (list of dicts with keys: sku_id, product_name, available)
    """
    # Parse period to cutoff date
    cutoff_date = _parse_period_to_cutoff(period)
    
    # Get location info
    location_id, single_location_name = await _resolve_location(db, location)
    
    # Get SKU data based on criteria
    if inactives:
        sku_data_list = await _get_inactive_skus(db, location_id, cutoff_date, limit)
    else:
        sku_data_list = await _get_top_movers(db, location_id, cutoff_date, limit)
    
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
    db: AsyncSession,
    location: Optional[str]
) -> tuple[Optional[int], Optional[str]]:
    """
    Resolve location name to ID and determine if auto-assignment should occur.
    
    Returns:
        Tuple of (location_id, single_location_name)
    """
    location_id = None
    single_location_name = None
    
    # Get location_id if location is provided
    if location:
        location_stmt = select(Location.id).where(Location.name == location)
        location_result = await db.execute(location_stmt)
        location_row = location_result.first()
        if location_row:
            location_id = location_row[0]
    
    # Check if only one location exists for auto-assignment
    total_locations_stmt = select(func.count(Location.id))
    total_locations_result = await db.execute(total_locations_stmt)
    total_locations = total_locations_result.scalar() or 0
    
    if total_locations == 1 and not location:
        single_location_stmt = select(Location.name)
        single_location_result = await db.execute(single_location_stmt)
        single_location_row = single_location_result.first()
        if single_location_row:
            single_location_name = single_location_row[0]
    
    return location_id, single_location_name


async def _get_top_movers(
    db: AsyncSession,
    location_id: Optional[int],
    cutoff_date: datetime,
    limit: int
) -> List[Dict[str, Any]]:
    """Get top SKUs by outbound movement volume."""
    # Build movement query
    movement_conditions = [
        InventoryTransaction.is_outbound,
        InventoryTransaction.created_at >= cutoff_date
    ]
    if location_id:
        movement_conditions.append(InventoryTransaction.location_id == location_id)
    
    movement_stmt = (
        select(
            InventoryTransaction.sku_id,
            func.sum(func.abs(InventoryTransaction.qty)).label("total_outbound")
        )
        .where(and_(*movement_conditions))
        .group_by(InventoryTransaction.sku_id)
        .order_by(func.sum(func.abs(InventoryTransaction.qty)).desc())
        .limit(limit)
    )
    
    movement_result = await db.execute(movement_stmt)
    top_sku_ids = [row.sku_id for row in movement_result.all()]
    
    if not top_sku_ids:
        return []
    
    # Get inventory state for these SKUs
    state_map = await _get_inventory_state(db, location_id, top_sku_ids)
    
    # Build response maintaining order from movement query
    return [
        {
            'sku_id': sku_id,
            'product_name': state_map[sku_id]['product_name'],
            'available': state_map[sku_id]['available']
        }
        for sku_id in top_sku_ids if sku_id in state_map
    ]


async def _get_inactive_skus(
    db: AsyncSession,
    location_id: Optional[int],
    cutoff_date: datetime,
    limit: int
) -> List[Dict[str, Any]]:
    """Get top SKUs with no recent outbound movement."""
    # Get last outbound transaction date for each SKU
    last_activity_conditions = [InventoryTransaction.is_outbound]
    if location_id:
        last_activity_conditions.append(InventoryTransaction.location_id == location_id)
    
    last_activity_stmt = (
        select(
            InventoryTransaction.sku_id,
            func.max(InventoryTransaction.created_at).label("last_outbound")
        )
        .where(and_(*last_activity_conditions))
        .group_by(InventoryTransaction.sku_id)
    )
    
    last_activity_result = await db.execute(last_activity_stmt)
    sku_last_activity = {row.sku_id: row.last_outbound for row in last_activity_result.all()}
    
    # Get inventory state for all SKUs
    state_map = await _get_inventory_state(db, location_id)
    
    # Filter and sort by inactivity period
    inactive_skus = []
    for sku_id, state in state_map.items():
        last_activity = sku_last_activity.get(sku_id)
        
        # SKUs with no activity or haven't been active in the period
        if last_activity is None or last_activity < cutoff_date:
            inactive_skus.append({
                'sku_id': sku_id,
                'product_name': state['product_name'],
                'available': state['available'],
                'last_activity': last_activity
            })
    
    # Sort by last_activity (oldest first), never-active SKUs at the end
    # Use timezone-aware minimum datetime for comparison
    min_datetime = datetime.min.replace(tzinfo=timezone.utc)
    inactive_skus.sort(
        key=lambda x: x['last_activity'] if x['last_activity'] is not None else min_datetime
    )
    
    return inactive_skus[:limit]


async def _get_inventory_state(
    db: AsyncSession,
    location_id: Optional[int],
    sku_ids: Optional[List[str]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Get inventory state for SKUs.
    
    Returns:
        Dict mapping sku_id to {'product_name': str, 'available': int}
    """
    if location_id:
        state_conditions = [InventoryState.location_id == location_id]
        if sku_ids:
            state_conditions.append(InventoryState.sku_id.in_(sku_ids))
        
        state_stmt = select(
            InventoryState.sku_id,
            InventoryState.product_name,
            InventoryState.available
        ).where(and_(*state_conditions))
        
        state_result = await db.execute(state_stmt)
        return {
            row.sku_id: {
                'product_name': row.product_name,
                'available': row.available
            }
            for row in state_result.all()
        }
    else:
        # Aggregate across all locations
        state_stmt = select(
            InventoryState.sku_id,
            func.max(InventoryState.product_name).label("product_name"),
            func.sum(InventoryState.available).label("available")
        ).group_by(InventoryState.sku_id)
        
        if sku_ids:
            state_stmt = state_stmt.where(InventoryState.sku_id.in_(sku_ids))
        
        state_result = await db.execute(state_stmt)
        return {
            row.sku_id: {
                'product_name': row.product_name,
                'available': row.available
            }
            for row in state_result.all()
        }


def determine_stock_status(available: int) -> str:
    """Determine stock status based on available quantity."""
    if available == 0:
        return "Out of Stock"
    elif available < 10:
        return "Low Stock"
    else:
        return "In Stock"


async def get_fast_movers_with_stock_condition(
    db: AsyncSession,
    available_min: int,
    available_max: int,
    limit: int = 5
) -> Optional[List[str]]:
    """
    Get top SKUs with highest outbound movement that meet stock availability criteria.
    Aggregates availability across all locations per SKU.

    Args:
        db: Database session
        available_min: Minimum total available quantity across all locations (inclusive)
        available_max: Maximum total available quantity across all locations (inclusive)
        limit: Number of SKUs to return

    Returns:
        List of SKU IDs or None if no results
    """
    # Subquery: Get SKUs matching stock criteria (aggregated across all locations)
    stock_condition_subquery = (
        select(InventoryState.sku_id)
        .group_by(InventoryState.sku_id)
        .having(
            and_(
                func.sum(InventoryState.available) >= available_min,
                func.sum(InventoryState.available) <= available_max,
            )
        )
    ).subquery()

    # Main query: Get top SKUs by total outbound movement
    stmt = (
        select(
            InventoryTransaction.sku_id,
            func.sum(func.abs(InventoryTransaction.qty)).label("total_outbound"),
        )
        .where(
            and_(
                InventoryTransaction.is_outbound,
                InventoryTransaction.sku_id.in_(
                    select(stock_condition_subquery.c.sku_id)
                ),
            )
        )
        .group_by(InventoryTransaction.sku_id)
        .order_by(func.sum(func.abs(InventoryTransaction.qty)).desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    skus = [row.sku_id for row in result.all()]

    return skus if skus else None


async def get_inactive_skus_with_stock(
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
        List of SKU IDs or None if no results
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Subquery: Get SKUs with any activity in the last N days
    active_skus_subquery = (
        select(distinct(InventoryTransaction.sku_id))
        .where(InventoryTransaction.created_at >= cutoff_date)
    ).scalar_subquery()

    # Main query: Get SKUs with stock but not in active list (aggregated across locations)
    stmt = (
        select(InventoryState.sku_id, func.sum(InventoryState.on_hand).label("total_on_hand"))
        .where(~InventoryState.sku_id.in_(active_skus_subquery))
        .group_by(InventoryState.sku_id)
        .having(func.sum(InventoryState.on_hand) > 0)
        .order_by(func.sum(InventoryState.on_hand).desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    skus = [row.sku_id for row in result.all()]

    return skus if skus else None
