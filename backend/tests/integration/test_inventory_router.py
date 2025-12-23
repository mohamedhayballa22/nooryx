"""
Integration tests for the inventory router (/api/inventory).

Tests the read-only inventory views:
- Aggregated inventory list (with filtering, sorting, pagination)
- Detailed SKU inventory view (with location breakdown)

These tests rely on the `actions` router to set up the inventory state.
"""
import pytest

# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def base_sku_code():
    return "INV-TEST-001"

@pytest.fixture
def second_sku_code():
    return "INV-TEST-002"

@pytest.fixture
def location_main():
    return "Main Warehouse"

@pytest.fixture
def location_store():
    return "Retail Store"

# =============================================================================
# Helper Functions
# =============================================================================

async def setup_inventory_item(
    client, 
    csrf_headers, 
    sku_code, 
    sku_name, 
    location, 
    qty, 
    threshold=10
):
    """Helper to create inventory via the receive action."""
    payload = {
        "sku_code": sku_code,
        "sku_name": sku_name,
        "location": location,
        "qty": qty,
        "alerts": True,
        "low_stock_threshold": threshold,
        "reorder_point": 20,
        "unit_cost_major": 10.00,
    }
    response = await client.post("/api/receive", json=payload, headers=csrf_headers)
    assert response.status_code == 200
    return response.json()

# =============================================================================
# Test Classes
# =============================================================================

@pytest.mark.asyncio
class TestGetInventory:
    """Tests for GET /api/inventory"""

    async def test_get_inventory_empty_returns_404(
        self,
        authenticated_client,
    ):
        """If no inventory exists for the org, should return 404 (as per implementation)."""
        client, _, _ = authenticated_client
        
        # We assume a clean state for the new org created by authenticated_client
        response = await client.get("/api/inventory", params={"stock_status": ["In Stock", "Low Stock", "Out of Stock"]})
        assert response.status_code == 404

    async def test_get_inventory_populated_aggregation(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
        location_store,
    ):
        """
        Verify that inventory items are returned and aggregated across locations.
        """
        client, _, _ = authenticated_client

        # Setup: Receive stock for same SKU in two locations
        # Main: 50
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test Item", location_main, 50
        )
        # Store: 30
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test Item", location_store, 30
        )

        response = await client.get("/api/inventory")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 1
        item = data["items"][0]
        assert item["sku_code"] == base_sku_code
        assert item["name"] == "Test Item"
        # Available should be 50 + 30 = 80
        assert item["available"] == 80
        # Locations string should contain both
        assert location_main in item["location"]
        assert location_store in item["location"]
        assert item["status"] == "In Stock"

    async def test_get_inventory_filtering(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        second_sku_code,
        location_main,
    ):
        """Test search and stock status filtering."""
        client, _, _ = authenticated_client

        # SKU 1: 100 units (In Stock) - Threshold 10
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Alpha Product", location_main, 100, threshold=10
        )

        # SKU 2: 5 units (Low Stock) - Threshold 10
        await setup_inventory_item(
            client, csrf_headers, second_sku_code, "Beta Product", location_main, 5, threshold=10
        )

        # 1. Search by SKU code partial
        response = await client.get("/api/inventory", params={"search": base_sku_code[4:]})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["sku_code"] == base_sku_code

        # 2. Filter by Stock Status: Low Stock
        response = await client.get("/api/inventory", params={"stock_status": ["Low Stock"]})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["sku_code"] == second_sku_code
        assert data["items"][0]["status"] == "Low Stock"

        # 3. Filter by Stock Status: In Stock
        response = await client.get("/api/inventory", params={"stock_status": ["In Stock"]})
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["sku_code"] == base_sku_code

        # 4. Multi-status filter
        response = await client.get("/api/inventory", params={"stock_status": ["In Stock", "Low Stock"]})
        data = response.json()
        assert data["total"] == 2

    async def test_get_inventory_sorting(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        second_sku_code,
        location_main,
    ):
        """Test sorting by available quantity."""
        client, _, _ = authenticated_client

        # SKU 1: 10 units
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "A-Item", location_main, 10
        )
        # SKU 2: 20 units
        await setup_inventory_item(
            client, csrf_headers, second_sku_code, "B-Item", location_main, 20
        )

        # Sort by available desc
        response = await client.get("/api/inventory", params={"sort_by": "available", "order": "desc"})
        data = response.json()
        assert data["items"][0]["sku_code"] == second_sku_code
        assert data["items"][1]["sku_code"] == base_sku_code

        # Sort by available asc
        response = await client.get("/api/inventory", params={"sort_by": "available", "order": "asc"})
        data = response.json()
        assert data["items"][0]["sku_code"] == base_sku_code
        assert data["items"][1]["sku_code"] == second_sku_code

    async def test_get_inventory_pagination(
        self,
        authenticated_client,
        csrf_headers,
        location_main,
    ):
        """Test pagination limits and offsets."""
        client, _, _ = authenticated_client

        # Create 15 items
        for i in range(15):
            await setup_inventory_item(
                client, 
                csrf_headers, 
                f"SKU-{i:03d}", 
                f"Item {i}", 
                location_main, 
                10
            )

        # Page 1 (size 10)
        response = await client.get("/api/inventory", params={"page": 1, "size": 10})
        data = response.json()
        assert data["total"] == 15
        assert len(data["items"]) == 10
        
        # Page 2 (size 10)
        response = await client.get("/api/inventory", params={"page": 2, "size": 10})
        data = response.json()
        assert len(data["items"]) == 5


@pytest.mark.asyncio
class TestGetSkuInventory:
    """Tests for GET /api/inventory/{sku_code}"""

    async def test_get_sku_details_success(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
        location_store,
    ):
        """Test detailed SKU view with location breakdown."""
        client, _, _ = authenticated_client

        # Setup: 
        # Main: 100
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test SKU", location_main, 100, threshold=20
        )
        # Store: 50
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test SKU", location_store, 50, threshold=20
        )
        
        response = await client.get(f"/api/inventory/{base_sku_code}")
        assert response.status_code == 200
        data = response.json()

        assert data["sku_code"] == base_sku_code
        assert data["name"] == "Test SKU"
        assert data["low_stock_threshold"] == 20
        assert data["locations"] == 2
        assert location_main in data["location_names"]
        assert location_store in data["location_names"]
        
        # Summary checks
        # Total: 150
        assert data["summary"]["available"] == 150
        assert data["summary"]["on_hand"]["value"] == 150
        
        # Expected Status: In Stock (> 20)
        assert data["status"] == "In Stock"

    async def test_get_sku_filter_by_location(
        self,
        authenticated_client,
        csrf_headers,
        base_sku_code,
        location_main,
        location_store,
    ):
        """Test retrieving SKU details for a specific location."""
        client, _, _ = authenticated_client

        # Setup
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test SKU", location_main, 100
        )
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test SKU", location_store, 50
        )

        # Filter by Main Location
        response = await client.get(f"/api/inventory/{base_sku_code}", params={"location": location_main})
        assert response.status_code == 200
        data = response.json()
        
        assert data["location"] == location_main
        assert data["summary"]["available"] == 100
        assert data["summary"]["on_hand"]["value"] == 100
        
        # Inventory PCT should be 100 / 150 approx 66.7%
        assert data["inventory_pct"] == 66.7

    async def test_get_sku_not_found(self, authenticated_client):
        """Requests for non-existent SKUs return 404."""
        client, _, _ = authenticated_client
        response = await client.get("/api/inventory/NON-EXISTENT-SKU")
        assert response.status_code == 404

    async def test_get_sku_invalid_location(
        self, 
        authenticated_client, 
        csrf_headers,
        base_sku_code,
        location_main 
    ):
        """Requests with non-existent location return 400 (as implemented)."""
        client, _, _ = authenticated_client
        
        await setup_inventory_item(
            client, csrf_headers, base_sku_code, "Test SKU", location_main, 100
        )
        
        response = await client.get(f"/api/inventory/{base_sku_code}", params={"location": "Mars Base 1"})
        assert response.status_code == 400


@pytest.mark.asyncio
class TestAuthIsolation:
    """Tests tenant isolation for inventory."""

    async def test_cannot_see_other_orgs_inventory(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        auth_cookies,
        client, # Raw client
        csrf_headers,
        base_sku_code,
        location_main,
    ):
        """User B should not see inventory created by User A."""
        # User A setup
        client_a, user_a, org_a = authenticated_client
        await setup_inventory_item(
            client_a, csrf_headers, base_sku_code, "Secret Item", location_main, 100
        )

        # User B setup
        org_b = await create_test_org(name="Org B")
        user_b = await create_test_user(org_b)
        cookies_b = await auth_cookies(user_b)
        
        client.cookies.update(cookies_b)
        
        # 1. List inventory
        # Should be empty or 404
        response = await client.get("/api/inventory", params={"stock_status": ["In Stock", "Low Stock", "Out of Stock"]})
        # The implementation returns 404 if count is 0 when filters are applied
        assert response.status_code == 404
        
        # 2. Get specific SKU
        response = await client.get(f"/api/inventory/{base_sku_code}")
        assert response.status_code == 404
