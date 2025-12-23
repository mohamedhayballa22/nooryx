"""
Integration tests for the actions router (/api/actions).

Tests the core inventory movements:
- Receive
- Ship
- Adjust
- Reserve
- Unreserve
- Transfer

These tests verify:
- Happy paths (successful state changes)
- Sad paths (validation, logic errors)
- Side effects (ledger entries, stock updates)
- Tenants isolation
"""
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction, State

# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def sku_code():
    return "TEST-SKU-001"

@pytest.fixture
def location_name():
    return "Warehouse A"

@pytest.fixture
def target_location_name():
    return "Warehouse B"

# =============================================================================
# Test Classes
# =============================================================================

@pytest.mark.asyncio
class TestReceive:
    """Tests for POST /api/actions/receive"""

    async def test_receive_new_stock_creates_state_and_transaction(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Receiving stock for a new SKU/Location should create the SKU, Location,
        State, and Transaction records.
        """
        client, user, org = authenticated_client
        
        payload = {
            "sku_code": sku_code,
            "sku_name": "Test Product",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "reorder_point": 20,
            "unit_cost_major": 15.50,
            "reference": "PO-12345",
            "txn_metadata": {"batch": "B1"}
        }

        response = await client.post("/api/receive", json=payload, headers=csrf_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["inventory_state"]["on_hand"] == 100
        assert data["inventory_state"]["available"] == 100
        assert "Received 100 units" in data["narrative"]

        # Verify DB Side Effects using separate session queries
        # 1. State
        state = await integration_session.scalar(
            select(State).where(
                State.org_id == org.org_id,
                State.sku_code == sku_code,
                State.location.has(name=location_name)
            )
        )
        assert state is not None
        assert state.on_hand == 100
        assert state.available == 100

        # 2. Transaction
        txn = await integration_session.scalar(
            select(Transaction).where(
                Transaction.id == data["id"]
            )
        )
        assert txn is not None
        assert txn.action == "receive"
        assert txn.qty == 100
        assert txn.org_id == org.org_id
        assert txn.sku_code == sku_code

    async def test_receive_existing_stock_updates_state(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """Receiving more stock updates existing on_hand count."""
        client, _, _ = authenticated_client
        
        # First receive
        payload = {
            "sku_code": sku_code,
            "sku_name": "Test Product",
            "location": location_name,
            "qty": 50,
            "alerts": False,
            "low_stock_threshold": 5,
            "unit_cost_major": 10.00,
        }
        await client.post("/api/receive", json=payload, headers=csrf_headers)

        # Second receive
        response = await client.post("/api/receive", json=payload, headers=csrf_headers)
        assert response.status_code == 200
        assert response.json()["inventory_state"]["on_hand"] == 100


@pytest.mark.asyncio
class TestShip:
    """Tests for POST /api/actions/ship"""

    async def test_ship_sufficient_stock_success(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """Shipping available stock reduces on_hand and available."""
        client, _, _ = authenticated_client
        
        # Setup: Receive 100
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        # Ship 40
        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 40,
            "reference": "SO-999"
        }
        response = await client.post("/api/ship", json=payload, headers=csrf_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["inventory_state"]["on_hand"] == 60
        assert data["inventory_state"]["available"] == 60
        assert "Shipped 40 units" in data["narrative"]

    async def test_ship_insufficient_stock_fails(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """Shipping more than available should fail."""
        client, _, _ = authenticated_client
        
        # Setup: Receive 10
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 10,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        # Try to ship 20
        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 20
        }
        response = await client.post("/api/ship", json=payload, headers=csrf_headers)
        
        assert response.status_code >= 400
        assert "insufficient" in response.text.lower() or "stock" in response.text.lower()


@pytest.mark.asyncio
class TestAdjust:
    """Tests for POST /api/actions/adjust"""

    async def test_adjust_positive_increases_stock(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """Positive adjustment works like a receipt without cost requirements."""
        client, _, _ = authenticated_client
        
        # Setup: Receive 10
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 10,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 5,
            "txn_metadata": {"reason": "Found extra"}
        }
        response = await client.post("/api/adjust", json=payload, headers=csrf_headers)
        
        assert response.status_code == 200
        assert response.json()["inventory_state"]["on_hand"] == 15

    async def test_adjust_negative_decreases_stock(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """Negative adjustment works like a shipment."""
        client, _, _ = authenticated_client
        
        # Setup: Receive 10
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 10,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": -3,
            "txn_metadata": {"reason": "Damaged"}
        }
        response = await client.post("/api/adjust", json=payload, headers=csrf_headers)
        
        assert response.status_code == 200
        assert response.json()["inventory_state"]["on_hand"] == 7

    async def test_adjust_missing_reason_fails_validation(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """Adjustments require a reason in metadata."""
        client, _, _ = authenticated_client
        
        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 5,
            "txn_metadata": {} # Missing reason
        }
        # Validation error happens before CSRF validation often, but safer to include headers.
        response = await client.post("/api/adjust", json=payload, headers=csrf_headers)
        
        assert response.status_code == 422


@pytest.mark.asyncio
class TestReserveAndUnreserve:
    """Tests for POST /api/actions/reserve and /unreserve"""

    async def test_reserve_moves_available_to_reserved(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        client, _, _ = authenticated_client
        
        # Setup: Receive 50
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 50,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        # Reserve 20
        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 20,
            "txn_metadata": {"order_id": "ORD-123"}
        }
        response = await client.post("/api/reserve", json=payload, headers=csrf_headers)

        assert response.status_code == 200
        state = response.json()["inventory_state"]
        assert state["on_hand"] == 50
        assert state["reserved"] == 20
        assert state["available"] == 30

    async def test_reserve_more_than_available_fails(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        client, _, _ = authenticated_client
        
        # Setup: Receive 10
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 10,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        # Try Reserve 15
        response = await client.post("/api/reserve", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 15
        }, headers=csrf_headers)
        
        assert response.status_code >= 400

    async def test_unreserve_restores_available(
        self,
        authenticated_client,
        sku_code,
        location_name,
        csrf_headers,
    ):
        client, _, _ = authenticated_client
        
        # Setup: Receive 50, Reserve 20
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 50,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)
        await client.post("/api/reserve", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 20
        }, headers=csrf_headers)

        # Unreserve 10
        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 10,
            "txn_metadata": {"reason": "Order cancelled"}
        }
        response = await client.post("/api/unreserve", json=payload, headers=csrf_headers)
        
        assert response.status_code == 200
        state = response.json()["inventory_state"]
        assert state["reserved"] == 10
        assert state["available"] == 40


@pytest.mark.asyncio
class TestTransfer:
    """Tests for POST /api/actions/transfer"""

    async def test_transfer_moves_stock_between_locations(
        self,
        authenticated_client,
        sku_code,
        location_name,
        target_location_name,
        csrf_headers,
    ):
        client, _, _ = authenticated_client
        
        # Setup: Receive 100 at Source
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Item",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        # Setup: Target location exists (via a small receipt or just implicit logic? 
        # Transfer might require target location to exist in DB or it will create it? 
        # Usually Transfer auto-creates location if not exists in simpler systems, 
        # but let's assume we need to init it or the system handles it. 
        # The Receive endpoint creates Location if missing. Transfer might too.
        # Let's try transferring directly.)

        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "target_location": target_location_name,
            "qty": 30
        }
        
        response = await client.post("/api/transfer", json=payload, headers=csrf_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Summary verification
        assert data["summary"]["source_remaining"] == 70
        assert data["summary"]["target_new_total"] == 30
        
        # Details verification
        assert data["transfer_out"]["inventory_state"]["on_hand"] == 70
        assert data["transfer_in"]["inventory_state"]["on_hand"] == 30


@pytest.mark.asyncio
class TestAuthIsolation:
    """Tests tenant isolation"""
    
    async def test_cannot_transact_on_another_orgs_location(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client, # Raw client without cookies to add second user
        auth_cookies,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """User from Org A cannot receive stock into Org B."""
        # User 1 (Org A)
        client_a, user_a, org_a = authenticated_client
        
        # User 2 (Org B)
        org_b = await create_test_org(name="Org B")
        user_b = await create_test_user(org_b)
        cookies_b = await auth_cookies(user_b)
        
        # Setup: Org A has stock
        await client_a.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Org A Item",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10
        }, headers=csrf_headers)

        # Try to ship that stock using User B
        # Authenticate client as User B
        client.cookies.update(cookies_b)
        
        payload = {
            "sku_code": sku_code,
            "location": location_name,
            "qty": 10
        }
        
        response = await client.post("/api/ship", json=payload, headers=csrf_headers)
        
        # Should fail - either 404 (not found in Org B) or 403.
        # Given multi-tenant design, usually queries filter by Org ID, 
        # so it will look like the SKU/Location doesn't exist for Org B.
        assert response.status_code in (404, 400, 422) 
