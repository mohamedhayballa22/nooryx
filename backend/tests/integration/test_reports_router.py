"""
Integration tests for the reports router (/api/reports).

Tests cover:
- Dashboard metrics and summary
- Top movers and inactive SKUs
- Inventory trends
- Multi-tenancy isolation

The tests use direct DB inserts for setup to avoid overhead and ensure precise state control.
"""
import pytest
from datetime import datetime, timedelta, timezone
from uuid6 import uuid7
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import State, Transaction, SKU, Location

# =============================================================================
# Helper Functions for Data Setup
# =============================================================================

async def setup_report_data(
    session,
    org_id,
    location_id,
    sku_code,
    sku_name,
    on_hand_qty,
    txn_history: list = None,
    threshold=10
):
    """
    Helper to set up SKU, State, and Transactions.
    txn_history is a list of dicts: {'qty': int, 'days_ago': int, 'action': str}
    If txn_history is None, creates a single 'receive' txn with on_hand_qty 0 days ago.
    """
    # 1. Create SKU (code is pkey)
    sku = SKU(
        code=sku_code,
        org_id=org_id,
        name=sku_name,
        low_stock_threshold=threshold,
        reorder_point=10,
        alerts=True
    )
    try:
        session.add(sku)
    except IntegrityError:
        # SKU already exists - ignore
        pass

    # 2. Create State (Current Snapshot)
    # We assume 'on_hand_qty' is the current correct state
    state = State(
        org_id=org_id,
        sku_code=sku_code,
        location_id=location_id,
        on_hand=on_hand_qty,
        reserved=0,
        version=1
    )
    session.add(state)

    # 3. Create Transactions (History)
    if txn_history is None:
        txn_history = [{'qty': on_hand_qty, 'days_ago': 0, 'action': 'receive'}]

    running_qty = 0
    # Sort history by time (oldest first) to calculate meaningful qty_before
    # But usually we just want to insert specific records for trends/movers.
    # For simplicity, we just insert them.
    for item in txn_history:
        days_ago = item.get('days_ago', 0)
        action = item.get('action', 'receive')
        qty = item.get('qty', 0)
        
        created_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
        
        txn = Transaction(
            id=uuid7(),
            org_id=org_id,
            sku_code=sku_code,
            location_id=location_id,
            qty=qty,
            qty_before=0,
            total_cost_minor=0,
            action=action,
            created_at=created_at
        )
        session.add(txn)

    await session.flush()

async def create_location(session, org_id, name):
    loc_id = uuid7()
    loc = Location(id=loc_id, org_id=org_id, name=name)
    session.add(loc)
    await session.flush()
    return loc, loc_id


# =============================================================================
# Test Classes
# =============================================================================

@pytest.mark.asyncio
class TestDashboardMetrics:
    """Tests for GET /metrics"""

    async def test_metrics_empty(self, authenticated_client):
        """Should return zero values when no inventory exists."""
        client, _, _ = authenticated_client
        response = await client.get("/api/reports/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data['total_available'] == 0
        assert data['total_on_hand']['value'] == 0
        assert data['stockouts'] == 0
        assert data['low_stock'] == 0

    async def test_metrics_populated(
        self, 
        authenticated_client, 
        integration_session
    ):
        """
        Verify aggregated metrics with multiple SKUs and locations.
        """
        client, _, org = authenticated_client
        _, loc_id = await create_location(integration_session, org.org_id, "Warehouse A")

        # SKU 1: In Stock (50 > 10)
        await setup_report_data(
            integration_session, org.org_id, loc_id, "SKU-A", "Item A", 50, threshold=10
        )
        # SKU 2: Low Stock (5 < 10)
        await setup_report_data(
            integration_session, org.org_id, loc_id, "SKU-B", "Item B", 5, threshold=10
        )
        # SKU 3: Out of Stock (0)
        await setup_report_data(
            integration_session, org.org_id, loc_id, "SKU-C", "Item C", 0, threshold=10
        )

        response = await client.get("/api/reports/metrics")
        assert response.status_code == 200
        data = response.json()

        assert data['total_available'] == 55 # 50 + 5 + 0
        assert data['total_on_hand']['value'] == 55
        assert data['stockouts'] == 1 # SKU-C
        assert data['low_stock'] == 1 # SKU-B

    async def test_metrics_location_filter(
        self, 
        authenticated_client, 
        integration_session
    ):
        """Test metrics filtered by specific location."""
        client, _, org = authenticated_client
        loc1, loc1_id = await create_location(integration_session, org.org_id, "Loc 1")
        loc2, loc2_id = await create_location(integration_session, org.org_id, "Loc 2")

        # Loc 1: 10 units
        await setup_report_data(
            integration_session, org.org_id, loc1_id, "SKU-X", "Item X", 10
        )
        # Loc 2: 20 units
        await setup_report_data(
            integration_session, org.org_id, loc2_id, "SKU-Y", "Item Y", 20
        )

        # Filter by Loc 1
        response = await client.get("/api/reports/metrics", params={"location": "Loc 1"})
        data = response.json()
        assert data['location'] == "Loc 1"
        assert data['total_on_hand']['value'] == 10

        # Filter by Loc 2
        response = await client.get("/api/reports/metrics", params={"location": "Loc 2"})
        data = response.json()
        assert data['location'] == "Loc 2"
        assert data['total_on_hand']['value'] == 20

    async def test_metrics_invalid_location(self, authenticated_client):
        """Should error if location name doesn't exist."""
        client, _, _ = authenticated_client
        response = await client.get("/api/reports/metrics", params={"location": "Atlantis"})
        assert response.status_code == 400


@pytest.mark.asyncio
class TestDashboardSummary:
    """Tests for GET /summary"""

    async def test_summary_empty(self, authenticated_client):
        """Test initialization state."""
        client, user, _ = authenticated_client
        response = await client.get("/api/reports/summary")
        assert response.status_code == 200
        data = response.json()
        assert data['first_name'] == user.first_name
        assert data['empty_inventory'] is True
        assert data['locations'] == []

    async def test_summary_fast_movers_logic(
        self, 
        authenticated_client, 
        integration_session
    ):
        """
        Verify fast movers sections:
        - fast_mover_low_stock_sku
        - fast_mover_out_of_stock_sku
        """
        client, _, org = authenticated_client
        _, loc_id = await create_location(integration_session, org.org_id, "Main")

        # SKU 1: High outbound, Low Stock (5 < 10)
        # Transactions: 50 outbound recently
        await setup_report_data(
            integration_session, org.org_id, loc_id, "FAST-LOW", "Fast Low", 5, 
            txn_history=[{'qty': -50, 'days_ago': 2, 'action': 'ship'}],
            threshold=10
        )

        # SKU 2: High outbound, Out of Stock (0)
        await setup_report_data(
            integration_session, org.org_id, loc_id, "FAST-OUT", "Fast Out", 0, 
            txn_history=[{'qty': -40, 'days_ago': 2, 'action': 'ship'}],
            threshold=10
        )

        # SKU 3: Low outbound, Low Stock
        await setup_report_data(
            integration_session, org.org_id, loc_id, "SLOW-LOW", "Slow Low", 5, 
            txn_history=[{'qty': -1, 'days_ago': 2, 'action': 'ship'}],
            threshold=10
        )

        response = await client.get("/api/reports/summary")
        assert response.status_code == 200
        data = response.json()
        
        assert data['empty_inventory'] is False
        
        # Verify lists contain correct SKUs
        assert "FAST-LOW" in data['fast_mover_low_stock_sku']
        assert "FAST-OUT" in data['fast_mover_out_of_stock_sku']
        
        # SLOW-LOW might be in list if limit allows, but FAST-LOW should be prioritized if sorted by movement
        # The service sorts by outbound movement desc.
        # FAST-LOW (50) > SLOW-LOW (1)
        assert data['fast_mover_low_stock_sku'][0] == "FAST-LOW"


@pytest.mark.asyncio
class TestTopMovers:
    """Tests for GET /top-movers"""

    async def test_top_movers_period_logic(
        self, 
        authenticated_client, 
        integration_session
    ):
        """Test volume calculation respects time period."""
        client, _, org = authenticated_client
        _, loc_id = await create_location(integration_session, org.org_id, "Main")

        # SKU A: Move 100 2 days ago
        await setup_report_data(
            integration_session, org.org_id, loc_id, "SKU-A", "Item A", 100, 
            txn_history=[{'qty': -100, 'days_ago': 2, 'action': 'ship'}]
        )

        # SKU B: Move 200 10 days ago
        await setup_report_data(
            integration_session, org.org_id, loc_id, "SKU-B", "Item B", 100, 
            txn_history=[{'qty': -200, 'days_ago': 10, 'action': 'ship'}]
        )

        # 1. Period 7d: Should prioritize SKU-A (100) > SKU-B (0 in period)
        response = await client.get("/api/reports/top-movers", params={"period": "7d"})
        data = response.json()
        assert len(data['skus']) > 0
        assert data['skus'][0]['sku'] == "SKU-A"
        
        # 2. Period 30d: Should prioritize SKU-B (200) > SKU-A (100)
        response = await client.get("/api/reports/top-movers", params={"period": "30d"})
        data = response.json()
        assert len(data['skus']) >= 2
        assert data['skus'][0]['sku'] == "SKU-B"


@pytest.mark.asyncio
class TestTopInactives:
    """Tests for GET /top-inactives"""

    async def test_top_inactives(
        self, 
        authenticated_client, 
        integration_session
    ):
        """Test identification of stagnant stock."""
        client, _, org = authenticated_client
        _, loc_id = await create_location(integration_session, org.org_id, "Main")

        # SKU Active: Moved yesterday
        await setup_report_data(
            integration_session, org.org_id, loc_id, "ACTIVE", "Active Item", 10, 
            txn_history=[{'qty': -1, 'days_ago': 1, 'action': 'ship'}]
        )

        # SKU Inactive: Moved 20 days ago
        await setup_report_data(
            integration_session, org.org_id, loc_id, "INACTIVE", "Inactive Item", 10, 
            txn_history=[{'qty': -1, 'days_ago': 20, 'action': 'ship'}]
        )

        # Query 7d inactives
        response = await client.get("/api/reports/top-inactives", params={"period": "7d"})
        data = response.json()
        
        skus = [i['sku'] for i in data['skus']]
        assert "INACTIVE" in skus
        assert "ACTIVE" not in skus


@pytest.mark.asyncio
class TestInventoryTrends:
    """Tests for GET /trend/inventory"""

    async def test_trend_calculation(
        self, 
        authenticated_client, 
        integration_session
    ):
        """Test trend points generation."""
        client, _, org = authenticated_client
        _, loc_id = await create_location(integration_session, org.org_id, "Main")

        # Simulate trend:
        # Day -5 receive 10. (Total 10)
        # Day -3 receive 20. (Total 30)
        # Day -1 ship 5.     (Total 25)
        # Current State: 25
        history = [
            {'qty': 10, 'qty_before': 0, 'days_ago': 5, 'action': 'receive'},
            {'qty': 20, 'qty_before': 10, 'days_ago': 3, 'action': 'receive'},
            {'qty': -5, 'qty_before': 30, 'days_ago': 1, 'action': 'ship'}
        ]
        
        # We need to manually insert raw txns carefully if we want the trend logic (rn=1) to work 
        # correctly with `qty_before`. 
        # trends.py: `on_hand = txn.qty_before + txn.qty` (except reserve).
        # So we must set `qty_before` correctly.
        
        # Create SKU/Location first via helper
        await setup_report_data(
            integration_session, org.org_id, loc_id, "TREND-SKU", "Item T", 25, 
            txn_history=[], 
            threshold=10
        )
        
        # Manually Insert Correct History
        days = [5, 3, 1]
        qtys = [10, 20, -5]
        befores = [0, 10, 30]
        
        for d, q, b in zip(days, qtys, befores):
             txn = Transaction(
                id=uuid7(),
                org_id=org.org_id,
                sku_code="TREND-SKU",
                location_id=loc_id,
                qty=q,
                qty_before=b,
                action='receive' if q > 0 else 'ship',
                created_at=datetime.now(timezone.utc) - timedelta(days=d)
            )
             integration_session.add(txn)
        await integration_session.flush()

        # Get trend for 7 days
        response = await client.get("/api/reports/trend/inventory/TREND-SKU", params={"period": "7d"})
        assert response.status_code == 200
        data = response.json()
        points = data['points']
        
        # Just verify we get points and they look roughly correct
        # Note: logic interpolates.
        assert len(points) > 0
        
        # Check specific dates if possible, or just monotonicity/values
        # -5 days ago (date): should be 10 usually
        # -1 days ago: should be 25
        
        values = [p['on_hand'] for p in points]
        assert 25 in values # Final state
        assert 10 in values # Initial state


@pytest.mark.asyncio
class TestTenancyReportIsolation:
    """Ensure data from other tenants doesn't leak into reports."""

    async def test_report_isolation(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        auth_cookies,
        client, # Raw client to switch users
        integration_session
    ):
        # Client A: org_a
        client_a, _, org_a = authenticated_client
        _, loc_a = await create_location(integration_session, org_a.org_id, "Loc A")
        await setup_report_data(
            integration_session, org_a.org_id, loc_a, "SKU-A", "Item A", 100
        )

        # Client B: org_b
        org_b = await create_test_org(name="Org B")
        user_b = await create_test_user(org_b)
        cookies_b = await auth_cookies(user_b)
        
        # Switch to User B
        client.cookies.update(cookies_b)
        
        # 1. Metrics check
        response = await client.get("/api/reports/metrics")
        data = response.json()
        # Should be empty for Org B
        assert data['total_on_hand']['value'] == 0
        
        # 2. Summary check
        response = await client.get("/api/reports/summary")
        data = response.json()
        assert data['empty_inventory'] is True
        
        # 3. Trends check (ensure no points from SKU-A)
        response = await client.get("/api/reports/trend/inventory", params={"period": "7d"})
        data = response.json()
        assert len(data['points']) == 0
