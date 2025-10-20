from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Tuple
from uuid import UUID

from app.models import State


async def count_stockouts(
    db: AsyncSession,
    location_id: Optional[UUID] = None
) -> int:
    """
    Count SKUs with zero available inventory.
    
    Args:
        db: Database session
        location_id: Optional location ID to filter by. If None, counts across all locations.
    
    Returns:
        Number of SKUs with available = 0
    """
    if location_id is not None:
        # For specific location, count rows where available = 0
        stmt = select(func.count(State.sku_code)).where(
            and_(
                State.location_id == location_id,
                State.available == 0
            )
        )
        result = await db.execute(stmt)
        return result.scalar() or 0
    else:
        # For all locations, count distinct SKUs where sum(available) = 0
        stmt = (
            select(State.sku_code)
            .group_by(State.sku_code)
            .having(func.sum(State.available) == 0)
        )
        result = await db.execute(stmt)
        return len(result.all())


async def count_low_stock(
    db: AsyncSession,
    location_id: Optional[UUID] = None,
    threshold: int = 10
) -> int:
    """
    Count SKUs with low stock (0 < available < threshold).
    
    Args:
        db: Database session
        location_id: Optional location ID to filter by. If None, counts across all locations.
        threshold: Upper bound for low stock threshold (default: 10)
    
    Returns:
        Number of SKUs with 0 < available < threshold
    """
    if location_id is not None:
        # For specific location, count rows where 0 < available < threshold
        stmt = select(func.count(State.sku_code)).where(
            and_(
                State.location_id == location_id,
                State.available < threshold,
                State.available > 0
            )
        )
        result = await db.execute(stmt)
        return result.scalar() or 0
    else:
        # For all locations, count distinct SKUs where 0 < sum(available) < threshold
        stmt = (
            select(State.sku_code)
            .group_by(State.sku_code)
            .having(
                and_(
                    func.sum(State.available) < threshold,
                    func.sum(State.available) > 0
                )
            )
        )
        result = await db.execute(stmt)
        return len(result.all())


async def get_stock_status_counts(
    db: AsyncSession,
    location_id: Optional[UUID] = None,
    low_stock_threshold: int = 10
) -> Tuple[int, int]:
    """
    Get both stockout and low stock counts in a single call.
    
    Args:
        db: Database session
        location_id: Optional location ID to filter by. If None, counts across all locations.
        low_stock_threshold: Upper bound for low stock threshold (default: 10)
    
    Returns:
        Tuple of (stockouts_count, low_stock_count)
    """
    stockouts = await count_stockouts(db, location_id)
    low_stock = await count_low_stock(db, location_id, low_stock_threshold)
    return stockouts, low_stock
