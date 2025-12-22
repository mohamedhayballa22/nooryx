from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, case, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction


async def calculate_weekly_delta_single_sku(
    db: AsyncSession,
    current_on_hand: int,
    sku_code: str,
    location_id: str | None = None,
) -> float:
    """
    Calculate percentage change in on-hand inventory from last week for a specific SKU.

    Args:
        db: Database session
        current_on_hand: Current inventory on hand for this SKU
        sku_code: SKU code identifier (required)
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
            Transaction.sku_code == sku_code,
        ]
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

    # Normal weekly delta calculation
    today = datetime.now()
    min_date = today - timedelta(days=11)
    max_date = today - timedelta(days=5)

    filters = [
        Transaction.created_at >= min_date,
        Transaction.created_at <= max_date,
        Transaction.sku_code == sku_code,
    ]
    if location_id is not None:
        filters.append(Transaction.location_id == location_id)

    day_subquery = (
        select(
            cast(Transaction.created_at, Date).label("txn_day"),
            func.max(Transaction.created_at).label("max_created_at"),
        )
        .where(and_(*filters))
        .group_by(cast(Transaction.created_at, Date))
    ).subquery()

    # Build join conditions
    join_conditions = [Transaction.created_at == day_subquery.c.max_created_at]
    
    # Add SKU filter to join to ensure we only get transactions for this SKU
    join_filters = [Transaction.sku_code == sku_code]
    if location_id is not None:
        join_filters.append(Transaction.location_id == location_id)
    
    joined_stmt = (
        select(Transaction)
        .join(
            day_subquery,
            and_(*join_conditions),
        )
        .where(and_(*join_filters))
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
        # No transaction in ideal window (5-11 days ago)
        # Fall back: find the most recent transaction BEFORE the window
        fallback_max_date = today - timedelta(days=11)
        
        fallback_filters = [
            Transaction.created_at <= fallback_max_date,
            Transaction.sku_code == sku_code,
        ]
        if location_id is not None:
            fallback_filters.append(Transaction.location_id == location_id)
        
        fallback_stmt = (
            select(Transaction)
            .where(and_(*fallback_filters))
            .order_by(Transaction.created_at.desc())
            .limit(1)
        )
        
        result = await db.execute(fallback_stmt)
        ideal_txn = result.scalar_one_or_none()
        
        # If still no transaction found, check if there are ANY transactions
        if not ideal_txn:
            # Check if ANY transactions exist for this SKU (to distinguish new inventory from no data)
            any_txn_filters = [Transaction.sku_code == sku_code]
            if location_id is not None:
                any_txn_filters.append(Transaction.location_id == location_id)
            
            any_txn_stmt = select(Transaction).where(and_(*any_txn_filters)).limit(1)
            result = await db.execute(any_txn_stmt)
            has_any_txn = result.scalar_one_or_none() is not None
            
            if has_any_txn and current_on_hand > 0:
                # New inventory: transactions exist but all are recent (< 5 days ago)
                return 100.0
            # No transactions at all, or current is 0
            return 0.0

    # Multi-location case for this SKU
    if location_id is None:
        target_timestamp = ideal_txn.created_at

        subquery = (
            select(
                Transaction.location_id,
                func.max(Transaction.created_at).label("max_created_at"),
            )
            .where(
                and_(
                    Transaction.created_at <= target_timestamp,
                    Transaction.sku_code == sku_code,
                )
            )
            .group_by(Transaction.location_id)
        ).subquery()

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
            .join(
                subquery,
                and_(
                    Transaction.location_id == subquery.c.location_id,
                    Transaction.created_at == subquery.c.max_created_at,
                    Transaction.sku_code == sku_code,
                ),
            )
        )

        result = await db.execute(stmt)
        last_week_on_hand = result.scalar() or 0

    # Single-location case
    else:
        last_week_txn = ideal_txn
        last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)

    if last_week_on_hand == 0:
        return 0.0

    # Compute delta percentage
    delta_pct = ((current_on_hand - last_week_on_hand) / last_week_on_hand) * 100
    return round(delta_pct, 1)


async def calculate_weekly_delta_all_skus(
    db: AsyncSession,
    current_on_hand: int,
    location_id: str | None = None,
) -> float:
    """
    Calculate percentage change in on-hand inventory from last week across ALL SKUs.

    Args:
        db: Database session
        current_on_hand: Current total inventory on hand across all SKUs
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
        if location_id is not None:
            filters.append(Transaction.location_id == location_id)

        stmt = (
            select(Transaction)
            .where(and_(*filters))
            .order_by(Transaction.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        most_recent_txn = result.scalar_one_or_none()

        if most_recent_txn:
            target_timestamp = most_recent_txn.created_at

            last_week_on_hand = await _calculate_total_on_hand_at_timestamp(
                db, target_timestamp, location_id
            )

            if last_week_on_hand > 0:
                return -100.0

        return 0.0

    # Normal weekly delta calculation
    today = datetime.now()
    min_date = today - timedelta(days=11)
    max_date = today - timedelta(days=5)

    filters = [
        Transaction.created_at >= min_date,
        Transaction.created_at <= max_date,
    ]
    if location_id is not None:
        filters.append(Transaction.location_id == location_id)

    day_subquery = (
        select(
            cast(Transaction.created_at, Date).label("txn_day"),
            func.max(Transaction.created_at).label("max_created_at"),
        )
        .where(and_(*filters))
        .group_by(cast(Transaction.created_at, Date))
    ).subquery()

    joined_stmt = (
        select(Transaction)
        .join(
            day_subquery,
            Transaction.created_at == day_subquery.c.max_created_at,
        )
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
        # No transaction in ideal window (5-11 days ago)
        # Fall back: find the most recent transaction BEFORE the window
        fallback_max_date = today - timedelta(days=11)
        
        fallback_filters = [
            Transaction.created_at <= fallback_max_date,
        ]
        if location_id is not None:
            fallback_filters.append(Transaction.location_id == location_id)
        
        fallback_stmt = (
            select(Transaction)
            .where(and_(*fallback_filters))
            .order_by(Transaction.created_at.desc())
            .limit(1)
        )
        
        result = await db.execute(fallback_stmt)
        ideal_txn = result.scalar_one_or_none()
        
        # If still no transaction found, check if there are ANY transactions
        if not ideal_txn:
            # Check if ANY transactions exist (to distinguish new inventory from no data)
            any_txn_filters = []
            if location_id is not None:
                any_txn_filters.append(Transaction.location_id == location_id)
            
            any_txn_stmt = select(Transaction).where(and_(*any_txn_filters) if any_txn_filters else True).limit(1)
            result = await db.execute(any_txn_stmt)
            has_any_txn = result.scalar_one_or_none() is not None
            
            if has_any_txn and current_on_hand > 0:
                # New inventory: transactions exist but all are recent (< 5 days ago)
                return 100.0
            # No transactions at all, or current is 0
            return 0.0

    target_timestamp = ideal_txn.created_at

    last_week_on_hand = await _calculate_total_on_hand_at_timestamp(
        db, target_timestamp, location_id
    )

    if last_week_on_hand == 0:
        return 0.0

    # Compute delta percentage
    delta_pct = ((current_on_hand - last_week_on_hand) / last_week_on_hand) * 100
    return round(delta_pct, 1)


async def _calculate_total_on_hand_at_timestamp(
    db: AsyncSession,
    target_timestamp: datetime,
    location_id: str | None = None,
) -> int:
    """
    Calculate total on_hand across all SKUs at a specific timestamp.
    
    For each (location, SKU) combination, finds the most recent transaction
    up to the target timestamp and calculates its on_hand value.
    """
    filters = [Transaction.created_at <= target_timestamp]
    if location_id is not None:
        filters.append(Transaction.location_id == location_id)

    subquery = (
        select(
            Transaction.location_id,
            Transaction.sku_code,
            func.max(Transaction.created_at).label("max_created_at"),
        )
        .where(and_(*filters))
        .group_by(Transaction.location_id, Transaction.sku_code)
    ).subquery()

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
        .join(
            subquery,
            and_(
                Transaction.location_id == subquery.c.location_id,
                Transaction.sku_code == subquery.c.sku_code,
                Transaction.created_at == subquery.c.max_created_at,
            ),
        )
    )

    result = await db.execute(stmt)
    total_on_hand = result.scalar() or 0
    
    return total_on_hand


def _calculate_on_hand_from_txn(txn: Transaction) -> int:
    """Calculate on-hand quantity at the time of a transaction."""
    if txn.action in ["reserve", "unreserve"]:
        return txn.qty_before
    else:
        return txn.qty_before + txn.qty
