from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryTransaction


async def calculate_weekly_delta(
    db: AsyncSession,
    current_on_hand: int,
    sku_id: str | None = None,
    location_id: int | None = None,
) -> float:
    """
    Calculate percentage change in on-hand inventory from last week.

    Args:
        db: Database session
        current_on_hand: Current inventory on hand
        sku_id: SKU identifier (None for global calculation across all SKUs)
        location_id: Location identifier (None for calculation across all locations)

    Returns:
        Percentage change from last week, rounded to 1 decimal place
    """

    # Special case: current stock is 0
    if current_on_hand == 0:
        one_week_ago = datetime.now() - timedelta(days=7)
        two_weeks_ago = datetime.now() - timedelta(days=14)

        filters = [
            InventoryTransaction.created_at >= two_weeks_ago,
            InventoryTransaction.created_at <= one_week_ago,
        ]
        if sku_id is not None:
            filters.append(InventoryTransaction.sku_id == sku_id)
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
        InventoryTransaction.created_at >= min_date,
        InventoryTransaction.created_at <= max_date,
    ]
    if sku_id is not None:
        filters.append(InventoryTransaction.sku_id == sku_id)
    if location_id is not None:
        filters.append(InventoryTransaction.location_id == location_id)

    # Handle aggregation across all locations
    if location_id is None:
        # First, find the best timestamp (closest to 7 days ago)
        timestamp_stmt = (
            select(InventoryTransaction.created_at)
            .where(and_(*filters))
            .order_by(
                func.abs(
                    func.extract(
                        "epoch",
                        InventoryTransaction.created_at - (today - timedelta(days=7)),
                    )
                )
            )
            .limit(1)
        )
        timestamp_result = await db.execute(timestamp_stmt)
        target_timestamp = timestamp_result.scalar_one_or_none()

        if not target_timestamp:
            return 0.0

        # Build subquery filters
        subquery_filters = [InventoryTransaction.created_at <= target_timestamp]
        if sku_id is not None:
            subquery_filters.append(InventoryTransaction.sku_id == sku_id)

        # Get most recent transaction at or before this timestamp for each location
        # and sum their on_hand values
        subquery = (
            select(
                InventoryTransaction.location_id,
                func.max(InventoryTransaction.created_at).label("max_created_at"),
            )
            .where(and_(*subquery_filters))
            .group_by(InventoryTransaction.location_id)
        ).subquery()

        # Build join conditions
        join_conditions = [
            InventoryTransaction.location_id == subquery.c.location_id,
            InventoryTransaction.created_at == subquery.c.max_created_at,
        ]
        if sku_id is not None:
            join_conditions.append(InventoryTransaction.sku_id == sku_id)

        stmt = (
            select(
                func.sum(
                    case(
                        (
                            InventoryTransaction.action.in_(["reserve", "unreserve"]),
                            InventoryTransaction.qty_before,
                        ),
                        else_=InventoryTransaction.qty_before + InventoryTransaction.qty,
                    )
                )
            )
            .select_from(InventoryTransaction)
            .join(subquery, and_(*join_conditions))
        )

        result = await db.execute(stmt)
        last_week_on_hand = result.scalar() or 0

        if last_week_on_hand == 0:
            return 0.0
    else:
        # Single location query
        stmt = (
            select(InventoryTransaction)
            .where(and_(*filters))
            .order_by(
                func.abs(
                    func.extract(
                        "epoch",
                        InventoryTransaction.created_at - (today - timedelta(days=7)),
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

    if last_week_on_hand == 0:
        return 0.0 # Avoid division by zero if last week was 0 and this week isn't
        
    delta_pct = ((current_on_hand - last_week_on_hand) / last_week_on_hand) * 100
    return round(delta_pct, 1)


def _calculate_on_hand_from_txn(txn: InventoryTransaction) -> int:
    """Calculate on-hand quantity at the time of a transaction."""
    if txn.action in ["reserve", "unreserve"]:
        return txn.qty_before
    else:
        return txn.qty_before + txn.qty
    