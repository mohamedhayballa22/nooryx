import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import SKU, Location, Transaction, Organization, State
from app.services.movers import (
    _parse_period_to_cutoff,
    _resolve_location,
    _get_inventory_state,
    _get_top_movers,
    _get_inactive_skus,
    get_top_skus_by_criteria,
    determine_stock_status,
    get_fast_movers_with_stock_condition,
    get_inactive_skus_with_stock
)


# Helper to create transaction
async def _create_transaction(
    db: AsyncSession,
    org: Organization,
    sku: SKU,
    location: Location,
    qty: int,
    action: str,
    created_at: datetime,
    qty_before: int = 0
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
    await db.flush()
    return txn


# Helper to create state
async def _create_state(
    db: AsyncSession,
    org: Organization,
    sku: SKU,
    location: Location,
    on_hand: int = 0,
    reserved: int = 0
) -> State:
    state = State(
        org_id=org.org_id,
        sku_code=sku.code,
        location_id=location.id,
        on_hand=on_hand,
        reserved=reserved
    )
    db.add(state)
    await db.flush()
    return state


class TestParsePeriodToCutoff:
    """Tests for _parse_period_to_cutoff function."""

    def test_parse_7d(self):
        cutoff = _parse_period_to_cutoff("7d")
        expected = datetime.now(timezone.utc) - timedelta(days=7)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_30d(self):
        cutoff = _parse_period_to_cutoff("30d")
        expected = datetime.now(timezone.utc) - timedelta(days=30)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_365d(self):
        cutoff = _parse_period_to_cutoff("365d")
        expected = datetime.now(timezone.utc) - timedelta(days=365)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_1_day(self):
        cutoff = _parse_period_to_cutoff("1 day")
        expected = datetime.now(timezone.utc) - timedelta(days=1)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_14_days(self):
        cutoff = _parse_period_to_cutoff("14 days")
        expected = datetime.now(timezone.utc) - timedelta(days=14)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_uppercase(self):
        cutoff = _parse_period_to_cutoff("7D")
        expected = datetime.now(timezone.utc) - timedelta(days=7)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_with_spaces(self):
        cutoff = _parse_period_to_cutoff("  7d  ")
        expected = datetime.now(timezone.utc) - timedelta(days=7)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_invalid_defaults_to_7(self):
        cutoff = _parse_period_to_cutoff("invalid")
        expected = datetime.now(timezone.utc) - timedelta(days=7)
        assert abs((cutoff - expected).total_seconds()) < 2

    def test_parse_empty_defaults_to_7(self):
        cutoff = _parse_period_to_cutoff("")
        expected = datetime.now(timezone.utc) - timedelta(days=7)
        assert abs((cutoff - expected).total_seconds()) < 2


class TestResolveLocation:
    """Tests for _resolve_location function."""

    @pytest_asyncio.fixture
    async def setup_locations(self, db_session, create_org, create_location):
        org = await create_org(name="Test Org")
        loc1 = await create_location(org, name="Warehouse A")
        loc2 = await create_location(org, name="Warehouse B")
        return org, loc1, loc2

    @pytest.mark.asyncio
    async def test_resolve_existing_location(self, db_session, create_org, create_location):
        org = await create_org()
        loc = await create_location(org, name="Main")
        
        location_id, single_name = await _resolve_location(org.org_id, db_session, "Main")
        
        assert str(location_id) == str(loc.id)
        assert single_name is None

    @pytest.mark.asyncio
    async def test_resolve_nonexistent_location(self, db_session, create_org, create_location):
        org = await create_org()
        await create_location(org, name="Main")
        
        location_id, single_name = await _resolve_location(org.org_id, db_session, "Nonexistent")
        
        assert location_id is None
        assert single_name is None

    @pytest.mark.asyncio
    async def test_resolve_none_with_single_location(self, db_session, create_org, create_location):
        org = await create_org()
        loc = await create_location(org, name="Only Location")
        
        location_id, single_name = await _resolve_location(org.org_id, db_session, None)
        
        assert location_id is None
        assert single_name == "Only Location"

    @pytest.mark.asyncio
    async def test_resolve_none_with_multiple_locations(self, db_session, setup_locations):
        org, loc1, loc2 = setup_locations
        
        location_id, single_name = await _resolve_location(org.org_id, db_session, None)
        
        assert location_id is None
        assert single_name is None

    @pytest.mark.asyncio
    async def test_resolve_none_with_no_locations(self, db_session, create_org):
        org = await create_org()
        location_id, single_name = await _resolve_location(org.org_id, db_session, None)

        assert location_id is None
        assert single_name is None


class TestGetInventoryState:
    """Tests for _get_inventory_state function."""

    @pytest_asyncio.fixture
    async def setup_inventory(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="SKU-001", name="Product A")
        sku2 = await create_sku(org, code="SKU-002", name="Product B")
        loc1 = await create_location(org, name="Loc1")
        loc2 = await create_location(org, name="Loc2")
        
        # Create states
        await _create_state(db_session, org, sku1, loc1, on_hand=100, reserved=10)
        await _create_state(db_session, org, sku1, loc2, on_hand=50, reserved=5)
        await _create_state(db_session, org, sku2, loc1, on_hand=200, reserved=20)
        
        return org, sku1, sku2, loc1, loc2

    @pytest.mark.asyncio
    async def test_get_state_specific_location(self, db_session, setup_inventory):
        org, sku1, sku2, loc1, loc2 = setup_inventory
        
        state_map = await _get_inventory_state(org.org_id, db_session, str(loc1.id))
        
        assert len(state_map) == 2
        assert state_map["SKU-001"]["sku_name"] == "Product A"
        assert state_map["SKU-001"]["available"] == 90  # 100 - 10
        assert state_map["SKU-002"]["available"] == 180  # 200 - 20

    @pytest.mark.asyncio
    async def test_get_state_all_locations_aggregated(self, db_session, setup_inventory):
        org, sku1, sku2, loc1, loc2 = setup_inventory
        
        state_map = await _get_inventory_state(org.org_id, db_session, None)
        
        assert len(state_map) == 2
        # SKU-001: (100-10) + (50-5) = 135
        assert state_map["SKU-001"]["available"] == 135
        # SKU-002: (200-20) = 180
        assert state_map["SKU-002"]["available"] == 180

    @pytest.mark.asyncio
    async def test_get_state_filtered_by_sku_codes(self, db_session, setup_inventory):
        org, sku1, sku2, loc1, loc2 = setup_inventory
        
        state_map = await _get_inventory_state(org.org_id, db_session, str(loc1.id), sku_codes=["SKU-001"])
        
        assert len(state_map) == 1
        assert "SKU-001" in state_map
        assert "SKU-002" not in state_map

    @pytest.mark.asyncio
    async def test_get_state_empty_when_no_states(self, db_session, create_org, create_location):
        org = await create_org()
        loc = await create_location(org, name="Empty")
        
        state_map = await _get_inventory_state(org.org_id, db_session, str(loc.id))
        
        assert len(state_map) == 0

    @pytest.mark.asyncio
    async def test_get_state_includes_thresholds(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="SKU-THRESH", name="Test")
        sku.low_stock_threshold = 25
        await db_session.flush()
        
        loc = await create_location(org, name="Loc")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        state_map = await _get_inventory_state(org.org_id, db_session, str(loc.id))
        
        assert state_map["SKU-THRESH"]["low_stock_threshold"] == 25


class TestGetTopMovers:
    """Tests for _get_top_movers function."""

    @pytest_asyncio.fixture
    async def setup_movers_data(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="MOVER-A", name="Fast Mover A")
        sku2 = await create_sku(org, code="MOVER-B", name="Fast Mover B")
        sku3 = await create_sku(org, code="MOVER-C", name="Slow Mover C")
        loc = await create_location(org, name="Main")
        
        # Create states
        await _create_state(db_session, org, sku1, loc, on_hand=50)
        await _create_state(db_session, org, sku2, loc, on_hand=30)
        await _create_state(db_session, org, sku3, loc, on_hand=100)
        
        now = datetime.now(timezone.utc)
        
        # MOVER-A: 100 units shipped in last 7 days
        await _create_transaction(db_session, org, sku1, loc, -50, "ship", now - timedelta(days=2), 100)
        await _create_transaction(db_session, org, sku1, loc, -50, "ship", now - timedelta(days=5), 150)
        
        # MOVER-B: 75 units shipped in last 7 days
        await _create_transaction(db_session, org, sku2, loc, -75, "ship", now - timedelta(days=3), 105)
        
        # MOVER-C: 20 units shipped in last 7 days
        await _create_transaction(db_session, org, sku3, loc, -20, "ship", now - timedelta(days=6), 120)
        
        # Old transaction (outside window) - should not count
        await _create_transaction(db_session, org, sku3, loc, -200, "ship", now - timedelta(days=15), 320)
        
        return org, sku1, sku2, sku3, loc

    @pytest.mark.asyncio
    async def test_get_top_movers_basic(self, db_session, setup_movers_data):
        org, sku1, sku2, sku3, loc = setup_movers_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_top_movers(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        assert len(result) == 3
        assert result[0]["sku_code"] == "MOVER-A"  # 100 units
        assert result[1]["sku_code"] == "MOVER-B"  # 75 units
        assert result[2]["sku_code"] == "MOVER-C"  # 20 units

    @pytest.mark.asyncio
    async def test_get_top_movers_with_limit(self, db_session, setup_movers_data):
        org, sku1, sku2, sku3, loc = setup_movers_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_top_movers(org.org_id, db_session, str(loc.id), cutoff, limit=2)
        
        assert len(result) == 2
        assert result[0]["sku_code"] == "MOVER-A"
        assert result[1]["sku_code"] == "MOVER-B"

    @pytest.mark.asyncio
    async def test_get_top_movers_no_location_filter(self, db_session, setup_movers_data):
        org, sku1, sku2, sku3, loc = setup_movers_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_top_movers(org.org_id, db_session, None, cutoff, limit=5)
        
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_get_top_movers_empty_when_no_outbound(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="NO-MOVE", name="No Movement")
        loc = await create_location(org, name="Loc")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        result = await _get_top_movers(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_top_movers_includes_state_data(self, db_session, setup_movers_data):
        org, sku1, sku2, sku3, loc = setup_movers_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_top_movers(org.org_id, db_session, str(loc.id), cutoff, limit=1)
        
        assert result[0]["sku_name"] == "Fast Mover A"
        assert result[0]["available"] == 50
        assert "low_stock_threshold" in result[0]

    @pytest.mark.asyncio
    async def test_get_top_movers_only_outbound_counted(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="MIX", name="Mixed")
        loc = await create_location(org, name="Loc")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        now = datetime.now(timezone.utc)
        # Inbound should not count
        await _create_transaction(db_session, org, sku, loc, 100, "receive", now - timedelta(days=2), 0)
        # Only outbound counts
        await _create_transaction(db_session, org, sku, loc, -50, "ship", now - timedelta(days=3), 100)
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        result = await _get_top_movers(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        assert len(result) == 1
        # Movement should be 50, not 150


class TestGetInactiveSkus:
    """Tests for _get_inactive_skus function."""

    @pytest_asyncio.fixture
    async def setup_inactive_data(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="INACTIVE-A", name="Inactive A")
        sku2 = await create_sku(org, code="INACTIVE-B", name="Inactive B")
        sku3 = await create_sku(org, code="ACTIVE-C", name="Active C")
        sku4 = await create_sku(org, code="NEVER-SOLD", name="Never Sold")
        loc = await create_location(org, name="Warehouse")
        
        # Create states
        await _create_state(db_session, org, sku1, loc, on_hand=50)
        await _create_state(db_session, org, sku2, loc, on_hand=30)
        await _create_state(db_session, org, sku3, loc, on_hand=100)
        await _create_state(db_session, org, sku4, loc, on_hand=25)
        
        now = datetime.now(timezone.utc)
        
        # INACTIVE-A: Last sold 15 days ago
        await _create_transaction(db_session, org, sku1, loc, -10, "ship", now - timedelta(days=15), 60)
        
        # INACTIVE-B: Last sold 10 days ago
        await _create_transaction(db_session, org, sku2, loc, -20, "ship", now - timedelta(days=10), 50)
        
        # ACTIVE-C: Sold 3 days ago (active)
        await _create_transaction(db_session, org, sku3, loc, -50, "ship", now - timedelta(days=3), 150)
        
        # NEVER-SOLD: No outbound transactions
        
        return org, sku1, sku2, sku3, sku4, loc

    @pytest.mark.asyncio
    async def test_get_inactive_skus_7_days(self, db_session, setup_inactive_data):
        org, sku1, sku2, sku3, sku4, loc = setup_inactive_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_inactive_skus(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        # Should include INACTIVE-A (15 days), INACTIVE-B (10 days), NEVER-SOLD
        # Should NOT include ACTIVE-C (3 days)
        sku_codes = [item["sku_code"] for item in result]
        assert "INACTIVE-A" in sku_codes
        assert "INACTIVE-B" in sku_codes
        assert "NEVER-SOLD" in sku_codes
        assert "ACTIVE-C" not in sku_codes

    @pytest.mark.asyncio
    async def test_get_inactive_skus_ordered_by_age(self, db_session, setup_inactive_data):
        org, sku1, sku2, sku3, sku4, loc = setup_inactive_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_inactive_skus(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        # Should be ordered oldest first: INACTIVE-A (15 days), INACTIVE-B (10 days), then NEVER-SOLD
        assert result[0]["sku_code"] == "INACTIVE-A"
        assert result[1]["sku_code"] == "INACTIVE-B"

    @pytest.mark.asyncio
    async def test_get_inactive_skus_with_limit(self, db_session, setup_inactive_data):
        org, sku1, sku2, sku3, sku4, loc = setup_inactive_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_inactive_skus(org.org_id, db_session, str(loc.id), cutoff, limit=2)
        
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_inactive_skus_no_location_filter(self, db_session, setup_inactive_data):
        org, sku1, sku2, sku3, sku4, loc = setup_inactive_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_inactive_skus(org.org_id, db_session, None, cutoff, limit=5)
        
        assert len(result) >= 3

    @pytest.mark.asyncio
    async def test_get_inactive_skus_never_sold_last(self, db_session, setup_inactive_data):
        org, sku1, sku2, sku3, sku4, loc = setup_inactive_data
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await _get_inactive_skus(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        # Never sold SKUs should be at the end
        assert result[-1]["sku_code"] == "NEVER-SOLD"
        assert result[-1]["last_activity"] is None


class TestGetTopSkusByCriteria:
    """Tests for get_top_skus_by_criteria function (main entry point)."""

    @pytest_asyncio.fixture
    async def setup_full_scenario(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="PROD-A", name="Product A")
        sku2 = await create_sku(org, code="PROD-B", name="Product B")
        sku3 = await create_sku(org, code="PROD-C", name="Product C")
        loc1 = await create_location(org, name="Location 1")
        
        await _create_state(db_session, org, sku1, loc1, on_hand=100, reserved=10)
        await _create_state(db_session, org, sku2, loc1, on_hand=50, reserved=5)
        await _create_state(db_session, org, sku3, loc1, on_hand=75, reserved=0)
        
        now = datetime.now(timezone.utc)
        
        # PROD-A: 80 units shipped
        await _create_transaction(db_session, org, sku1, loc1, -80, "ship", now - timedelta(days=3), 170)
        
        # PROD-B: Last sold 10 days ago
        await _create_transaction(db_session, org, sku2, loc1, -30, "ship", now - timedelta(days=10), 80)
        
        # PROD-C: 50 units shipped
        await _create_transaction(db_session, org, sku3, loc1, -50, "ship", now - timedelta(days=5), 125)
        
        return org, sku1, sku2, sku3, loc1

    @pytest.mark.asyncio
    async def test_top_movers_basic(self, db_session, setup_full_scenario):
        org, sku1, sku2, sku3, loc1 = setup_full_scenario
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location="Location 1", period="7d", inactives=False, limit=5)
        
        assert result["location"] == "Location 1"
        assert len(result["skus"]) == 2  # Only PROD-A and PROD-C (within 7 days)
        assert result["skus"][0]["sku_code"] == "PROD-A"  # 80 units
        assert result["skus"][1]["sku_code"] == "PROD-C"  # 50 units

    @pytest.mark.asyncio
    async def test_top_inactives_basic(self, db_session, setup_full_scenario):
        org, sku1, sku2, sku3, loc1 = setup_full_scenario
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location="Location 1", period="7d", inactives=True, limit=5)
        
        assert result["location"] == "Location 1"
        # PROD-B is inactive (10 days ago)
        sku_codes = [item["sku_code"] for item in result["skus"]]
        assert "PROD-B" in sku_codes

    @pytest.mark.asyncio
    async def test_auto_assign_location_single_location(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="AUTO", name="Auto Assign")
        loc = await create_location(org, name="Only Location")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        now = datetime.now(timezone.utc)
        await _create_transaction(db_session, org, sku, loc, -20, "ship", now - timedelta(days=2), 120)
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location=None, period="7d", inactives=False, limit=5)
        
        # Should auto-assign to "Only Location"
        assert result["location"] == "Only Location"

    @pytest.mark.asyncio
    async def test_no_auto_assign_multiple_locations(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="MULTI", name="Multi Loc")
        loc1 = await create_location(org, name="Loc1")
        loc2 = await create_location(org, name="Loc2")
        await _create_state(db_session, org, sku, loc1, on_hand=100)
        await _create_state(db_session, org, sku, loc2, on_hand=50)
        
        now = datetime.now(timezone.utc)
        await _create_transaction(db_session, org, sku, loc1, -20, "ship", now - timedelta(days=2), 120)
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location=None, period="7d", inactives=False, limit=5)
        
        # Should NOT auto-assign
        assert result["location"] is None

    @pytest.mark.asyncio
    async def test_period_parsing_30d(self, db_session, setup_full_scenario):
        org, sku1, sku2, sku3, loc1 = setup_full_scenario
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location="Location 1", period="30d", inactives=False, limit=5)
        
        # With 30 day window, all should be included
        assert len(result["skus"]) == 3

    @pytest.mark.asyncio
    async def test_empty_result_no_activity(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="DORMANT", name="Dormant")
        loc = await create_location(org, name="Loc")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location="Loc", period="7d", inactives=False, limit=5)
        
        assert len(result["skus"]) == 0


class TestDetermineStockStatus:
    """Tests for determine_stock_status function."""

    def test_out_of_stock(self):
        assert determine_stock_status(0, 10) == "Out of Stock"

    def test_low_stock(self):
        assert determine_stock_status(5, 10) == "Low Stock"
        assert determine_stock_status(9, 10) == "Low Stock"

    def test_in_stock(self):
        assert determine_stock_status(10, 10) == "In Stock"
        assert determine_stock_status(50, 10) == "In Stock"

    def test_low_stock_edge_case(self):
        assert determine_stock_status(1, 10) == "Low Stock"

    def test_in_stock_at_threshold(self):
        # At threshold, it's "In Stock" (not low)
        assert determine_stock_status(10, 10) == "In Stock"

    def test_different_thresholds(self):
        assert determine_stock_status(20, 25) == "Low Stock"
        assert determine_stock_status(30, 25) == "In Stock"


class TestGetFastMoversWithStockCondition:
    """Tests for get_fast_movers_with_stock_condition function."""

    @pytest_asyncio.fixture
    async def setup_fast_movers(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="FAST-HIGH", name="Fast High Stock")
        sku1.low_stock_threshold = 50
        sku2 = await create_sku(org, code="FAST-LOW", name="Fast Low Stock")
        sku2.low_stock_threshold = 30
        sku3 = await create_sku(org, code="FAST-OUT", name="Fast Out of Stock")
        sku3.low_stock_threshold = 20
        sku4 = await create_sku(org, code="SLOW-LOW", name="Slow Low Stock")
        sku4.low_stock_threshold = 25
        await db_session.flush()
        
        loc = await create_location(org, name="Main")
        
        # States
        await _create_state(db_session, org, sku1, loc, on_hand=100, reserved=0)  # available=100 (high stock)
        await _create_state(db_session, org, sku2, loc, on_hand=20, reserved=0)   # available=20 (low stock, < 30)
        await _create_state(db_session, org, sku3, loc, on_hand=0, reserved=0)    # available=0 (out of stock)
        await _create_state(db_session, org, sku4, loc, on_hand=15, reserved=0)   # available=15 (low stock, < 25)
        
        now = datetime.now(timezone.utc)
        
        # Create outbound movements
        await _create_transaction(db_session, org, sku1, loc, -100, "ship", now - timedelta(days=2), 200)  # High movement
        await _create_transaction(db_session, org, sku2, loc, -80, "ship", now - timedelta(days=3), 100)   # High movement
        await _create_transaction(db_session, org, sku3, loc, -75, "ship", now - timedelta(days=1), 75)    # High movement
        await _create_transaction(db_session, org, sku4, loc, -10, "ship", now - timedelta(days=4), 25)    # Low movement
        
        return org, sku1, sku2, sku3, sku4, loc

    @pytest.mark.asyncio
    async def test_fast_movers_with_low_stock(self, db_session, setup_fast_movers):
        org, sku1, sku2, sku3, sku4, loc = setup_fast_movers
        
        result = await get_fast_movers_with_stock_condition(org.org_id, 
            db_session, available_min=1, available_max=None, limit=5, check_low_stock=True
        )
        
        # Should return SKUs with available >= 1 AND available < their threshold, ordered by movement
        # FAST-LOW (20 < 30, movement=80) and SLOW-LOW (15 < 25, movement=10)
        assert result is not None
        assert "FAST-LOW" in result
        assert "SLOW-LOW" in result
        assert "FAST-HIGH" not in result  # Not low stock
        assert "FAST-OUT" not in result   # available=0

    @pytest.mark.asyncio
    async def test_fast_movers_out_of_stock(self, db_session, setup_fast_movers):
        org, sku1, sku2, sku3, sku4, loc = setup_fast_movers
        
        result = await get_fast_movers_with_stock_condition(org.org_id, 
            db_session, available_min=0, available_max=0, limit=5, check_low_stock=False
        )
        
        # Should return only FAST-OUT (available=0)
        assert result is not None
        assert result == ["FAST-OUT"]

    @pytest.mark.asyncio
    async def test_fast_movers_fixed_range(self, db_session, setup_fast_movers):
        org, sku1, sku2, sku3, sku4, loc = setup_fast_movers
        
        result = await get_fast_movers_with_stock_condition(org.org_id, 
            db_session, available_min=10, available_max=50, limit=5, check_low_stock=False
        )
        
        # Should return SKUs with 10 <= available <= 50
        # FAST-LOW (20) and SLOW-LOW (15)
        assert result is not None
        assert "FAST-LOW" in result
        assert "SLOW-LOW" in result
        assert "FAST-HIGH" not in result  # available=100
        assert "FAST-OUT" not in result   # available=0

    @pytest.mark.asyncio
    async def test_fast_movers_returns_none_when_empty(self, db_session, create_org):
        org = await create_org()
        
        result = await get_fast_movers_with_stock_condition(org.org_id, 
            db_session, available_min=1, available_max=None, limit=5, check_low_stock=True
        )
        
        assert result is None

    @pytest.mark.asyncio
    async def test_fast_movers_aggregates_across_locations(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="MULTI-LOC", name="Multi Location")
        sku.low_stock_threshold = 100
        await db_session.flush()
        
        loc1 = await create_location(org, name="Loc1")
        loc2 = await create_location(org, name="Loc2")
        
        # Total available: 30 + 40 = 70 (< threshold of 100)
        await _create_state(db_session, org, sku, loc1, on_hand=30, reserved=0)
        await _create_state(db_session, org, sku, loc2, on_hand=40, reserved=0)
        
        now = datetime.now(timezone.utc)
        await _create_transaction(db_session, org, sku, loc1, -50, "ship", now - timedelta(days=1), 80)
        await _create_transaction(db_session, org, sku, loc2, -30, "ship", now - timedelta(days=2), 70)
        
        result = await get_fast_movers_with_stock_condition(org.org_id, 
            db_session, available_min=1, available_max=None, limit=5, check_low_stock=True
        )
        
        # Should include MULTI-LOC (total=70 < 100)
        assert result is not None
        assert "MULTI-LOC" in result


class TestGetInactiveSkusWithStock:
    """Tests for get_inactive_skus_with_stock function."""

    @pytest_asyncio.fixture
    async def setup_inactive_stock(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="INACTIVE-STOCK-A", name="Inactive with Stock")
        sku2 = await create_sku(org, code="ACTIVE-STOCK", name="Active with Stock")
        sku3 = await create_sku(org, code="INACTIVE-NO-STOCK", name="Inactive No Stock")
        loc = await create_location(org, name="Warehouse")
        
        # States
        await _create_state(db_session, org, sku1, loc, on_hand=50, reserved=0)
        await _create_state(db_session, org, sku2, loc, on_hand=100, reserved=0)
        await _create_state(db_session, org, sku3, loc, on_hand=0, reserved=0)
        
        now = datetime.now(timezone.utc)
        
        # INACTIVE-STOCK-A: Last transaction 15 days ago
        await _create_transaction(db_session, org, sku1, loc, -10, "ship", now - timedelta(days=15), 60)
        
        # ACTIVE-STOCK: Transaction 5 days ago (active)
        await _create_transaction(db_session, org, sku2, loc, -20, "ship", now - timedelta(days=5), 120)
        
        # INACTIVE-NO-STOCK: Last transaction 20 days ago
        await _create_transaction(db_session, org, sku3, loc, -10, "ship", now - timedelta(days=20), 10)
        
        return org, sku1, sku2, sku3, loc

    @pytest.mark.asyncio
    async def test_inactive_skus_with_stock_basic(self, db_session, setup_inactive_stock):
        org, sku1, sku2, sku3, loc = setup_inactive_stock
        
        result = await get_inactive_skus_with_stock(org.org_id, db_session, days=10, limit=5)
        
        # Should return INACTIVE-STOCK-A (no activity in 10+ days, has stock)
        # Should NOT return ACTIVE-STOCK (has recent activity)
        # Should NOT return INACTIVE-NO-STOCK (no stock)
        assert result is not None
        assert "INACTIVE-STOCK-A" in result
        assert "ACTIVE-STOCK" not in result
        assert "INACTIVE-NO-STOCK" not in result

    @pytest.mark.asyncio
    async def test_inactive_skus_ordered_by_stock_desc(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="INACTIVE-1", name="Inactive 1")
        sku2 = await create_sku(org, code="INACTIVE-2", name="Inactive 2")
        loc = await create_location(org, name="Loc")
        
        await _create_state(db_session, org, sku1, loc, on_hand=30, reserved=0)
        await _create_state(db_session, org, sku2, loc, on_hand=100, reserved=0)
        
        now = datetime.now(timezone.utc)
        # Both inactive for 15 days
        await _create_transaction(db_session, org, sku1, loc, -5, "ship", now - timedelta(days=15), 35)
        await _create_transaction(db_session, org, sku2, loc, -10, "ship", now - timedelta(days=15), 110)
        
        result = await get_inactive_skus_with_stock(org.org_id, db_session, days=10, limit=5)
        
        # Should be ordered by on_hand desc
        assert result[0] == "INACTIVE-2"  # 100 on hand
        assert result[1] == "INACTIVE-1"  # 30 on hand

    @pytest.mark.asyncio
    async def test_inactive_skus_with_limit(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku1 = await create_sku(org, code="INA-1", name="Inactive 1")
        sku2 = await create_sku(org, code="INA-2", name="Inactive 2")
        sku3 = await create_sku(org, code="INA-3", name="Inactive 3")
        loc = await create_location(org, name="Loc")
        
        await _create_state(db_session, org, sku1, loc, on_hand=100, reserved=0)
        await _create_state(db_session, org, sku2, loc, on_hand=80, reserved=0)
        await _create_state(db_session, org, sku3, loc, on_hand=60, reserved=0)
        
        result = await get_inactive_skus_with_stock(org.org_id, db_session, days=10, limit=2)
        
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_inactive_skus_returns_none_when_empty(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="ACTIVE", name="Active")
        loc = await create_location(org, name="Loc")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        now = datetime.now(timezone.utc)
        # Recent activity
        await _create_transaction(db_session, org, sku, loc, -10, "ship", now - timedelta(days=2), 110)
        
        result = await get_inactive_skus_with_stock(org.org_id, db_session, days=10, limit=5)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_inactive_skus_aggregates_across_locations(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="MULTI", name="Multi")
        loc1 = await create_location(org, name="Loc1")
        loc2 = await create_location(org, name="Loc2")
        
        await _create_state(db_session, org, sku, loc1, on_hand=30, reserved=0)
        await _create_state(db_session, org, sku, loc2, on_hand=40, reserved=0)
        
        # No recent activity (inactive)
        
        result = await get_inactive_skus_with_stock(org.org_id, db_session, days=10, limit=5)
        
        # Should aggregate on_hand across locations: 30 + 40 = 70
        assert result is not None
        assert "MULTI" in result


class TestEdgeCasesAndBoundaries:
    """Additional edge cases and boundary conditions."""

    @pytest.mark.asyncio
    async def test_zero_limit(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="TEST", name="Test")
        loc = await create_location(org, name="Loc")
        await _create_state(db_session, org, sku, loc, on_hand=100)
        
        now = datetime.now(timezone.utc)
        await _create_transaction(db_session, org, sku, loc, -10, "ship", now - timedelta(days=1), 110)
        
        result = await get_top_skus_by_criteria(org.org_id, db_session, location="Loc", period="7d", inactives=False, limit=0)
        
        assert len(result["skus"]) == 0

    @pytest.mark.asyncio
    async def test_reserved_affects_available(self, db_session, create_org, create_sku, create_location):
        org = await create_org()
        sku = await create_sku(org, code="RESERVED", name="Has Reservation")
        loc = await create_location(org, name="Loc")
        
        # on_hand=100, reserved=30, so available=70
        await _create_state(db_session, org, sku, loc, on_hand=100, reserved=30)
        
        state_map = await _get_inventory_state(org.org_id, db_session, str(loc.id))
        
        assert state_map["RESERVED"]["available"] == 70

    @pytest.mark.asyncio
    async def test_multiple_skus_same_movement_different_order(self, db_session, create_org, create_sku, create_location):
        """Test deterministic ordering when multiple SKUs have same movement volume."""
        org = await create_org()
        sku1 = await create_sku(org, code="SKU-A", name="SKU A")
        sku2 = await create_sku(org, code="SKU-B", name="SKU B")
        loc = await create_location(org, name="Loc")
        
        await _create_state(db_session, org, sku1, loc, on_hand=50)
        await _create_state(db_session, org, sku2, loc, on_hand=50)
        
        now = datetime.now(timezone.utc)
        # Both have same outbound volume
        await _create_transaction(db_session, org, sku1, loc, -50, "ship", now - timedelta(days=2), 100)
        await _create_transaction(db_session, org, sku2, loc, -50, "ship", now - timedelta(days=3), 100)
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        result = await _get_top_movers(org.org_id, db_session, str(loc.id), cutoff, limit=5)
        
        # Should return both, order may vary but both should be present
        assert len(result) == 2
        sku_codes = {item["sku_code"] for item in result}
        assert sku_codes == {"SKU-A", "SKU-B"}

    @pytest.mark.asyncio
    async def test_transfer_actions_counted_correctly(self, db_session, create_org, create_sku, create_location):
        """Test that transfer_out is counted as outbound."""
        org = await create_org()
        sku = await create_sku(org, code="TRANSFER", name="Transfer Test")
        loc1 = await create_location(org, name="Source")
        loc2 = await create_location(org, name="Dest")
        
        await _create_state(db_session, org, sku, loc1, on_hand=50)
        await _create_state(db_session, org, sku, loc2, on_hand=50)
        
        now = datetime.now(timezone.utc)
        # transfer_out has negative qty (is_outbound=True)
        await _create_transaction(db_session, org, sku, loc1, -30, "transfer_out", now - timedelta(days=2), 80)
        await _create_transaction(db_session, org, sku, loc2, 30, "transfer_in", now - timedelta(days=2), 20)
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        result = await _get_top_movers(org.org_id, db_session, str(loc1.id), cutoff, limit=5)
        
        # transfer_out should be counted as outbound movement
        assert len(result) == 1
        assert result[0]["sku_code"] == "TRANSFER"

    @pytest.mark.asyncio
    async def test_nonexistent_location_returns_empty(self, db_session, create_org):
        org = await create_org()
        
        result = await get_top_skus_by_criteria(
            org.org_id, db_session, location="NonExistent", period="7d", inactives=False, limit=5
        )
        
        # location_id will be None, so query returns empty
        assert len(result["skus"]) == 0
        assert result["location"] == "NonExistent"
