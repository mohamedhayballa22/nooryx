"""
Integration tests for the transactions router (/api/transactions).

Tests the read-only audit trail views:
- Transaction listing with filtering, sorting, pagination
- Latest transactions widgets (per SKU and global)

These tests rely on the `actions` router to set up the transaction history.
"""
import pytest
from app.models import Transaction

# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def base_sku_code():
    return "TXN-TEST-001"

@pytest.fixture
def second_sku_code():
    return "TXN-TEST-002"

@pytest.fixture
def location_main():
    return "Main Warehouse"

@pytest.fixture
def location_store():
    return "Retail Store"

# =============================================================================
# Helper Functions
# =============================================================================

async def setup_receive(
    client, 
    csrf_headers, 
    sku_code, 
    location, 
    qty, 
    metadata=None
):
    """Helper to create a 'receive' transaction via actions router."""
    payload = {
        "sku_code": sku_code,
        "sku_name": "Test Item",
        "location": location,
        "qty": qty,
        "alerts": True,
        "low_stock_threshold": 10,
        "reorder_point": 20,
        "unit_cost_major": 10.00,
        "txn_metadata": metadata or {}
    }
    response = await client.post("/api/receive", json=payload, headers=csrf_headers)
    assert response.status_code == 200
    return response.json()

async def setup_ship(
    client, 
    csrf_headers, 
    sku_code, 
    location, 
    qty,
    reference=None
):
    """Helper to create a 'ship' transaction via actions router."""
    payload = {
        "sku_code": sku_code,
        "location": location,
        "qty": qty,
        "reference": reference
    }
    response = await client.post("/api/ship", json=payload, headers=csrf_headers)
    assert response.status_code == 200
    return response.json()

async def setup_adjust(
    client,
    csrf_headers,
    sku_code,
    location,
    qty,
    reason="Adjusting"
):
    """Helper to create an 'adjust' transaction via actions router."""
    payload = {
        "sku_code": sku_code,
        "location": location,
        "qty": qty,
        "txn_metadata": {"reason": reason}
    }
    response = await client.post("/api/adjust", json=payload, headers=csrf_headers)
    assert response.status_code == 200
    return response.json()

async def setup_transfer(
    client,
    csrf_headers,
    sku_code,
    from_location,
    to_location,
    qty
):
    """Helper to create a 'transfer' transaction (generates 2 txns: out/in)."""
    payload = {
        "sku_code": sku_code,
        "from_location": from_location,
        "to_location": to_location,
        "qty": qty
    }
    response = await client.post("/api/transfer", json=payload, headers=csrf_headers)
    assert response.status_code == 200
    return response.json()

# =============================================================================
# Test Classes
# =============================================================================

@pytest.mark.asyncio
class TestGetTransactions:
    """Tests for GET /api/transactions"""

    async def test_get_transactions_empty_returns_404(
        self,
        authenticated_client,
    ):
        """If no transactions exist for the org, should return 404."""
        client, _, _ = authenticated_client
        response = await client.get("/api/transactions")
        assert response.status_code == 404
        assert response.json()["error"]["detail"] == "No transactions found"

    async def test_get_transactions_data_integrity(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """Verify that transaction fields are correctly populated."""
        client, user, _ = authenticated_client

        # 1. Create a receive transaction
        # Start state: 0. Receive 100. End state: 100.
        metadata = {"batch": "BATCH-001"}
        await setup_receive(
            client, csrf_headers, base_sku_code, location_main, 100, metadata=metadata
        )

        # 2. Extract transaction list
        response = await client.get("/api/transactions")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        item = data["items"][0]
        
        # Verify core fields
        assert item["sku_code"] == base_sku_code
        assert item["action"] == "received"
        assert item["quantity"] == 100
        assert item["location"] == location_main
        # Unit cost set to 10.00 in setup_receive
        assert item["unit_cost_major"] == 10.0 
        
        # Verify calculated fields
        assert item["qty_before"] == 0
        assert item["qty_after"] == 100
        
        # Verify metadata/actor
        assert item["metadata"] == metadata
        assert item["actor"] == f"{user.first_name} {user.last_name}"

    async def test_check_shipping_logic(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """Verify qty_after calculation for shipping (subtraction)."""
        client, _, _ = authenticated_client
        
        # 1. Receive 100
        await setup_receive(
            client, csrf_headers, base_sku_code, location_main, 100
        )
        
        # 2. Ship 30
        await setup_ship(
            client, csrf_headers, base_sku_code, location_main, 30
        )
        
        response = await client.get("/api/transactions", params={"sort_by": "created_at", "order": "desc"})
        items = response.json()["items"]
        
        # Most recent is ship
        ship_txn = items[0]
        assert ship_txn["action"] == "shipped"
        assert ship_txn["qty_before"] == 100
        assert ship_txn["quantity"] == 30
        assert ship_txn["qty_after"] == 70  # 100 - 30

    async def test_filter_by_action(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """Test filtering transactions by action type."""
        client, _, _ = authenticated_client

        # 1. Receive 100 (action: receive)
        await setup_receive(client, csrf_headers, base_sku_code, location_main, 100)
        
        # 2. Ship 10 (action: ship)
        await setup_ship(client, csrf_headers, base_sku_code, location_main, 10)
        
        # 3. Filter by 'received'
        response = await client.get("/api/transactions", params={"action": ["received"]})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["action"] == "received"
        
        # 4. Filter by 'shipped'
        response = await client.get("/api/transactions", params={"action": ["shipped"]})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["action"] == "shipped"
        
        # 5. Filter by multiple
        response = await client.get("/api/transactions", params={"action": ["received", "shipped"]})
        data = response.json()
        assert data["total"] == 2

    async def test_search_functionality(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        second_sku_code,
        location_main,
        location_store,
    ):
        """Test search across SKU, metadata, location, and actor."""
        client, user, _ = authenticated_client

        # T1: SKU1, metadata 'Project X', Main Warehouse
        await setup_receive(
            client, csrf_headers, base_sku_code, location_main, 10, metadata={"project": "Project X"}
        )
        
        # T2: SKU2, metadata 'Project Y', Retail Store
        await setup_receive(
            client, csrf_headers, second_sku_code, location_store, 20, metadata={"project": "Project Y"}
        )

        # Search by SKU
        response = await client.get("/api/transactions", params={"search": base_sku_code})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["sku_code"] == base_sku_code

        # Search by Metadata value
        response = await client.get("/api/transactions", params={"search": "Project Y"})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["sku_code"] == second_sku_code

        # Search by Location Name (Partial)
        response = await client.get("/api/transactions", params={"search": "Retail"})
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["location"] == location_store

        # Search by Actor Name (Partial)
        # Note: This matches the user's name used in 'authenticated_client'
        response = await client.get("/api/transactions", params={"search": user.first_name})
        assert response.status_code == 200
        # Should match both transactions as they were created by the same user
        assert response.json()["total"] == 2

    async def test_sorting(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        second_sku_code,
        location_main,
        location_store
    ):
        """Test sorting by various fields."""
        client, _, _ = authenticated_client

        # 1. Receive 10 (SKU1, Main)
        await setup_receive(client, csrf_headers, base_sku_code, location_main, 10)
        # 2. Receive 50 (SKU2, Main)
        await setup_receive(client, csrf_headers, second_sku_code, location_main, 50)
        # 3. Ship 5 (SKU1, Main)
        await setup_ship(client, csrf_headers, base_sku_code, location_main, 5)

        # Sort by quantity Desc (Should be: 50, 10, 5) 
        response = await client.get("/api/transactions", params={"sort_by": "qty", "order": "desc"})
        qtys = [item["quantity"] for item in response.json()["items"]]
        assert qtys == [50, 10, 5]

        # Sort by quantity Asc (Should be: 5, 10, 50)
        response = await client.get("/api/transactions", params={"sort_by": "qty", "order": "asc"})
        qtys = [item["quantity"] for item in response.json()["items"]]
        assert qtys == [5, 10, 50]

        # Sort by sku_code
        response = await client.get("/api/transactions", params={"sort_by": "sku_code", "order": "asc"})
        skus = [item["sku_code"] for item in response.json()["items"]]
        # Since created_at matters for secondary sort, and SKU1 was first and third...
        # We just expect SKU1, SKU1, SKU2 or SKU1, SKU2, SKU1 depending on order
        # Actually SKU sort should group them.
        # SKU1, SKU1, SKU2 or SKU2, SKU1, SKU1 etc.
        # "TXN-TEST-001" < "TXN-TEST-002"
        # Since we sort by SKU ASC, we expect SKU1s then SKU2s
        assert skus == [base_sku_code, base_sku_code, second_sku_code]

    async def test_pagination(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """Test correct pagination."""
        client, _, _ = authenticated_client

        # Create 15 transactions
        for _ in range(15):
            await setup_receive(client, csrf_headers, base_sku_code, location_main, 1)

        # Page 1
        response = await client.get("/api/transactions", params={"page": 1, "size": 10})
        data = response.json()
        assert data["total"] == 15
        assert len(data["items"]) == 10
        assert data["page"] == 1
        
        # Page 2
        response = await client.get("/api/transactions", params={"page": 2, "size": 10})
        data = response.json()
        assert len(data["items"]) == 5
        assert data["page"] == 2


@pytest.mark.asyncio
class TestLatestTransactions:
    """Tests for latest transaction widgets"""

    async def test_latest_by_sku(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """Test GET /api/transactions/latest/{sku_code}"""
        client, _, _ = authenticated_client
        
        # 1. Receive
        await setup_receive(client, csrf_headers, base_sku_code, location_main, 100)
        # 2. Ship
        await setup_ship(client, csrf_headers, base_sku_code, location_main, 20)
        
        # Endpoint returns top 3 recent
        response = await client.get(f"/api/transactions/latest/{base_sku_code}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["sku_code"] == base_sku_code
        assert len(data["transactions"]) == 2
        
        # Verify location inference (only 1 location used, so it should be filled)
        assert data["location"] == location_main

    async def test_latest_by_sku_location_filter(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
        location_store,
    ):
        """Test GET /api/transactions/latest/{sku_code} with location filter"""
        client, _, _ = authenticated_client
        
        # 1. Receive at Main
        await setup_receive(client, csrf_headers, base_sku_code, location_main, 100)
        # 2. Receive at Store
        await setup_receive(client, csrf_headers, base_sku_code, location_store, 50)
        
        # Filter by Main - should only see the Main transaction
        response = await client.get(
            f"/api/transactions/latest/{base_sku_code}", 
            params={"location": location_main}
        )
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["location"] == location_main
        
        # Filter by Store
        response = await client.get(
            f"/api/transactions/latest/{base_sku_code}",
            params={"location": location_store}
        )
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["location"] == location_store

    async def test_latest_global(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        second_sku_code,
        location_main,
    ):
        """Test GET /api/transactions/latest (Global)"""
        client, _, _ = authenticated_client
        
        # T1: SKU1 Receive
        await setup_receive(client, csrf_headers, base_sku_code, location_main, 100)
        # T2: SKU2 Receive
        await setup_receive(client, csrf_headers, second_sku_code, location_main, 50)
        
        response = await client.get("/api/transactions/latest")
        assert response.status_code == 200
        data = response.json()
        
        # Should contain mixed SKUs
        sku_codes = {t["sku_code"] for t in data["transactions"]}
        assert base_sku_code in sku_codes
        assert second_sku_code in sku_codes


@pytest.mark.asyncio
class TestAuthIsolation:
    """Tests tenant isolation for transactions."""

    async def test_cannot_see_other_orgs_transactions(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        auth_cookies,
        client,
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """User B should not see transactions created by User A."""
        # User A setup
        client_a, _, _ = authenticated_client
        await setup_receive(client_a, csrf_headers, base_sku_code, location_main, 100)

        # User B setup
        org_b = await create_test_org(name="Org B")
        user_b = await create_test_user(org_b)
        cookies_b = await auth_cookies(user_b)
        
        client.cookies.update(cookies_b)
        
        # 1. List transactions -> 404 (empty for this org)
        response = await client.get("/api/transactions")
        assert response.status_code == 404
        
        # 2. Latest by SKU -> 404 (SKU doesn't exist for this org effectively, or no txns)
        response = await client.get(f"/api/transactions/latest/{base_sku_code}")
        assert response.status_code == 404
