
import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.trends import get_inventory_trend_points
from app.models import SKU, Location, Transaction, Organization

# Reuse the helper from test_metrics_service or define a local one
async def _create_txn(
    db: AsyncSession,
    org: Organization,
    sku: SKU,
    location: Location,
    qty: int,
    action: str,
    created_at: datetime,
    qty_before: int,
):
    txn = Transaction(
        org_id=org.org_id,
        sku_code=sku.code,
        location_id=location.id,
        qty=qty,
        action=action,
        created_at=created_at,
        qty_before=qty_before,
    )
    db.add(txn)
    await db.flush()
    return txn

@pytest.mark.asyncio
class TestTrendsService:
    
    @pytest_asyncio.fixture
    async def setup_basic(self, db_session, create_org, create_sku, create_location):
        org = await create_org(name="Trend Org")
        sku = await create_sku(org, code="TREND-SKU-1", name="Trend SKU 1")
        loc = await create_location(org, name="Warehouse 1")
        return org, sku, loc

    @pytest_asyncio.fixture
    async def setup_multi(self, db_session, create_org, create_sku, create_location):
        org = await create_org(name="Trend Multi Org")
        sku1 = await create_sku(org, code="SKU-A")
        sku2 = await create_sku(org, code="SKU-B")
        loc1 = await create_location(org, name="Loc Alpha")
        loc2 = await create_location(org, name="Loc Beta")
        return org, sku1, sku2, loc1, loc2

    async def test_no_transactions(self, db_session):
        """Should return empty list and None date if no transactions exist."""
        points, oldest = await get_inventory_trend_points(db_session, period_days=30)
        assert points == []
        assert oldest is None

    async def test_single_sku_linear_growth(self, db_session, setup_basic):
        """
        Verify simple day-over-day growth.
        Day 1: +10 (Total 10)
        Day 2: +5  (Total 15)
        ... gap ...
        """
        org, sku, loc = setup_basic
        now = datetime.now(timezone.utc)
        
        # Day -5: Receive 10. Result: 10
        date_5_days_ago = now - timedelta(days=5)
        await _create_txn(db_session, org, sku, loc, 10, "receive", date_5_days_ago, 0)

        # Day -3: Receive 5. Result: 15
        date_3_days_ago = now - timedelta(days=3)
        await _create_txn(db_session, org, sku, loc, 5, "receive", date_3_days_ago, 10)

        # Ask for 7 days trend
        points, oldest = await get_inventory_trend_points(db_session, period_days=7)
        
        # Oldest data point should be Day -5
        assert oldest == date_5_days_ago.date()
        
        # We expect points from "max(start_date, earliest_txn)" to today
        # Start date = now - 6 days. Earliest txn = now - 5 days.
        # So points start from Day -5.
        
        points_map = {p.date: p.on_hand for p in points}
        
        # Check Day -5 (10)
        assert points_map[date_5_days_ago.date()] == 10
        # Check Day -4 (interp 10)
        assert points_map[(now - timedelta(days=4)).date()] == 10
        # Check Day -3 (15)
        assert points_map[date_3_days_ago.date()] == 15
        # Check Day -2 (interp 15)
        assert points_map[(now - timedelta(days=2)).date()] == 15
        # Check Today (15)
        assert points_map[now.date()] == 15

    async def test_multiple_transactions_same_day(self, db_session, setup_basic):
        """Last transaction of the day dictates the day's value."""
        org, sku, loc = setup_basic
        now = datetime.now(timezone.utc)
        
        # Day -2:
        # 1. Receive 100 (Total 100)
        await _create_txn(db_session, org, sku, loc, 100, "receive", now - timedelta(days=2, hours=10), 0)
        # 2. Ship 20 (Total 80)
        await _create_txn(db_session, org, sku, loc, -20, "ship", now - timedelta(days=2, hours=5), 100)
        # 3. Receive 5 (Total 85) -- Last one
        await _create_txn(db_session, org, sku, loc, 5, "receive", now - timedelta(days=2, hours=1), 80)

        points, oldest = await get_inventory_trend_points(db_session, period_days=5)
        
        points_map = {p.date: p.on_hand for p in points}
        assert points_map[(now - timedelta(days=2)).date()] == 85
        assert points_map[now.date()] == 85

    async def test_history_older_than_period(self, db_session, setup_basic):
        """
        If transactions exist before the requested period, the first point 
        of the period should correctly reflect the state carried forward.
        """
        org, sku, loc = setup_basic
        now = datetime.now(timezone.utc)
        
        # Transaction 20 days ago: +100
        await _create_txn(db_session, org, sku, loc, 100, "receive", now - timedelta(days=20), 0)
        
        # Request 10 days period
        points, oldest = await get_inventory_trend_points(db_session, period_days=10)
        
        # Oldest real data point is 20 days ago
        assert oldest == (now - timedelta(days=20)).date()
        
        # Returned points should strictly cover the request period (approx 10 days)
        # The service logic logic: start_date = now - (period - 1).
        # actual_start_date = max(start_date, earliest).
        # Since earliest (20 days ago) < start (9 days ago), actual starts at start_date.
        
        expected_start = (now - timedelta(days=9)).date()
        assert points[0].date == expected_start
        assert points[0].on_hand == 100 # Carried forward from day -20

    async def test_reserve_unreserve_ignored(self, db_session, setup_basic):
        """Reserve/Unreserve should not affect on_hand count."""
        org, sku, loc = setup_basic
        now = datetime.now(timezone.utc)
        
        # Day -2: Receive 50
        await _create_txn(db_session, org, sku, loc, 50, "receive", now - timedelta(days=2), 0)
        
        # Day -1: Reserve 10. on_hand stays 50.
        await _create_txn(db_session, org, sku, loc, 10, "reserve", now - timedelta(days=1), 50)
        
        points, _ = await get_inventory_trend_points(db_session, period_days=5)
        points_map = {p.date: p.on_hand for p in points}
        
        assert points_map[(now - timedelta(days=2)).date()] == 50
        assert points_map[(now - timedelta(days=1)).date()] == 50
        assert points_map[now.date()] == 50

    async def test_aggregate_multiple_skus(self, db_session, setup_multi):
        """Verify summation across different SKUs."""
        org, sku1, sku2, loc1, loc2 = setup_multi
        now = datetime.now(timezone.utc)
        
        # SKU A: +10 on Day -3
        await _create_txn(db_session, org, sku1, loc1, 10, "receive", now - timedelta(days=3), 0)
        
        # SKU B: +20 on Day -3
        await _create_txn(db_session, org, sku2, loc1, 20, "receive", now - timedelta(days=3), 0)
        
        # SKU A: +5 on Day -1 (Total A=15, B=20 => 35)
        await _create_txn(db_session, org, sku1, loc1, 5, "receive", now - timedelta(days=1), 10)

        points, _ = await get_inventory_trend_points(db_session, period_days=5)
        points_map = {p.date: p.on_hand for p in points}
        
        # Day -3: 10 + 20 = 30
        assert points_map[(now - timedelta(days=3)).date()] == 30
        
        # Day -2: No change = 30
        assert points_map[(now - timedelta(days=2)).date()] == 30
        
        # Day -1: 15 + 20 = 35
        assert points_map[(now - timedelta(days=1)).date()] == 35

    async def test_aggregate_multiple_locations(self, db_session, setup_multi):
        """Verify summation across locations for same/diff SKUs."""
        org, sku1, _, loc1, loc2 = setup_multi
        now = datetime.now(timezone.utc)
        
        # SKU A in Loc 1: +100
        await _create_txn(db_session, org, sku1, loc1, 100, "receive", now - timedelta(days=5), 0)
        
        # SKU A in Loc 2: +50
        await _create_txn(db_session, org, sku1, loc2, 50, "receive", now - timedelta(days=5), 0)
        
        # Transfer out from Loc 1 to Loc 2 on Day -2
        # Loc 1 sends 10 (-10) -> Loc 1 becomes 90
        await _create_txn(db_session, org, sku1, loc1, -10, "transfer_out", now - timedelta(days=2), 100)
        # Loc 2 receives 10 (+10) -> Loc 2 becomes 60
        await _create_txn(db_session, org, sku1, loc2, 10, "transfer_in", now - timedelta(days=2), 50)
        
        points, _ = await get_inventory_trend_points(db_session, period_days=10)
        points_map = {p.date: p.on_hand for p in points}
        
        # Day -5 (Initial): 100 + 50 = 150
        assert points_map[(now - timedelta(days=5)).date()] == 150
        
        # Day -2 (Transfer): 90 + 60 = 150 (Total inventory shouldn't change on transfer)
        assert points_map[(now - timedelta(days=2)).date()] == 150

    async def test_filter_by_sku_code(self, db_session, setup_multi):
        org, sku1, sku2, loc1, _ = setup_multi
        now = datetime.now(timezone.utc)
        
        # SKU A: 100
        await _create_txn(db_session, org, sku1, loc1, 100, "receive", now - timedelta(days=5), 0)
        # SKU B: 200
        await _create_txn(db_session, org, sku2, loc1, 200, "receive", now - timedelta(days=5), 0)
        
        # Filter for SKU A
        points, _ = await get_inventory_trend_points(db_session, 10, sku_code=sku1.code)
        
        # Should only see 100
        for p in points:
            if p.date >= (now - timedelta(days=5)).date():
                assert p.on_hand == 100

    async def test_filter_by_location_name(self, db_session, setup_multi):
        org, sku1, _, loc1, loc2 = setup_multi
        now = datetime.now(timezone.utc)
        
        # Loc 1: 100
        await _create_txn(db_session, org, sku1, loc1, 100, "receive", now - timedelta(days=5), 0)
        # Loc 2: 50
        await _create_txn(db_session, org, sku1, loc2, 50, "receive", now - timedelta(days=5), 0)
        
        # Filter for Loc 2
        points, _ = await get_inventory_trend_points(db_session, 10, location_name=loc2.name)
        
        for p in points:
            if p.date >= (now - timedelta(days=5)).date():
                assert p.on_hand == 50

    async def test_complex_scenario_dips_and_recovery(self, db_session, setup_basic):
        """
        Stock: 10 -> 0 -> 20.
        Verify the dip to 0 is captured.
        """
        org, sku, loc = setup_basic
        now = datetime.now(timezone.utc)
        
        # Day -4: +10
        await _create_txn(db_session, org, sku, loc, 10, "receive", now - timedelta(days=4), 0)
        # Day -3: -10 (Stockout)
        await _create_txn(db_session, org, sku, loc, -10, "ship", now - timedelta(days=3), 10)
        # Day -1: +20
        await _create_txn(db_session, org, sku, loc, 20, "receive", now - timedelta(days=1), 0)
        
        points, _ = await get_inventory_trend_points(db_session, 7)
        points_map = {p.date: p.on_hand for p in points}
        
        assert points_map[(now - timedelta(days=4)).date()] == 10
        assert points_map[(now - timedelta(days=3)).date()] == 0
        assert points_map[(now - timedelta(days=2)).date()] == 0 # Interpolated stationary at 0
        assert points_map[(now - timedelta(days=1)).date()] == 20
        assert points_map[now.date()] == 20
