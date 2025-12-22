import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from uuid6 import uuid7
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import SKU, Location, Transaction, Organization
from app.services.metrics import (
    calculate_weekly_delta_single_sku,
    calculate_weekly_delta_all_skus,
    _calculate_on_hand_from_txn,
    _calculate_total_on_hand_at_timestamp
)

# Helper to create a transaction (similar to what TransactionService would do)
async def _create_transaction(
    db: AsyncSession,
    org: Organization,
    sku: SKU,
    location: Location,
    qty: int,
    action: str,
    created_at: datetime,
    qty_before: int,
    commit: bool = False  # Changed default to False
) -> Transaction:
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
    if commit:
        await db.commit()
    else:
        await db.flush()  # Always flush so IDs are generated
    return txn


class TestMetricsService:
    """
    Tests for the metrics service functions.
    """

    @pytest_asyncio.fixture
    async def setup_org_sku_loc(self, db_session, create_org, create_sku, create_location):
        """Sets up a basic organization, SKU, and location for tests."""
        org = await create_org(name="Test Org for Metrics")
        sku = await create_sku(org, code="METRIC-SKU-001", name="Metric Test SKU")
        location = await create_location(org, name="Main Warehouse")
        return org, sku, location

    @pytest_asyncio.fixture
    async def setup_multiple_skus_loc(self, db_session, create_org, create_sku, create_location):
        """Sets up an organization, multiple SKUs, and a location."""
        org = await create_org(name="Multi-SKU Org")
        sku1 = await create_sku(org, code="METRIC-SKU-A", name="Metric SKU A")
        sku2 = await create_sku(org, code="METRIC-SKU-B", name="Metric SKU B")
        location = await create_location(org, name="Central Loc")
        return org, sku1, sku2, location

    @pytest_asyncio.fixture
    async def setup_multiple_locations(self, db_session, create_org, create_sku, create_location):
        """Sets up an organization, a SKU, and multiple locations."""
        org = await create_org(name="Multi-Loc Org")
        sku = await create_sku(org, code="METRIC-SKU-X", name="Metric SKU X")
        loc1 = await create_location(org, name="Loc 1")
        loc2 = await create_location(org, name="Loc 2")
        return org, sku, loc1, loc2


    # --- Test _calculate_on_hand_from_txn helper ---
    def test_calculate_on_hand_from_txn_receive(self):
        txn = Transaction(qty=10, action="receive", qty_before=50)
        assert _calculate_on_hand_from_txn(txn) == 60

    def test_calculate_on_hand_from_txn_ship(self):
        txn = Transaction(qty=-5, action="ship", qty_before=50)
        assert _calculate_on_hand_from_txn(txn) == 45

    def test_calculate_on_hand_from_txn_adjust_positive(self):
        txn = Transaction(qty=15, action="adjust", qty_before=50)
        assert _calculate_on_hand_from_txn(txn) == 65

    def test_calculate_on_hand_from_txn_adjust_negative(self):
        txn = Transaction(qty=-20, action="adjust", qty_before=50)
        assert _calculate_on_hand_from_txn(txn) == 30

    def test_calculate_on_hand_from_txn_reserve(self):
        txn = Transaction(qty=10, action="reserve", qty_before=50) # qty here means reserved units
        assert _calculate_on_hand_from_txn(txn) == 50 # On-hand doesn't change with reserve

    def test_calculate_on_hand_from_txn_unreserve(self):
        txn = Transaction(qty=-10, action="unreserve", qty_before=50) # qty here means unreserved units
        assert _calculate_on_hand_from_txn(txn) == 50 # On-hand doesn't change with unreserve
        
    def test_calculate_on_hand_from_txn_transfer_in(self):
        txn = Transaction(qty=20, action="transfer_in", qty_before=30)
        assert _calculate_on_hand_from_txn(txn) == 50

    def test_calculate_on_hand_from_txn_transfer_out(self):
        txn = Transaction(qty=-10, action="transfer_out", qty_before=70)
        assert _calculate_on_hand_from_txn(txn) == 60


    # --- Test _calculate_total_on_hand_at_timestamp helper ---
    @pytest.mark.asyncio
    async def test_total_on_hand_at_timestamp_single_sku_single_loc(self, db_session, setup_org_sku_loc):
        org, sku, location = setup_org_sku_loc
        
        now = datetime.now(timezone.utc)
        
        # Initial state: 100 units
        await _create_transaction(db_session, org, sku, location, 100, "receive", now - timedelta(days=10), 0)
        # Add 50: 150 units
        txn2 = await _create_transaction(db_session, org, sku, location, 50, "receive", now - timedelta(days=5), 100)
        # Ship 20: 130 units
        await _create_transaction(db_session, org, sku, location, -20, "ship", now - timedelta(days=2), 150)
        
        # Check total on hand at a point between txn1 and txn2
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now - timedelta(days=6))
        assert total_on_hand == 100 # Should only see txn1's effect
        
        # Check total on hand at the time of txn2
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now - timedelta(days=5))
        assert total_on_hand == 150 # Should see txn2's effect

        # Check total on hand for the latest timestamp
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now)
        assert total_on_hand == 130

    @pytest.mark.asyncio
    async def test_total_on_hand_at_timestamp_multiple_skus_single_loc(self, db_session, setup_multiple_skus_loc):
        org, sku1, sku2, location = setup_multiple_skus_loc
        now = datetime.now(timezone.utc)

        # SKU1 transactions
        await _create_transaction(db_session, org, sku1, location, 100, "receive", now - timedelta(days=10), 0) # 100
        await _create_transaction(db_session, org, sku1, location, -20, "ship", now - timedelta(days=8), 100) # 80
        
        # SKU2 transactions
        await _create_transaction(db_session, org, sku2, location, 50, "receive", now - timedelta(days=9), 0) # 50
        await _create_transaction(db_session, org, sku2, location, 30, "receive", now - timedelta(days=7), 50) # 80

        # Total on hand at timestamp slightly after SKU1's first txn (days=9)
        # SKU1: 100, SKU2: 0 (not yet)
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now - timedelta(days=9, seconds=1))
        assert total_on_hand == 100
        
        # Total on hand at timestamp after SKU2's first txn (days=8)
        # SKU1: 80, SKU2: 50
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now - timedelta(days=8))
        assert total_on_hand == 130 # 80 (SKU1) + 50 (SKU2)

        # Total on hand at latest timestamp
        # SKU1: 80, SKU2: 80
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now)
        assert total_on_hand == 160 # 80 (SKU1) + 80 (SKU2)

    @pytest.mark.asyncio
    async def test_total_on_hand_at_timestamp_single_sku_multiple_locs(self, db_session, setup_multiple_locations):
        org, sku, loc1, loc2 = setup_multiple_locations
        now = datetime.now(timezone.utc)

        # SKU in Loc1
        await _create_transaction(db_session, org, sku, loc1, 100, "receive", now - timedelta(days=10), 0) # Loc1: 100
        await _create_transaction(db_session, org, sku, loc1, -20, "ship", now - timedelta(days=8), 100) # Loc1: 80
        
        # SKU in Loc2
        await _create_transaction(db_session, org, sku, loc2, 50, "receive", now - timedelta(days=9), 0) # Loc2: 50
        await _create_transaction(db_session, org, sku, loc2, 30, "receive", now - timedelta(days=7), 50) # Loc2: 80

        # Total on hand at timestamp after Loc2's first txn (days=8)
        # Loc1: 80, Loc2: 50
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now - timedelta(days=8))
        assert total_on_hand == 130 # 80 (Loc1) + 50 (Loc2)

        # Total on hand at latest timestamp
        # Loc1: 80, Loc2: 80
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now)
        assert total_on_hand == 160 # 80 (Loc1) + 80 (Loc2)

    @pytest.mark.asyncio
    async def test_total_on_hand_at_timestamp_filtered_by_location(self, db_session, setup_multiple_locations):
        org, sku, loc1, loc2 = setup_multiple_locations
        now = datetime.now(timezone.utc)

        # SKU in Loc1
        await _create_transaction(db_session, org, sku, loc1, 100, "receive", now - timedelta(days=10), 0)
        await _create_transaction(db_session, org, sku, loc1, -20, "ship", now - timedelta(days=2), 100) # Final: 80
        
        # SKU in Loc2
        await _create_transaction(db_session, org, sku, loc2, 50, "receive", now - timedelta(days=9), 0)
        await _create_transaction(db_session, org, sku, loc2, 30, "receive", now - timedelta(days=1), 50) # Final: 80

        # Check total on hand only for Loc1
        total_on_hand_loc1 = await _calculate_total_on_hand_at_timestamp(db_session, now, location_id=loc1.id)
        assert total_on_hand_loc1 == 80

        # Check total on hand only for Loc2
        total_on_hand_loc2 = await _calculate_total_on_hand_at_timestamp(db_session, now, location_id=loc2.id)
        assert total_on_hand_loc2 == 80
        
    @pytest.mark.asyncio
    async def test_total_on_hand_at_timestamp_no_transactions(self, db_session, setup_org_sku_loc):
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)
        
        total_on_hand = await _calculate_total_on_hand_at_timestamp(db_session, now)
        assert total_on_hand == 0


    # --- Test calculate_weekly_delta_single_sku ---
    @pytest.mark.asyncio
    @pytest.mark.parametrize("current_on_hand, expected_delta", [
        (100, 0.0),  # No transactions, no change
    ])
    async def test_single_sku_no_transactions(self, db_session, setup_org_sku_loc, current_on_hand, expected_delta):
        org, sku, location = setup_org_sku_loc
        
        delta = await calculate_weekly_delta_single_sku(db_session, current_on_hand, sku.code, location_id=location.id)
        assert delta == expected_delta

    @pytest.mark.asyncio
    @pytest.mark.parametrize("current_on_hand, qty_last_week, expected_delta", [
        (120, 100, 20.0),   # Increase
        (80, 100, -20.0),   # Decrease
        (100, 100, 0.0),    # No change
        (0, 100, -100.0),   # Went from stock to zero
        (100, 0, 0.0),      # Went from zero to stock (as per current logic)
        (0, 0, 0.0),        # Zero remains zero
        (1, 0, 0.0),        # From zero to one
    ])
    async def test_single_sku_basic_deltas(self, db_session, setup_org_sku_loc, current_on_hand, qty_last_week, expected_delta):
        org, sku, location = setup_org_sku_loc
        
        # Create a transaction exactly 7 days ago to set the "last week" value
        past_week = datetime.now(timezone.utc) - timedelta(days=7)
        await _create_transaction(db_session, org, sku, location, qty_last_week, "receive", past_week, 0)
        
        delta = await calculate_weekly_delta_single_sku(db_session, current_on_hand, sku.code, location_id=location.id)
        assert delta == expected_delta

    @pytest.mark.asyncio
    async def test_single_sku_multiple_transactions_in_week_window(self, db_session, setup_org_sku_loc):
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)

        # Transations in the 5-11 day window
        # Day 10: 100 units
        await _create_transaction(db_session, org, sku, location, 100, "receive", now - timedelta(days=10), 0)
        # Day 8: 120 units (current 100 + 20)
        await _create_transaction(db_session, org, sku, location, 20, "receive", now - timedelta(days=8), 100)
        # Day 6: 110 units (current 120 - 10)
        await _create_transaction(db_session, org, sku, location, -10, "ship", now - timedelta(days=6), 120)

        # Current on hand: 150
        # The ideal transaction should be the one closest to 7 days ago (Day 6 txn).
        # On-hand at Day 6 txn was 110.
        delta = await calculate_weekly_delta_single_sku(db_session, 150, sku.code, location_id=location.id)
        # ((150 - 110) / 110) * 100 = (40 / 110) * 100 = 36.36 -> 36.4
        assert delta == 36.4

    @pytest.mark.asyncio
    async def test_single_sku_across_multiple_locations_filtered(self, db_session, setup_multiple_locations):
        org, sku, loc1, loc2 = setup_multiple_locations
        now = datetime.now(timezone.utc)

        # Loc1: 100 units 7 days ago, now 150
        await _create_transaction(db_session, org, sku, loc1, 100, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc1, 50, "receive", now - timedelta(days=1), 100)
        
        # Loc2: 200 units 7 days ago, now 180
        await _create_transaction(db_session, org, sku, loc2, 200, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc2, -20, "ship", now - timedelta(days=1), 200)

        # Test delta for loc1 only. Current on hand for loc1 is 150. Last week was 100.
        delta_loc1 = await calculate_weekly_delta_single_sku(db_session, 150, sku.code, location_id=loc1.id)
        assert delta_loc1 == 50.0 # ((150 - 100) / 100) * 100

        # Test delta for loc2 only. Current on hand for loc2 is 180. Last week was 200.
        delta_loc2 = await calculate_weekly_delta_single_sku(db_session, 180, sku.code, location_id=loc2.id)
        assert delta_loc2 == -10.0 # ((180 - 200) / 200) * 100

    @pytest.mark.asyncio
    async def test_single_sku_across_multiple_locations_all_locs(self, db_session, setup_multiple_locations):
        org, sku, loc1, loc2 = setup_multiple_locations
        now = datetime.now(timezone.utc)

        # Loc1: 100 units 7 days ago, now 150
        await _create_transaction(db_session, org, sku, loc1, 100, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc1, 50, "receive", now - timedelta(days=1), 100)
        
        # Loc2: 200 units 7 days ago, now 180
        await _create_transaction(db_session, org, sku, loc2, 200, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc2, -20, "ship", now - timedelta(days=1), 200)

        # Total current on hand: 150 (loc1) + 180 (loc2) = 330
        # Total last week on hand: 100 (loc1) + 200 (loc2) = 300
        delta_all_locs = await calculate_weekly_delta_single_sku(db_session, 330, sku.code, location_id=None)
        assert delta_all_locs == 10.0 # ((330 - 300) / 300) * 100

    @pytest.mark.asyncio
    async def test_single_sku_reserve_unreserve_actions(self, db_session, setup_org_sku_loc):
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)

        # Last week: 100 units (receive)
        await _create_transaction(db_session, org, sku, location, 100, "receive", now - timedelta(days=7), 0)
        # Then reserve 20 units (on-hand still 100, qty_before=100)
        await _create_transaction(db_session, org, sku, location, 20, "reserve", now - timedelta(days=6), 100)
        # Current: 100 units, then unreserve 10 (on-hand still 100, qty_before=100)
        await _create_transaction(db_session, org, sku, location, -10, "unreserve", now - timedelta(days=1), 100)
        
        # current_on_hand: 100
        # last_week_on_hand (from txn 7 days ago, or 6 days ago if reserve/unreserve is considered): 100
        # The ideal transaction should be the 'receive' one 7 days ago (on-hand 100).
        delta = await calculate_weekly_delta_single_sku(db_session, 100, sku.code, location_id=location.id)
        assert delta == 0.0


    # --- Test calculate_weekly_delta_all_skus ---
    @pytest.mark.asyncio
    @pytest.mark.parametrize("current_on_hand, expected_delta", [
        (100, 0.0), # No transactions, no change
    ])
    async def test_all_skus_no_transactions(self, db_session, setup_org_sku_loc, current_on_hand, expected_delta):
        org, sku, location = setup_org_sku_loc # Use a single SKU setup but test all_skus
        
        delta = await calculate_weekly_delta_all_skus(db_session, current_on_hand, location_id=location.id)
        assert delta == expected_delta

    @pytest.mark.asyncio
    @pytest.mark.parametrize("current_on_hand_total, qty_last_week_total, expected_delta", [
        (220, 200, 10.0),   # Increase
        (180, 200, -10.0),   # Decrease
        (200, 200, 0.0),    # No change
        (0, 200, -100.0),   # Went from stock to zero
        (200, 0, 0.0),      # Went from zero to stock
        (0, 0, 0.0),        # Zero remains zero
        (1, 0, 0.0),        # From zero to one
    ])
    async def test_all_skus_basic_deltas(self, db_session, setup_multiple_skus_loc, current_on_hand_total, qty_last_week_total, expected_delta):
        org, sku1, sku2, location = setup_multiple_skus_loc
        
        # Distribute qty_last_week_total between two SKUs
        qty1_lw = qty_last_week_total // 2
        qty2_lw = qty_last_week_total - qty1_lw
        
        past_week = datetime.now(timezone.utc) - timedelta(days=7)
        await _create_transaction(db_session, org, sku1, location, qty1_lw, "receive", past_week - timedelta(hours=1), 0)
        await _create_transaction(db_session, org, sku2, location, qty2_lw, "receive", past_week, 0) # More recent

        delta = await calculate_weekly_delta_all_skus(db_session, current_on_hand_total, location_id=location.id)
        assert delta == expected_delta

    @pytest.mark.asyncio
    async def test_all_skus_multiple_transactions_in_week_window(self, db_session, setup_multiple_skus_loc):
        org, sku1, sku2, location = setup_multiple_skus_loc
        now = datetime.now(timezone.utc)

        # SKU1 transactions in the 5-11 day window
        # Day 10: 100 units
        await _create_transaction(db_session, org, sku1, location, 100, "receive", now - timedelta(days=10), 0)
        # Day 6: 120 units
        await _create_transaction(db_session, org, sku1, location, 20, "receive", now - timedelta(days=6), 100)

        # SKU2 transactions in the 5-11 day window
        # Day 9: 50 units
        await _create_transaction(db_session, org, sku2, location, 50, "receive", now - timedelta(days=9), 0)
        # Day 7: 60 units
        await _create_transaction(db_session, org, sku2, location, 10, "receive", now - timedelta(days=7), 50)
        
        # Current total on hand for these SKUs (beyond the service call)
        current_total_on_hand = 120 + 60 # From latest in window + any later txns
        
        # Expected last_week_on_hand:
        # Ideal transaction found at Day 6 (for SKU1) or Day 7 (for SKU2).
        # The query tries to find the most representative transaction around 7 days ago.
        # It takes the one closest to (today - 7 days).
        # Let's say it finds the Day 7 txn for SKU2 (on-hand 60).
        # Then _calculate_total_on_hand_at_timestamp will look for all SKUs' latest txns <= that timestamp.
        # SKU1 at Day 7: latest is 100 (from Day 10).
        # SKU2 at Day 7: latest is 60 (from Day 7).
        # So last_week_on_hand should be 100 + 60 = 160.

        delta = await calculate_weekly_delta_all_skus(db_session, current_total_on_hand, location_id=location.id)
        # Current total: 120 (SKU1 latest in window) + 60 (SKU2 latest in window) = 180
        # If no further transactions occurred after the "ideal" last week timestamp, then current_total_on_hand could be 180.
        # Let's adjust current_total_on_hand to reflect the current value of SKU1 (120) and SKU2 (60)
        
        # Let's make one more transaction for SKU1 to simulate a recent value
        await _create_transaction(db_session, org, sku1, location, 30, "receive", now - timedelta(days=1), 120) # SKU1 now 150
        current_total_on_hand = 150 + 60 # SKU1 final (150) + SKU2 final (60) = 210

        delta = await calculate_weekly_delta_all_skus(db_session, current_total_on_hand, location_id=location.id)
        # last_week_on_hand (based on ideal_txn around 7 days ago): 160 (100 from SKU1 at day 10, 60 from SKU2 at day 7)
        # ((210 - 160) / 160) * 100 = (50 / 160) * 100 = 31.25 -> 31.3
        assert delta == 31.2

    @pytest.mark.asyncio
    async def test_all_skus_across_multiple_locations_filtered(self, db_session, setup_multiple_locations):
        org, sku, loc1, loc2 = setup_multiple_locations
        now = datetime.now(timezone.utc)

        # SKU in Loc1: 100 units 7 days ago, now 150
        await _create_transaction(db_session, org, sku, loc1, 100, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc1, 50, "receive", now - timedelta(days=1), 100)
        
        # SKU in Loc2: 200 units 7 days ago, now 180
        await _create_transaction(db_session, org, sku, loc2, 200, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc2, -20, "ship", now - timedelta(days=1), 200)

        # Test delta for loc1 only. Current on hand for loc1 is 150. Last week was 100.
        delta_loc1 = await calculate_weekly_delta_all_skus(db_session, 150, location_id=loc1.id)
        assert delta_loc1 == 50.0 # ((150 - 100) / 100) * 100

        # Test delta for loc2 only. Current on hand for loc2 is 180. Last week was 200.
        delta_loc2 = await calculate_weekly_delta_all_skus(db_session, 180, location_id=loc2.id)
        assert delta_loc2 == -10.0 # ((180 - 200) / 200) * 100

    @pytest.mark.asyncio
    async def test_all_skus_across_multiple_locations_all_locs(self, db_session, setup_multiple_locations):
        org, sku, loc1, loc2 = setup_multiple_locations
        now = datetime.now(timezone.utc)

        # SKU in Loc1: 100 units 7 days ago, now 150
        await _create_transaction(db_session, org, sku, loc1, 100, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc1, 50, "receive", now - timedelta(days=1), 100)
        
        # SKU in Loc2: 200 units 7 days ago, now 180
        await _create_transaction(db_session, org, sku, loc2, 200, "receive", now - timedelta(days=7), 0)
        await _create_transaction(db_session, org, sku, loc2, -20, "ship", now - timedelta(days=1), 200)

        # Total current on hand: 150 (loc1) + 180 (loc2) = 330
        # Total last week on hand: 100 (loc1) + 200 (loc2) = 300
        delta_all_locs = await calculate_weekly_delta_all_skus(db_session, 330, location_id=None)
        assert delta_all_locs == 10.0 # ((330 - 300) / 300) * 100
        
    @pytest.mark.asyncio
    async def test_single_sku_dormant_stock_movement(self, db_session, setup_org_sku_loc):
        """
        CRITICAL FAILURE SCENARIO:
        Last activity was 20 days ago (Qty 100).
        Activity yesterday changed it to 90.
        True Delta: -10%.
        Current Service Result: 0.0% (because it finds no txn in the 5-11 day window).
        """
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)

        # 1. Receive 100 units 20 days ago (Outside the 11-day window)
        await _create_transaction(db_session, org, sku, location, 100, "receive", now - timedelta(days=20), 0)
        
        # 2. Ship 10 units yesterday (Current Stock = 90)
        await _create_transaction(db_session, org, sku, location, -10, "ship", now - timedelta(days=1), 100)

        # Current on hand is 90. Last week (7 days ago), on hand was effectively 100.
        delta = await calculate_weekly_delta_single_sku(db_session, 90, sku.code, location_id=location.id)
        
        # If this asserts 0.0, your business logic is hiding inventory movement.
        assert delta == -10.0
        
    @pytest.mark.asyncio
    async def test_single_sku_brand_new_inventory(self, db_session, setup_org_sku_loc):
        """
        SKU was created 3 days ago.
        7 days ago, stock was effectively 0.
        Current stock 100.
        Mathematically this is infinite growth, but usually capped at 100% or handled specially.
        Current code returns 0.0 if no ideal txn found.
        """
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)

        # Receive 100 units 3 days ago
        await _create_transaction(db_session, org, sku, location, 100, "receive", now - timedelta(days=3), 0)

        # Current: 100. Last week: 0.
        delta = await calculate_weekly_delta_single_sku(db_session, 100, sku.code, location_id=location.id)

        # Should strictly be considered 100% (growth from 0) or a special indicator, 
        # but definitely NOT 0.0 (which implies stability).
        assert delta == 100.0
        
    @pytest.mark.asyncio
    async def test_single_sku_something_to_zero(self, db_session, setup_org_sku_loc):
        """Test SKU that had 50 stock last week and 0 today (Stockout)."""
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)
        # Had 50 units 10 days ago
        await _create_transaction(db_session, org, sku, location, 50, "receive", now - timedelta(days=10), 0)
        
        # Current stock is 0
        delta = await calculate_weekly_delta_single_sku(db_session, 0, sku.code, location.id)
        assert delta == -100.0

    @pytest.mark.asyncio
    async def test_single_sku_long_dormancy(self, db_session, setup_org_sku_loc):
        """Test SKU whose last transaction was 20 days ago."""
        org, sku, location = setup_org_sku_loc
        now = datetime.now(timezone.utc)
        # Transaction 20 days ago sets stock to 100
        await _create_transaction(db_session, org, sku, location, 100, "receive", now - timedelta(days=20), 0)
        
        # Current stock is 90 (shipped 10 yesterday, but we only pass current_on_hand)
        delta = await calculate_weekly_delta_single_sku(db_session, 90, sku.code, location.id)
        assert delta == -10.0
