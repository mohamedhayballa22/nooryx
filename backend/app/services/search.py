from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, case
from app.models import SKU, Location
from typing import List, Dict


async def search_skus(
    db: AsyncSession,
    query: str,
    limit: int = 5
) -> List[Dict[str, str]]:
    """
    Fast partial match search on SKU code and name.

    - Code search is case-sensitive (stored uppercase, users search uppercase).
    - Name search is case-insensitive using lower().
    - Prioritizes prefix matches, then substring matches.
    """
    if not query or not query.strip():
        return []

    q = query.strip()
    search_pattern = f"%{q}%"
    starts_with_pattern = f"{q}%"

    rank = case(
        (SKU.code.like(starts_with_pattern), 1),
        (func.lower(SKU.name).like(func.lower(starts_with_pattern)), 2),
        (SKU.code.like(search_pattern), 3),
        (func.lower(SKU.name).like(func.lower(search_pattern)), 4),
        else_=5
    ).label("rank")

    stmt = (
        select(SKU.code, SKU.name, SKU.alerts, SKU.reorder_point, SKU.low_stock_threshold, rank)
        .where(
            or_(
                SKU.code.like(search_pattern),
                func.lower(SKU.name).like(func.lower(search_pattern))
            )
        )
        .order_by(rank, SKU.code)
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [{
        "sku_code": row.code, 
        "sku_name": row.name, 
        "alerts": row.alerts, 
        "reorder_point": row.reorder_point, 
        "low_stock_threshold": row.low_stock_threshold} for row in rows]



async def search_locations(
    db: AsyncSession,
    query: str,
    limit: int = 5
) -> List[str]:
    """
    Perform fast partial match search on Location name.
    Uses ILIKE for case-insensitive PostgreSQL search.
    Prioritizes matches at the beginning of strings.
    Returns a list of location names.
    """
    if not query or not query.strip():
        return []

    q = query.strip().lower()
    search_pattern = f"%{q}%"
    starts_with_pattern = f"{q}%"

    # Build ranking logic:
    # 1. Name starts with query
    # 2. Name contains query
    rank = case(
        (func.lower(Location.name).like(starts_with_pattern), 1),
        (func.lower(Location.name).like(search_pattern), 2),
        else_=3
    ).label("rank")

    stmt = (
        select(
            Location.name,
            rank
        )
        .where(
            func.lower(Location.name).like(search_pattern)
        )
        .order_by(rank, Location.name)
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [row.name for row in rows]
