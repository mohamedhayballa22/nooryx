from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, case, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction


async def calculate_weekly_delta(
    db: AsyncSession,
    current_on_hand: int,
    sku_code: str | None = None,
    location_id: str | None = None,
) -> float:
    """
    Calculate percentage change in on-hand inventory from last week.

    Args:
        db: Database session
        current_on_hand: Current inventory on hand
        sku_code: SKU code identifier (None for global calculation across all SKUs)
        location_id: Location UUID identifier (None for calculation across all locations)

    Returns:
        Percentage change from last week, rounded to 1 decimal place
    """

    # Handle special case where current stock is 0
    if current_on_hand == 0:
        one_week_ago = datetime.now() - timedelta(days=7)
        two_weeks_ago = datetime.now() - timedelta(days=14)

        filters = [
            Transaction.created_at >= two_weeks_ago,
            Transaction.created_at <= one_week_ago,
        ]
        if sku_code is not None:
            filters.append(Transaction.sku_code == sku_code)
        if location_id is not None:
            filters.append(Transaction.location_id == location_id)

        stmt = (
            select(Transaction)
            .where(and_(*filters))
            .order_by(Transaction.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        last_week_txn = result.scalar_one_or_none()

        if last_week_txn:
            last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)
            if last_week_on_hand > 0:
                return -100.0

        return 0.0

    # Normal weekly delta calculation ---
    today = datetime.now()
    min_date = today - timedelta(days=11)
    max_date = today - timedelta(days=5)

    filters = [
        Transaction.created_at >= min_date,
        Transaction.created_at <= max_date,
    ]
    if sku_code is not None:
        filters.append(Transaction.sku_code == sku_code)
    if location_id is not None:
        filters.append(Transaction.location_id == location_id)

    # Build subquery that keeps only the most recent transaction per day
    # This ensures that when we pick the "closest to 7 days ago" record, it’s the newest within its day.
    day_subquery = (
        select(
            cast(Transaction.created_at, Date).label("txn_day"),
            func.max(Transaction.created_at).label("max_created_at"),
        )
        .where(and_(*filters))
        .group_by(cast(Transaction.created_at, Date))
    ).subquery()

    # Join to get back the full transaction rows, limited by filters
    joined_stmt = (
        select(Transaction)
        .join(
            day_subquery,
            Transaction.created_at == day_subquery.c.max_created_at,
        )
        .where(and_(*filters))
        .order_by(
            func.abs(
                func.extract(
                    "epoch",
                    Transaction.created_at - (today - timedelta(days=7)),
                )
            )
        )
        .limit(1)
    )

    result = await db.execute(joined_stmt)
    ideal_txn = result.scalar_one_or_none()

    if not ideal_txn:
        return 0.0

    # Multi-location case
    if location_id is None:
        # The "ideal" txn is from the aggregated context (not restricted to one location)
        target_timestamp = ideal_txn.created_at

        subquery_filters = [Transaction.created_at <= target_timestamp]
        if sku_code is not None:
            subquery_filters.append(Transaction.sku_code == sku_code)

        subquery = (
            select(
                Transaction.location_id,
                func.max(Transaction.created_at).label("max_created_at"),
            )
            .where(and_(*subquery_filters))
            .group_by(Transaction.location_id)
        ).subquery()

        join_conditions = [
            Transaction.location_id == subquery.c.location_id,
            Transaction.created_at == subquery.c.max_created_at,
        ]
        if sku_code is not None:
            join_conditions.append(Transaction.sku_code == sku_code)

        stmt = (
            select(
                func.sum(
                    case(
                        (
                            Transaction.action.in_(["reserve", "unreserve"]),
                            Transaction.qty_before,
                        ),
                        else_=Transaction.qty_before + Transaction.qty,
                    )
                )
            )
            .select_from(Transaction)
            .join(subquery, and_(*join_conditions))
        )

        result = await db.execute(stmt)
        last_week_on_hand = result.scalar() or 0

    # Single-location case
    else:
        # The "ideal_txn" was chosen within that specific location already
        last_week_txn = ideal_txn
        last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)

    if last_week_on_hand == 0:
        return 0.0

    # Compute delta percentage
    delta_pct = ((current_on_hand - last_week_on_hand) / last_week_on_hand) * 100
    return round(delta_pct, 1)


def _calculate_on_hand_from_txn(txn: Transaction) -> int:
    """Calculate on-hand quantity at the time of a transaction."""
    if txn.action in ["reserve", "unreserve"]:
        return txn.qty_before
    else:
        return txn.qty_before + txn.qty
