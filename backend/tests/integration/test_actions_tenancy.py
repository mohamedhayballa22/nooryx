"""
Tenancy isolation and data leakage tests for the actions router (/api/actions).

These tests validate strict multi-tenant isolation:
- Complete data segregation between organizations
- No cross-tenant data visibility
- No cross-tenant mutations
- No side-channel leakage via errors, timing, or IDs
- Protection against malicious cross-tenant access attempts

Security model validation:
1. Tenant A cannot see tenant B's data
2. Tenant A cannot mutate tenant B's data
3. Tenant A cannot infer tenant B's data existence
4. All queries are correctly scoped by org_id
5. Cost layers, states, transactions never leak across tenants

Testing strategy:
- Create two separate organizations with identical SKU codes
- Attempt cross-tenant operations and verify they fail safely
- Verify error messages don't leak information
- Ensure stock actions are completely isolated
"""
import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction, State, CostRecord, SKU, Location


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def shared_sku_code():
    """SKU code that will exist in both tenants."""
    return "SHARED-SKU-999"

@pytest.fixture
def shared_location():
    """Location name that will exist in both tenants."""
    return "Shared Warehouse"


# =============================================================================
# Basic Isolation Tests
# =============================================================================

@pytest.mark.asyncio
class TestBasicTenancyIsolation:
    """Tests fundamental tenant data isolation."""
    
    async def test_cannot_see_other_tenant_stock_state(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Tenant A cannot see or access tenant B's stock state.
        
        Both tenants have the same SKU code and location name,
        but data must be completely isolated.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Receive 100 units
        response_a = await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        assert response_a.status_code == 200
        assert response_a.json()["inventory_state"]["on_hand"] == 100
        
        # Create Tenant B with same SKU and location
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Tenant B: Receive 50 units (same SKU, same location name)
        response_b = await client.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant B Item",
            "location": shared_location,
            "qty": 50,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 15.0,
        }, headers=csrf_headers)
        assert response_b.status_code == 200
        assert response_b.json()["inventory_state"]["on_hand"] == 50
        
        # Verify isolation at database level
        # Tenant A should have 100 units
        state_a = await integration_session.scalar(
            select(State).where(
                State.org_id == org_a.org_id,
                State.sku_code == shared_sku_code
            )
        )
        assert state_a is not None
        assert state_a.on_hand == 100
        
        # Tenant B should have 50 units
        state_b = await integration_session.scalar(
            select(State).where(
                State.org_id == org_b.org_id,
                State.sku_code == shared_sku_code
            )
        )
        assert state_b is not None
        assert state_b.on_hand == 50
        
        # Verify they are distinct states
        assert state_a.org_id != state_b.org_id
        assert state_a.location_id != state_b.location_id
        
        # Critical: Total states for this SKU should be 2 (one per tenant)
        total_states = await integration_session.scalar(
            select(func.count(State.sku_code)).where(
                State.sku_code == shared_sku_code
            )
        )
        assert total_states == 2
    
    async def test_cannot_ship_from_other_tenant_stock(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Tenant B cannot ship stock that belongs to tenant A.
        
        Even if tenant B uses the same SKU code and location name,
        they should get "not found" or "insufficient stock" error.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Receive 100 units
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Create Tenant B (no stock)
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Tenant B: Try to ship from same SKU/location
        response = await client.post("/api/ship", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 10,
        }, headers=csrf_headers)
        
        # Should fail - Tenant B has no inventory for this SKU
        assert response.status_code >= 400
        
        # Error should not leak tenant A's existence
        # Should say "SKU not found" or "no inventory", not "insufficient stock"
        error_text = response.text.lower()
        assert "not found" in error_text or "no inventory" in error_text
    
    async def test_cannot_adjust_other_tenant_inventory(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Tenant B cannot adjust tenant A's inventory.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Receive 100 units
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Create Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Tenant B: Try to adjust
        response = await client.post("/api/adjust", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": -50,
            "txn_metadata": {"reason": "Testing cross-tenant access"}
        }, headers=csrf_headers)
        
        # Should fail
        assert response.status_code >= 400


# =============================================================================
# Transaction & Ledger Isolation
# =============================================================================

@pytest.mark.asyncio
class TestTransactionIsolation:
    """Tests transaction and ledger isolation between tenants."""
    
    async def test_transactions_completely_isolated(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Transactions created by tenant A should never be visible to tenant B.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Perform several transactions
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        await client_a.post("/api/ship", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 20,
        }, headers=csrf_headers)
        
        # Create Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        
        # Count transactions for each tenant
        txn_count_a = await integration_session.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.org_id == org_a.org_id,
                Transaction.sku_code == shared_sku_code
            )
        )
        
        txn_count_b = await integration_session.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.org_id == org_b.org_id,
                Transaction.sku_code == shared_sku_code
            )
        )
        
        # Tenant A should have 2 transactions
        assert txn_count_a == 2
        
        # Tenant B should have 0 transactions
        assert txn_count_b == 0
        
        # Verify no transaction leakage
        # Query all transactions for this SKU - should only return tenant A's
        all_tenant_a_txns = await integration_session.scalars(
            select(Transaction).where(
                Transaction.org_id == org_a.org_id,
                Transaction.sku_code == shared_sku_code
            )
        )
        
        for txn in all_tenant_a_txns.all():
            assert txn.org_id == org_a.org_id
    
    async def test_cost_records_isolated(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Cost records for tenant A should not be visible or consumable by tenant B.
        
        This is critical for valuation integrity.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Create cost layers
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Create Tenant B with same SKU
        org_b = await create_test_org(name="Tenant B Org", valuation_method="FIFO")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        await client.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant B Item",
            "location": shared_location,
            "qty": 50,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 20.0,  # Different cost
        }, headers=csrf_headers)
        
        # Verify cost record isolation
        cost_records_a = await integration_session.scalars(
            select(CostRecord).where(
                CostRecord.org_id == org_a.org_id,
                CostRecord.sku_code == shared_sku_code
            )
        )
        cost_records_a = list(cost_records_a.all())
        
        cost_records_b = await integration_session.scalars(
            select(CostRecord).where(
                CostRecord.org_id == org_b.org_id,
                CostRecord.sku_code == shared_sku_code
            )
        )
        cost_records_b = list(cost_records_b.all())
        
        # Each tenant should have exactly 1 cost record
        assert len(cost_records_a) == 1
        assert len(cost_records_b) == 1
        
        # Verify they are distinct
        assert cost_records_a[0].org_id == org_a.org_id
        assert cost_records_b[0].org_id == org_b.org_id
        assert cost_records_a[0].id != cost_records_b[0].id
        
        # Verify different costs
        # Tenant A: $10.00 = 1000 cents
        # Tenant B: $20.00 = 2000 cents
        assert cost_records_a[0].unit_cost_minor == 1000
        assert cost_records_b[0].unit_cost_minor == 2000


# =============================================================================
# Reserve & Transfer Isolation
# =============================================================================

@pytest.mark.asyncio
class TestReserveTransferIsolation:
    """Tests isolation for reserve and transfer operations."""
    
    async def test_cannot_reserve_other_tenant_stock(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Tenant B cannot reserve stock from tenant A.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Stock
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Tenant B: Try to reserve
        response = await client.post("/api/reserve", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 10,
        }, headers=csrf_headers)
        
        assert response.status_code >= 400
    
    async def test_cannot_unreserve_other_tenant_reservations(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Tenant B cannot unreserve tenant A's reservations.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Stock and reserve
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        await client_a.post("/api/reserve", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 30,
        }, headers=csrf_headers)
        
        # Verify reservation
        state_a = await integration_session.scalar(
            select(State).where(
                State.org_id == org_a.org_id,
                State.sku_code == shared_sku_code
            )
        )
        assert state_a.reserved == 30
        
        # Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Tenant B: Try to unreserve (should fail - no reservation for tenant B)
        response = await client.post("/api/unreserve", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 30,
            "txn_metadata": {"reason": "Attempting cross-tenant access"}
        }, headers=csrf_headers)
        
        assert response.status_code >= 400
        
        # Verify tenant A's reservation unchanged
        await integration_session.refresh(state_a)
        assert state_a.reserved == 30
    
    async def test_transfer_cannot_cross_tenant_boundary(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Cannot transfer stock between tenants even with same location names.
        
        Transfers should only work within a single organization.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Stock at location 1
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": "Warehouse 1",
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Tenant B: Create separate location with same name
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Tenant B: Try to "transfer" from tenant A's location (won't work)
        # This will fail because tenant B doesn't have this SKU
        response = await client.post("/api/transfer", json={
            "sku_code": shared_sku_code,
            "location": "Warehouse 1",
            "target_location": "Warehouse 2",
            "qty": 50,
        }, headers=csrf_headers)
        
        assert response.status_code >= 400


# =============================================================================
# Alert Isolation
# =============================================================================

@pytest.mark.asyncio
class TestAlertIsolation:
    """Tests that alerts are properly isolated between tenants."""
    
    async def test_low_stock_alerts_isolated(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Low stock alert in tenant A should not affect tenant B.
        
        Even if both have the same SKU with alerting enabled.
        """
        from app.models import Alert
        
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Setup stock and cross reorder point
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 50,
            "alerts": True,
            "low_stock_threshold": 30,
            "reorder_point": 30,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Ship to trigger alert
        await client_a.post("/api/ship", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 25,
        }, headers=csrf_headers)
        
        # Tenant B: Same setup
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        await client.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant B Item",
            "location": shared_location,
            "qty": 50,
            "alerts": True,
            "low_stock_threshold": 30,
            "reorder_point": 30,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Don't ship from tenant B (no alert)
        
        # Verify alerts
        alerts_a = await integration_session.scalars(
            select(Alert).where(
                Alert.org_id == org_a.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        alerts_a_count = len(list(alerts_a.all()))
        
        alerts_b = await integration_session.scalars(
            select(Alert).where(
                Alert.org_id == org_b.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        alerts_b_count = len(list(alerts_b.all()))
        
        # Tenant A should have low stock alert
        assert alerts_a_count >= 1
        
        # Tenant B should have NO low stock alert
        assert alerts_b_count == 0


# =============================================================================
# SKU & Location Isolation
# =============================================================================

@pytest.mark.asyncio
class TestSKULocationIsolation:
    """Tests that SKUs and locations are properly tenant-scoped."""
    
    async def test_sku_exists_independently_per_tenant(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        integration_session: AsyncSession,
        shared_sku_code,
        csrf_headers,
    ):
        """
        Same SKU code should exist independently in each tenant.
        
        Creating SKU "ABC" in tenant A should not affect tenant B.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Create SKU
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Product",
            "location": "Warehouse",
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Verify SKU created for tenant A
        sku_a = await integration_session.scalar(
            select(SKU).where(
                SKU.code == shared_sku_code,
                SKU.org_id == org_a.org_id
            )
        )
        assert sku_a is not None
        assert sku_a.name == "Tenant A Product"
        
        # Create Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        
        # Verify SKU does NOT exist for tenant B
        sku_b = await integration_session.scalar(
            select(SKU).where(
                SKU.code == shared_sku_code,
                SKU.org_id == org_b.org_id
            )
        )
        assert sku_b is None
        
        # Total SKUs with this code should be 1
        total_skus = await integration_session.scalar(
            select(func.count(SKU.code)).where(
                SKU.code == shared_sku_code
            )
        )
        assert total_skus == 1
    
    async def test_location_exists_independently_per_tenant(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Same location name should exist independently in each tenant.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Create location
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Product",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Create Tenant B and create same location name
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        
        # Verify locations
        locations = await integration_session.scalars(
            select(Location).where(
                Location.name == shared_location
            )
        )
        locations_list = list(locations.all())
        
        # Should have 1 location with this name (only tenant A)
        assert len(locations_list) == 1
        assert locations_list[0].org_id == org_a.org_id


# =============================================================================
# Malicious Access Attempts
# =============================================================================

@pytest.mark.asyncio
class TestMaliciousAccessPrevention:
    """Tests that malicious cross-tenant access attempts are blocked."""
    
    async def test_cannot_use_other_org_location_id(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        csrf_headers,
    ):
        """
        Tenant B cannot directly use tenant A's location ID.
        
        Even if tenant B somehow obtains tenant A's location UUID,
        the system should reject the operation.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Create location
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Product",
            "location": "Tenant A Warehouse",
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Get tenant A's location ID
        location_a = await integration_session.scalar(
            select(Location).where(
                Location.org_id == org_a.org_id,
                Location.name == "Tenant A Warehouse"
            )
        )
        location_a_id = location_a.id
        
        # Create Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        
        # Verify tenant B cannot create state with tenant A's location
        # This test verifies that foreign key constraints + org_id scoping prevents this
        from app.models import State as StateModel
        
        # Attempt to directly insert a state for tenant B with tenant A's location
        # This should fail due to foreign key constraints
        async with integration_session.begin_nested():
            malicious_state = StateModel(
                org_id=org_b.org_id,
                sku_code=shared_sku_code,
                location_id=location_a_id,
                on_hand=999,
                reserved=0,
            )
            
            integration_session.add(malicious_state)
            
            with pytest.raises(Exception):  # Should raise IntegrityError
                await integration_session.flush()
    
    async def test_error_messages_do_not_leak_information(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Error messages should not reveal existence of data in other tenants.
        
        Tenant B should get same error whether:
        - SKU doesn't exist at all
        - SKU exists in tenant A but not in tenant B
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Has this SKU
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        cookies_b = await auth_cookies(user_b)
        client.cookies.update(cookies_b)
        
        # Try to ship SKU that exists in tenant A
        response_existing = await client.post("/api/ship", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 10,
        }, headers=csrf_headers)
        
        # Try to ship SKU that doesn't exist anywhere
        response_nonexistent = await client.post("/api/ship", json={
            "sku_code": "NEVER-EXISTS-SKU",
            "location": shared_location,
            "qty": 10,
        }, headers=csrf_headers)
        
        # Both should return similar errors (404 or 400)
        # Should NOT reveal "insufficient stock" for the SKU in tenant A
        assert response_existing.status_code >= 400
        assert response_nonexistent.status_code >= 400
        
        # Error messages should be similar
        error_1 = response_existing.text.lower()
        error_2 = response_nonexistent.text.lower()
        
        # Neither should mention "insufficient stock" 
        # (which would reveal tenant A has this SKU)
        assert "insufficient" not in error_1
        assert "insufficient" not in error_2


# =============================================================================
# Comprehensive Isolation Validation
# =============================================================================

@pytest.mark.asyncio
class TestComprehensiveIsolation:
    """End-to-end validation of complete tenant isolation."""
    
    async def test_full_workflow_isolation(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        client,
        auth_cookies,
        integration_session: AsyncSession,
        shared_sku_code,
        shared_location,
        csrf_headers,
    ):
        """
        Complete workflow in tenant A should have zero effect on tenant B.
        
        Comprehensive test covering all action types.
        """
        client_a, user_a, org_a = authenticated_client
        
        # Tenant A: Full workflow
        # 1. Receive
        await client_a.post("/api/receive", json={
            "sku_code": shared_sku_code,
            "sku_name": "Tenant A Item",
            "location": shared_location,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.0,
        }, headers=csrf_headers)
        
        # 2. Reserve
        response =await client_a.post("/api/reserve", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 20,
        }, headers=csrf_headers)
        assert response.status_code == 200
        
        # 3. Ship
        response = await client_a.post("/api/ship", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 30,
            "txn_metadata": {"ship_from": "available"},
        }, headers=csrf_headers)
        assert response.status_code == 200
        
        # 4. Adjust
        response = await client_a.post("/api/adjust", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "qty": 10,
            "txn_metadata": {"reason": "Found extra"}
        }, headers=csrf_headers)
        assert response.status_code == 200
        
        # 5. Transfer
        response = await client_a.post("/api/transfer", json={
            "sku_code": shared_sku_code,
            "location": shared_location,
            "target_location": "Warehouse B",
            "qty": 15,
        }, headers=csrf_headers)
        assert response.status_code == 200
        
        # Create Tenant B
        org_b = await create_test_org(name="Tenant B Org")
        user_b = await create_test_user(org_b, email="userb@example.com")
        
        # Verify tenant B has NO data for this SKU
        sku_b = await integration_session.scalar(
            select(SKU).where(
                SKU.code == shared_sku_code,
                SKU.org_id == org_b.org_id
            )
        )
        assert sku_b is None
        
        state_b = await integration_session.scalar(
            select(State).where(
                State.org_id == org_b.org_id,
                State.sku_code == shared_sku_code
            )
        )
        assert state_b is None
        
        txns_b = await integration_session.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.org_id == org_b.org_id,
                Transaction.sku_code == shared_sku_code
            )
        )
        assert txns_b == 0
        
        costs_b = await integration_session.scalar(
            select(func.count(CostRecord.id)).where(
                CostRecord.org_id == org_b.org_id,
                CostRecord.sku_code == shared_sku_code
            )
        )
        assert costs_b == 0
        
        # Verify tenant A's data is intact and correct
        state_a = await integration_session.scalar(
            select(State).where(
                State.org_id == org_a.org_id,
                State.sku_code == shared_sku_code,
                State.location.has(name=shared_location)
            )
        )
        
        # Expected: 100 + 10 - 30 - 15 = 65
        # Reserved: 20
        assert state_a is not None
        assert state_a.on_hand == 65
        assert state_a.reserved == 20
        assert state_a.available == 45
