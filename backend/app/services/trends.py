from typing import Optional, List, Dict, Tuple
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.common import TrendPoint
from app.models import Location, InventoryTransaction


async def get_inventory_trend_points(
    db: AsyncSession,
    period_days: int,
    sku_id: Optional[str] = None,
    location_name: Optional[str] = None
) -> Tuple[List[TrendPoint], Optional[date]]:
    """
    Get historical on-hand inventory trend points with interpolation (no extrapolation).

    Args:
        db: Database session
        period_days: Number of days to retrieve
        sku_id: Optional SKU identifier. If None, aggregates across all SKUs.
        location_name: Optional location name. If None, aggregates across all locations.

    Returns:
        Tuple of (trend_points, oldest_data_point)
    """
    start_date = datetime.now(timezone.utc).date() - timedelta(days=period_days - 1)
    today = datetime.now(timezone.utc).date()

    # Build base query
    query = (
        select(InventoryTransaction)
        .join(Location, InventoryTransaction.location_id == Location.id)
        .order_by(InventoryTransaction.created_at)
    )

    # Apply filters
    if sku_id is not None:
        query = query.where(InventoryTransaction.sku_id == sku_id)

    if location_name is not None:
        query = query.where(Location.name == location_name)

    result = await db.execute(query)
    transactions = result.scalars().all()

    if not transactions:
        return [], None

    # Find the earliest transaction date
    earliest_txn_date = transactions[0].created_at.date()

    # Adjust start_date to not go before earliest transaction (no extrapolation)
    actual_start_date = max(start_date, earliest_txn_date)

    # Build daily on-hand data based on aggregation level
    daily_on_hand = _build_daily_on_hand(transactions, today, location_name)

    if not daily_on_hand:
        return [], None

    # The true oldest data point for the trend
    oldest_data_point = min(daily_on_hand.keys())

    # Build interpolated trend points
    points = _interpolate_trend_points(daily_on_hand, actual_start_date, today)

    return points, oldest_data_point


def _build_daily_on_hand(
    transactions: List[InventoryTransaction],
    today: date,
    location_name: Optional[str]
) -> Dict[date, int]:
    """
    Build daily on-hand inventory from transactions.
    Handles both single location and multi-location aggregation.
    """
    if location_name is not None:
        # Single location - aggregate across SKUs (if multiple)
        return _build_single_location_daily_on_hand(transactions, today)
    else:
        # Multiple locations - aggregate across locations and SKUs
        return _build_multi_location_daily_on_hand(transactions, today)


def _build_single_location_daily_on_hand(
    transactions: List[InventoryTransaction],
    today: date
) -> Dict[date, int]:
    """Build daily on-hand for a single location, aggregating across SKUs."""
    sku_daily_on_hand = {}

    # Group transactions by SKU
    for txn in transactions:
        txn_date = txn.created_at.date()
        sku_id = txn.sku_id

        if sku_id not in sku_daily_on_hand:
            sku_daily_on_hand[sku_id] = {}

        if txn.action in ["reserve", "unreserve"]:
            on_hand = txn.qty_before
        else:
            on_hand = txn.qty_before + txn.qty

        sku_daily_on_hand[sku_id][txn_date] = on_hand

    # Get all transaction dates
    all_dates = set()
    for sku_data in sku_daily_on_hand.values():
        all_dates.update(sku_data.keys())

    if not all_dates:
        return {}

    earliest_date = min(all_dates)

    # Build interpolated series per SKU
    sku_series = _interpolate_series_per_key(sku_daily_on_hand, earliest_date, today)

    # Aggregate across SKUs
    return _aggregate_series(sku_series, earliest_date, today)


def _build_multi_location_daily_on_hand(
    transactions: List[InventoryTransaction],
    today: date
) -> Dict[date, int]:
    """Build daily on-hand for multiple locations and SKUs."""
    location_sku_daily_on_hand = {}

    # Group transactions by (location_id, sku_id)
    for txn in transactions:
        txn_date = txn.created_at.date()
        key = (txn.location_id, txn.sku_id)

        if key not in location_sku_daily_on_hand:
            location_sku_daily_on_hand[key] = {}

        if txn.action in ["reserve", "unreserve"]:
            on_hand = txn.qty_before
        else:
            on_hand = txn.qty_before + txn.qty

        location_sku_daily_on_hand[key][txn_date] = on_hand

    # Get all transaction dates
    all_dates = set()
    for combo_data in location_sku_daily_on_hand.values():
        all_dates.update(combo_data.keys())

    if not all_dates:
        return {}

    earliest_date = min(all_dates)

    # Build interpolated series per location-SKU combination
    combo_series = _interpolate_series_per_key(location_sku_daily_on_hand, earliest_date, today)

    # Aggregate across all combinations
    return _aggregate_series(combo_series, earliest_date, today)


def _interpolate_series_per_key(
    key_daily_on_hand: Dict[any, Dict[date, int]],
    earliest_date: date,
    today: date
) -> Dict[any, Dict[date, int]]:
    """
    Build interpolated time series for each key (SKU, location-SKU combo, etc.).
    """
    series = {}

    for key, daily in key_daily_on_hand.items():
        series[key] = {}
        last_known = None
        key_earliest = min(daily.keys())
        current_date = earliest_date

        while current_date <= today:
            if current_date < key_earliest:
                current_date += timedelta(days=1)
                continue

            if current_date in daily:
                last_known = daily[current_date]
                series[key][current_date] = last_known
            elif last_known is not None:
                series[key][current_date] = last_known

            current_date += timedelta(days=1)

    return series


def _aggregate_series(
    series: Dict[any, Dict[date, int]],
    earliest_date: date,
    today: date
) -> Dict[date, int]:
    """
    Aggregate multiple time series into a single daily on-hand dictionary.
    """
    daily_on_hand = {}
    current_date = earliest_date

    while current_date <= today:
        total = 0
        has_data = False

        for key_series in series.values():
            if current_date in key_series:
                total += key_series[current_date]
                has_data = True

        if has_data:
            daily_on_hand[current_date] = total

        current_date += timedelta(days=1)

    return daily_on_hand


def _interpolate_trend_points(
    daily_on_hand: Dict[date, int],
    start_date: date,
    today: date
) -> List[TrendPoint]:
    """
    Generate interpolated trend points for the requested period.
    """
    points = []
    last_known_on_hand = None

    # Find the last known value before or at start_date
    for date_key in sorted(daily_on_hand.keys()):
        if date_key <= start_date:
            last_known_on_hand = daily_on_hand[date_key]
        else:
            break

    # Generate points for the period
    current_date = start_date
    while current_date <= today:
        if current_date in daily_on_hand:
            last_known_on_hand = daily_on_hand[current_date]
            points.append(TrendPoint(date=current_date, on_hand=last_known_on_hand))
        elif last_known_on_hand is not None:
            points.append(TrendPoint(date=current_date, on_hand=last_known_on_hand))

        current_date += timedelta(days=1)

    return points
