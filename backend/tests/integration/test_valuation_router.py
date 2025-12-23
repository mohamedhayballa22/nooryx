
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

from app.models import SKU, Location, CostRecord, Transaction, Organization

# =============================================================================
# Helpers
# =============================================================================

async def create_sku(session: AsyncSession, org_id, code, name="Test SKU"):
    sku = SKU(
        code=code,
        org_id=org_id,
        name=name,
        reorder_point=10,
        alerts=True
    )
    session.add(sku)
    await session.flush()
    return sku

async def create_location(session: AsyncSession, org_id, name="Warehouse A"):
    loc = Location(
        id=uuid7(),
        org_id=org_id,
        name=name
    )
    session.add(loc)
    await session.flush()
    return loc

async def create_cost_record(
    session: AsyncSession, 
    org_id, 
    sku_code, 
    location_id, 
    qty_remaining, 
    unit_cost_minor,
    created_at=None
):
    cr = CostRecord(
        id=uuid7(),
        org_id=org_id,
        sku_code=sku_code,
        location_id=location_id,
        qty_in=qty_remaining, # Assuming initial state for simplicity
        qty_remaining=qty_remaining,
        unit_cost_minor=unit_cost_minor,
        created_at=created_at or datetime.now(timezone.utc)
    )
    session.add(cr)
    await session.flush()
    return cr

async def create_transaction(
    session: AsyncSession,
    org_id,
    sku_code,
    location_id,
    action,
    qty,
    total_cost_minor=None,
    created_at=None
):
    txn = Transaction(
        id=uuid7(),
        org_id=org_id,
        sku_code=sku_code,
        location_id=location_id,
        action=action,
        qty=qty,
        qty_before=0,
        total_cost_minor=total_cost_minor,
        created_at=created_at or datetime.now(timezone.utc)
    )
    session.add(txn)
    await session.flush()
    return txn


@pytest.mark.asyncio
class TestInventoryValuation:
    """Tests for GET /api/valuation/skus (Per-SKU Valuation)"""

    async def test_get_skus_valuation_happy_path(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        csrf_headers,
    ):
        """
        Verify that valuation is correctly aggregated per SKU using CostRecords.
        Checks: total_qty, avg_cost (calculated), total_value.
        """
        client, user, org = authenticated_client
        
        # Setup Data
        loc = await create_location(integration_session, org.org_id)
        sku1 = await create_sku(integration_session, org.org_id, "SKU-VAL-001", "Expensive Item")
        sku2 = await create_sku(integration_session, org.org_id, "SKU-VAL-002", "Cheap Item")
        
        # SKU 1 Records: 
        # 10 units @ $10.00 (1000 minor)
        # 5 units @ $12.00 (1200 minor)
        # Total Qty = 15, Total Value = 10*1000 + 5*1200 = 10000 + 6000 = 16000 minor ($160.00)
        # Avg Cost = 16000 / 15 = 1066.66 minor -> $10.67 (approx, or strict math depending on logic)
        await create_cost_record(integration_session, org.org_id, sku1.code, loc.id, 10, 1000)
        await create_cost_record(integration_session, org.org_id, sku1.code, loc.id, 5, 1200)

        # SKU 2 Records:
        # 20 units @ $5.00 (500 minor)
        # Total Value = 10000 minor ($100.00)
        await create_cost_record(integration_session, org.org_id, sku2.code, loc.id, 20, 500)
        
        # Call Endpoint
        response = await client.get("/api/valuation/skus")
        assert response.status_code == 200
        data = response.json()
        
        items = data["items"]
        assert len(items) == 2
        
        # Sort by SKU code to simplify assertions
        items.sort(key=lambda x: x["sku_code"])
        
        # Assert SKU 1
        val1 = items[0]
        assert val1["sku_code"] == "SKU-VAL-001"
        assert val1["total_qty"] == 15
        assert val1["total_value"] == 160.0  # 16000 / 100
        # Check weighted average logic: 16000 / 15 ≈ 1066.666 mixed -> handled by logic
        assert val1["avg_cost"] == 10.66 or val1["avg_cost"] == 10.67 
        assert val1["currency"] == org.currency

        # Assert SKU 2
        val2 = items[1]
        assert val2["sku_code"] == "SKU-VAL-002"
        assert val2["total_qty"] == 20
        assert val2["total_value"] == 100.0
        assert val2["avg_cost"] == 5.0

    async def test_get_skus_valuation_ignores_exhausted_records(
        self,
        authenticated_client,
        integration_session: AsyncSession,
    ):
        """Should filter out CostRecords with qty_remaining = 0"""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku = await create_sku(integration_session, org.org_id, "SKU-ZERO")
        
        # Active Record
        await create_cost_record(integration_session, org.org_id, sku.code, loc.id, 10, 500)
        # Exhausted Record
        await create_cost_record(integration_session, org.org_id, sku.code, loc.id, 0, 500)
        
        response = await client.get("/api/valuation/skus")
        assert response.status_code == 200
        item = response.json()["items"][0]
        
        assert item["total_qty"] == 10
        assert item["total_value"] == 50.0 # 10 * 5.00

    async def test_get_skus_valuation_empty_state(self, authenticated_client):
        """Returns empty list when no cost records exist."""
        client, _, _ = authenticated_client
        response = await client.get("/api/valuation/skus")
        assert response.status_code == 200
        assert response.json()["items"] == []


@pytest.mark.asyncio
class TestValuationHeader:
    """Tests for GET /api/valuation (Summary Header)"""

    async def test_get_valuation_summary_total(
        self,
        authenticated_client,
        integration_session,
    ):
        """Aggregates total value of all SKUs in the organization."""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku1 = await create_sku(integration_session, org.org_id, "S1")
        sku2 = await create_sku(integration_session, org.org_id, "S2")
        
        # SKU 1: 10 * $10 = $100
        await create_cost_record(integration_session, org.org_id, sku1.code, loc.id, 10, 1000)
        # SKU 2: 5 * $20 = $100
        await create_cost_record(integration_session, org.org_id, sku2.code, loc.id, 5, 2000)
        
        response = await client.get("/api/valuation")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_value"] == 200.0
        assert data["currency"] == org.currency
        assert data["method"] == org.valuation_method

    async def test_get_valuation_summary_filtered_by_sku(
        self,
        authenticated_client,
        integration_session,
    ):
        """Verifies sku_code query param filters the summation."""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku1 = await create_sku(integration_session, org.org_id, "S1")
        sku2 = await create_sku(integration_session, org.org_id, "S2")
        
        await create_cost_record(integration_session, org.org_id, sku1.code, loc.id, 10, 1000) # $100
        await create_cost_record(integration_session, org.org_id, sku2.code, loc.id, 20, 1000) # $200
        
        response = await client.get(f"/api/valuation?sku_code={sku1.code}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_value"] == 100.0

    async def test_get_valuation_summary_invalid_sku(
        self,
        authenticated_client,
        integration_session,
    ):
        """Returns 404 if SKU doesn't exist."""
        client, _, _ = authenticated_client
        response = await client.get("/api/valuation?sku_code=NON-EXISTENT")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestCOGS:
    """Tests for GET /api/valuation/cogs"""

    async def test_get_cogs_calculation(
        self,
        authenticated_client,
        integration_session,
    ):
        """COGS sums up 'ship' transactions' total_cost_minor."""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku = await create_sku(integration_session, org.org_id, "S-COGS")
        
        # Shipments (Count as COGS)
        # 5 units cost $50 total
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -5, 5000)
        # 2 units cost $30 total
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -2, 3000)
        
        # Receipt (Should be ignored)
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "receive", 10, 10000)
        
        response = await client.get("/api/valuation/cogs")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_cogs"] == 80.0  # (5000 + 3000) / 100
        assert data["currency"] == org.currency

    async def test_get_cogs_date_filtering(
        self,
        authenticated_client,
        integration_session,
    ):
        """COGS respects start_date and end_date."""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku = await create_sku(integration_session, org.org_id, "S-DATE")
        
        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)
        
        # Old Shipment (Last Week) - $20
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -1, 2000, created_at=last_week)
        # Recent Shipment (Yesterday) - $10
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -1, 1000, created_at=yesterday)
        
        # Filter for last 2 days
        start_date = (
            now - timedelta(days=2)
        ).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        response = await client.get(f"/api/valuation/cogs?start_date={start_date}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_cogs"] == 10.0 # Only the recent one included

    async def test_get_cogs_delta_calculation(
        self,
        authenticated_client,
        integration_session,
    ):
        """Verifies percentage change calculation vs previous period."""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku = await create_sku(integration_session, org.org_id, "S-DELTA")
        
        now = datetime.now(timezone.utc)
        
        # Current Period (0 to -30 days): $100 COGS
        dt_current = now - timedelta(days=15)
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -10, 10000, created_at=dt_current)
        
        # Previous Period (-30 to -60 days): $50 COGS
        dt_prev = now - timedelta(days=45)
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -5, 5000, created_at=dt_prev)
        
        # Request for last 30 days
        start_date = (
            now - timedelta(days=30)
        ).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        
        response = await client.get(f"/api/valuation/cogs?start_date={start_date}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_cogs"] == 100.0
        # Delta: (100 - 50) / 50 * 100 = 100% increase
        assert data["delta_percentage"] == 100.0


@pytest.mark.asyncio
class TestCOGSTrend:
    """Tests for GET /api/valuation/cogs/trend"""

    async def test_cogs_trend_daily_granularity(
        self,
        authenticated_client,
        integration_session,
    ):
        """Daily trend returns correct timeseries."""
        client, user, org = authenticated_client
        loc = await create_location(integration_session, org.org_id)
        sku = await create_sku(integration_session, org.org_id, "S-TREND")
        
        now = datetime.now(timezone.utc)
        today = now.date()
        yesterday = (now - timedelta(days=1)).date()
        
        # Today: $20
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -2, 2000, created_at=now)
        # Yesterday: $10
        await create_transaction(integration_session, org.org_id, sku.code, loc.id, "ship", -1, 1000, created_at=now - timedelta(days=1))
        
        response = await client.get("/api/valuation/cogs/trend?granularity=daily&period=7d")
        assert response.status_code == 200
        data = response.json()
        
        points = data["points"]
        # Find points for today and yesterday
        p_today = next((p for p in points if p["date"] == today.isoformat()), None)
        p_yesterday = next((p for p in points if p["date"] == yesterday.isoformat()), None)
        
        assert p_today is not None
        assert p_today["cogs"] == 20.0
        
        assert p_yesterday is not None
        assert p_yesterday["cogs"] == 10.0

@pytest.mark.asyncio
class TestTenancyValuation:
    """Tests tenancy isolation for valuation endpoints"""

    async def test_valuation_data_is_tenant_isolated(
        self,
        authenticated_client,
        create_test_org,
        integration_session,
    ):
        """Ensure User A cannot see User B's valuation data."""
        # Setup Org A (Authenticated User)
        client_a, user_a, org_a = authenticated_client
        loc_a = await create_location(integration_session, org_a.org_id)
        sku_a = await create_sku(integration_session, org_a.org_id, "A-SKU")
        await create_cost_record(integration_session, org_a.org_id, sku_a.code, loc_a.id, 10, 1000) # $100 Val
        
        # Setup Org B
        org_b = await create_test_org(name="Org B")
        loc_b = await create_location(integration_session, org_b.org_id)
        sku_b = await create_sku(integration_session, org_b.org_id, "B-SKU")
        await create_cost_record(integration_session, org_b.org_id, sku_b.code, loc_b.id, 50, 5000) # $5000 Val? No, 50*5000 = large.
        
        # Check Valuation Summary for A
        response = await client_a.get("/api/valuation")
        data = response.json()
        assert data["total_value"] == 100.0 # Only sees their own
        
        # Check SKU List for A
        response = await client_a.get("/api/valuation/skus")
        skus = response.json()["items"]
        assert len(skus) == 1
        assert skus[0]["sku_code"] == "A-SKU"
