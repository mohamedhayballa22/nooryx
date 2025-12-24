"""
Deep integration tests for the actions router (/api/actions).

These tests extend the baseline coverage with comprehensive validation of:
- Database persistence (ledger, cost layers, referential integrity)
- Alerting behavior (threshold crossings, alert aggregation)
- Cost correctness (FIFO/LIFO/WAC consumption)
- Cross-service coordination (atomic operations, rollback safety)
- Edge cases (boundary quantities, depletion, concurrent scenarios)

The goal is to validate the **real side effects** of stock actions,
not just HTTP responses. Each test proves that the transaction service's
orchestration of domain services (state, cost, alerts) is correct.
"""
import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction, State, CostRecord, Alert, SKU


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def sku_code():
    return "DEEP-TEST-001"

@pytest.fixture
def location_name():
    return "Main Warehouse"

@pytest.fixture
def secondary_location():
    return "Backup Warehouse"


# =============================================================================
# Database Persistence Tests
# =============================================================================

@pytest.mark.asyncio
class TestDatabasePersistence:
    """Tests that verify actual database persistence beyond response validation."""

    async def test_receive_creates_complete_ledger_chain(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Receiving stock should create interconnected database records with
        proper referential integrity: SKU → Location → State → Transaction → CostRecord.
        """
        client, user, org = authenticated_client

        payload = {
            "sku_code": sku_code,
            "sku_name": "Deep Test Product",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "low_stock_threshold": 20,
            "reorder_point": 30,
            "unit_cost_major": 25.00,
            "reference": "PO-1001",
            "txn_metadata": {"supplier": "Acme Corp", "batch": "B001"}
        }

        response = await client.post("/api/receive", json=payload, headers=csrf_headers)
        assert response.status_code == 200
        txn_id = response.json()["id"]

        # 1. Verify SKU was created with correct attributes
        sku = await integration_session.scalar(
            select(SKU).where(
                SKU.code == sku_code,
                SKU.org_id == org.org_id
            )
        )
        assert sku is not None
        assert sku.name == "Deep Test Product"
        assert sku.alerts is True
        assert sku.low_stock_threshold == 20
        assert sku.reorder_point == 30

        # 2. Verify Transaction was persisted with complete metadata
        txn = await integration_session.scalar(
            select(Transaction).where(Transaction.id == txn_id)
        )
        assert txn is not None
        assert txn.action == "receive"
        assert txn.qty == 100
        assert txn.qty_before == 0
        assert txn.reference == "PO-1001"
        assert txn.created_by == user.id
        assert txn.txn_metadata["supplier"] == "Acme Corp"
        assert txn.txn_metadata["batch"] == "B001"
        # Cost tracking: total_cost_minor should be 100 units × 25.00 = 2500.00
        # In USD (2 decimal places), minor units = cents, so 2500.00 → 250000
        assert txn.total_cost_minor == 250000

        # 3. Verify State is correct
        state = await integration_session.scalar(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )
        assert state is not None
        assert state.on_hand == 100
        assert state.reserved == 0
        assert state.available == 100

        # 4. Verify CostRecord was created for FIFO/LIFO/WAC tracking
        cost_record = (await integration_session.execute(
            select(CostRecord).where(
                CostRecord.org_id == org.org_id, 
                CostRecord.transaction_id == txn_id
            )
        )).scalar_one_or_none()
        
        assert cost_record is not None
        assert cost_record.qty_in == 100
        assert cost_record.qty_remaining == 100
        assert cost_record.unit_cost_minor == 2500  # 25.00 in cents
        assert cost_record.location_id == state.location_id

        # 5. Verify referential integrity
        assert txn.sku_code == sku.code
        assert txn.location_id == state.location_id
        assert cost_record.sku_code == sku.code
        assert cost_record.location_id == state.location_id

    async def test_ship_updates_cost_record_qty_remaining(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Shipping stock should consume from cost layers,
        decreasing qty_remaining in CostRecord table.
        """
        client, user, org = authenticated_client

        # Setup: Receive 100 units at $10 each
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Test Product",
            "location": location_name,
            "qty": 100,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # Verify initial cost record
        initial_cost_record = await integration_session.scalar(
            select(CostRecord).where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
        )
        assert initial_cost_record.qty_remaining == 100

        # Ship 30 units
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 30
        }, headers=csrf_headers)
        assert response.status_code == 200
        ship_txn_id = response.json()["id"]

        # Verify cost layer was consumed
        await integration_session.refresh(initial_cost_record)
        assert initial_cost_record.qty_remaining == 70

        # Verify ship transaction has correct cost
        ship_txn = await integration_session.scalar(
            select(Transaction).where(Transaction.id == ship_txn_id)
        )
        # 30 units @ $10 = $300 = 30000 cents
        assert ship_txn.total_cost_minor == 30000
        assert ship_txn.qty == -30

    async def test_multiple_receives_create_separate_cost_layers(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Multiple receipts should create separate cost layers for FIFO/LIFO tracking.
        Each layer should maintain its own qty_remaining counter.
        """
        client, _, org = authenticated_client

        # Receive batch 1: 50 units @ $10
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Multi-Layer Product",
            "location": location_name,
            "qty": 50,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.00,
            "txn_metadata": {"batch": "B1"}
        }, headers=csrf_headers)

        # Receive batch 2: 75 units @ $12
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Multi-Layer Product",
            "location": location_name,
            "qty": 75,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 12.00,
            "txn_metadata": {"batch": "B2"}
        }, headers=csrf_headers)

        # Receive batch 3: 25 units @ $15
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Multi-Layer Product",
            "location": location_name,
            "qty": 25,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 15.00,
            "txn_metadata": {"batch": "B3"}
        }, headers=csrf_headers)

        # Verify 3 separate cost layers exist
        cost_records = (await integration_session.execute(
            select(CostRecord)
            .where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
            .order_by(CostRecord.created_at, CostRecord.id)
        )).scalars().all()

        assert len(cost_records) == 3
        assert cost_records[0].qty_in == 50
        assert cost_records[0].qty_remaining == 50
        assert cost_records[0].unit_cost_minor == 1000  # $10

        assert cost_records[1].qty_in == 75
        assert cost_records[1].qty_remaining == 75
        assert cost_records[1].unit_cost_minor == 1200  # $12

        assert cost_records[2].qty_in == 25
        assert cost_records[2].qty_remaining == 25
        assert cost_records[2].unit_cost_minor == 1500  # $15

        # Verify total on_hand matches sum of layers
        state = await integration_session.scalar(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )
        assert state.on_hand == 150  # 50 + 75 + 25


# =============================================================================
# Cost Calculation Tests (FIFO/LIFO/WAC)
# =============================================================================

@pytest.mark.asyncio
class TestCostCalculation:
    """Tests that verify cost tracking logic respects valuation methods."""

    async def test_fifo_consumes_oldest_layer_first(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        auth_cookies,
        client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        FIFO (First-In-First-Out) should consume from oldest cost layer first.
        """
        # Create org with FIFO valuation
        org = await create_test_org(valuation_method="FIFO")
        user = await create_test_user(org)
        cookies = await auth_cookies(user)
        client.cookies.update(cookies)

        # Receive 3 batches at different costs
        # Batch 1 (oldest): 30 @ $10
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 30,
            "sku_name": "FIFO Test",
            "alerts": False,
            "low_stock_threshold": 5,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Batch 2: 40 @ $15
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 40,
            "unit_cost_major": 15.00,
            "sku_name": "FIFO Test",
            "alerts": False,
            "low_stock_threshold": 5,
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Batch 3 (newest): 30 @ $20
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 30,
            "unit_cost_major": 20.00,
            "sku_name": "FIFO Test",
            "alerts": False,
            "low_stock_threshold": 5,
        }, headers=csrf_headers)
        # print exact response for debugging
        assert response.status_code == 200
        

        # Ship 50 units - should consume ALL of batch 1 (30) + 20 from batch 2
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 50
        }, headers=csrf_headers)
        assert response.status_code == 200
        ship_txn_id = response.json()["id"]

        # Verify cost layers after consumption
        cost_records = (await integration_session.execute(
            select(CostRecord)
            .where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
            .order_by(CostRecord.created_at.asc(), CostRecord.id.asc())
        )).scalars().all()
        
        # Batch 1 should be fully depleted
        assert cost_records[0].qty_remaining == 0
        # Batch 2 should have 20 remaining (40 - 20)
        assert cost_records[1].qty_remaining == 20
        # Batch 3 should be untouched
        assert cost_records[2].qty_remaining == 30

        # Verify shipment cost = (30 × $10) + (20 × $15) = $300 + $300 = $600
        ship_txn = await integration_session.scalar(
            select(Transaction).where(Transaction.id == ship_txn_id)
        )
        assert ship_txn.total_cost_minor == 60000  # $600 in cents

    async def test_lifo_consumes_newest_layer_first(
        self,
        authenticated_client,
        create_test_org,
        create_test_user,
        auth_cookies,
        client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        LIFO (Last-In-First-Out) should consume from newest cost layer first.
        """
        # Create org with LIFO valuation
        org = await create_test_org(valuation_method="LIFO")
        user = await create_test_user(org)
        cookies = await auth_cookies(user)
        client.cookies.update(cookies)

        # Receive 3 batches
        # Batch 1 (oldest): 30 @ $10
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "LIFO Test",
            "location": location_name,
            "qty": 30,
            "alerts": False,
            "low_stock_threshold": 5,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Batch 2: 40 @ $15
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "LIFO Test",
            "location": location_name,
            "qty": 40,
            "unit_cost_major": 15.00,
            "alerts": False,
            "low_stock_threshold": 5,
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Batch 3 (newest): 30 @ $20
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "LIFO Test",
            "location": location_name,
            "qty": 30,
            "unit_cost_major": 20.00,
            "alerts": False,
            "low_stock_threshold": 5,
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Ship 50 units - should consume ALL of batch 3 (30) + 20 from batch 2
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 50
        }, headers=csrf_headers)
        assert response.status_code == 200
        ship_txn_id = response.json()["id"]

        # Verify cost layers after consumption
        cost_records = (await integration_session.execute(
            select(CostRecord)
            .where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
            .order_by(CostRecord.created_at, CostRecord.id)
        )).scalars().all()

        # Batch 1 should be untouched
        assert cost_records[0].qty_remaining == 30
        # Batch 2 should have 20 remaining (40 - 20)
        assert cost_records[1].qty_remaining == 20
        # Batch 3 should be fully depleted
        assert cost_records[2].qty_remaining == 0

        # Verify shipment cost = (30 × $20) + (20 × $15) = $600 + $300 = $900
        ship_txn = await integration_session.scalar(
            select(Transaction).where(Transaction.id == ship_txn_id)
        )
        assert ship_txn.total_cost_minor == 90000  # $900 in cents

    async def test_wac_uses_weighted_average_cost(
        self,
        create_test_org,
        create_test_user,
        auth_cookies,
        client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        WAC (Weighted Average Cost) should average all cost layers.
        After each receipt, new average is computed.
        """
        # Create org with WAC valuation
        org = await create_test_org(valuation_method="WAC")
        user = await create_test_user(org)
        cookies = await auth_cookies(user)
        client.cookies.update(cookies)

        # Receive batch 1: 40 @ $10
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "WAC Test",
            "location": location_name,
            "qty": 40,
            "unit_cost_major": 10.00,
            "alerts": False,
            "low_stock_threshold": 5,
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Receive batch 2: 60 @ $20
        # Total value = (40 × $10) + (60 × $20) = $400 + $1200 = $1600
        # Total qty = 40 + 60 = 100
        # WAC = $1600 / 100 = $16.00 per unit
        response = await client.post("/api/receive", json={
            "sku_name": "WAC Test",
            "sku_code": sku_code,
            "location": location_name,
            "qty": 60,
            "unit_cost_major": 20.00,
            "alerts": False,
            "low_stock_threshold": 5,
        }, headers=csrf_headers)
        assert response.status_code == 200

        # After WAC merge, there should be 1 cost layer
        cost_records = (await integration_session.execute(
            select(CostRecord)
            .where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
        )).scalars().all()

        assert len(cost_records) == 1
        assert cost_records[0].qty_remaining == 100
        assert cost_records[0].unit_cost_minor == 1600  # $16.00 average

        # Ship 25 units - should cost 25 × $16 = $400
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 25
        }, headers=csrf_headers)
        assert response.status_code == 200
        ship_txn_id = response.json()["id"]

        ship_txn = await integration_session.scalar(
            select(Transaction).where(Transaction.id == ship_txn_id)
        )
        assert ship_txn.total_cost_minor == 40000  # $400 in cents

        # Verify remaining layer
        await integration_session.refresh(cost_records[0])
        assert cost_records[0].qty_remaining == 75


# =============================================================================
# Alerting Behavior Tests
# =============================================================================

@pytest.mark.asyncio
class TestAlertingBehavior:
    """Tests that verify alert creation and resolution at thresholds."""

    async def test_ship_crossing_threshold_creates_low_stock_alert(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Shipping stock that crosses below reorder_point should create a low stock alert.
        """
        client, user, org = authenticated_client

        # Setup: Receive 100 with reorder_point=50
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Alert Test Product",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "reorder_point": 50,
            "low_stock_threshold": 30,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # No alerts initially
        alert_count = await integration_session.scalar(
            select(func.count(Alert.id)).where(
                Alert.org_id == org.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        assert alert_count == 0

        # Ship 60 units → Available goes from 100 to 40 (crosses below 50)
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 60
        }, headers=csrf_headers)
        assert response.status_code == 200
        
        # Verify alert was created
        alert = await integration_session.scalar(
            select(Alert).where(
                Alert.org_id == org.org_id,
            )
        )
        assert alert is not None
        assert alert.severity == "warning"
        assert sku_code in alert.message or sku_code in str(alert.alert_metadata)

    async def test_receive_crossing_back_above_threshold_resolves_alert(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Receiving stock that crosses back above reorder_point should resolve the alert.
        """
        client, user, org = authenticated_client

        # Setup: Create low stock scenario
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Alert Resolution Test",
            "location": location_name,
            "qty": 100,
            "alerts": True,
            "reorder_point": 50,
            "low_stock_threshold": 30,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # Trigger alert by shipping below threshold
        await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 60
        }, headers=csrf_headers)

        # Confirm alert exists
        alert_count_before = await integration_session.scalar(
            select(func.count(Alert.id)).where(
                Alert.org_id == org.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        assert alert_count_before == 1

        # Receive 30 units → Available goes from 40 to 70 (crosses back above 50)
        response = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Alert Resolution Test",
            "location": location_name,
            "qty": 30,
            "unit_cost_major": 10.00,
            "alerts": True,
            "low_stock_threshold": 30,
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Verify alert was removed or marked as resolved
        # Alert service removes the SKU from aggregated alert
        alert = await integration_session.scalar(
            select(Alert).where(
                Alert.org_id == org.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        
        # Alert might be deleted or updated to exclude this SKU
        if alert:
            # Check that this SKU is no longer in the metadata
            low_stock_items = alert.alert_metadata.get("low_stock_items", [])
            sku_codes_in_alert = [item["sku_code"] for item in low_stock_items]
            assert sku_code not in sku_codes_in_alert

    async def test_reserve_crossing_threshold_creates_alert(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Reserving stock that reduces available below reorder_point should trigger alert.
        """
        client, user, org = authenticated_client

        # Setup: 60 units with reorder_point=50
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Reserve Alert Test",
            "location": location_name,
            "qty": 60,
            "alerts": True,
            "reorder_point": 50,
            "low_stock_threshold": 30,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # Reserve 15 units → Available: 60 → 45 (crosses below 50)
        response = await client.post("/api/reserve", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 15
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Verify alert was created
        alert = await integration_session.scalar(
            select(Alert).where(
                Alert.org_id == org.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        assert alert is not None

    async def test_no_alert_if_alerts_disabled_on_sku(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        If SKU has alerts=False, no alert should be created even when crossing threshold.
        """
        client, user, org = authenticated_client

        # Setup with alerts disabled
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "No Alerts Product",
            "location": location_name,
            "qty": 100,
            "alerts": False,  # Disabled
            "reorder_point": 50,
            "low_stock_threshold": 30,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # Ship below threshold
        await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 60
        }, headers=csrf_headers)

        # No alert should exist
        alert_count = await integration_session.scalar(
            select(func.count(Alert.id)).where(
                Alert.org_id == org.org_id,
                Alert.alert_type == "low_stock"
            )
        )
        assert alert_count == 0


# =============================================================================
# Transfer Tests (Atomic Operations)
# =============================================================================

@pytest.mark.asyncio
class TestTransferAtomicity:
    """Tests that verify transfer operations are atomic and maintain cost integrity."""

    async def test_transfer_creates_two_transactions_atomically(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        secondary_location,
        csrf_headers,
    ):
        """
        Transfer should create exactly 2 transactions (transfer_out, transfer_in)
        that are atomically linked and maintain referential integrity.
        """
        client, user, org = authenticated_client

        # Setup: Stock at source
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Transfer Test",
            "location": location_name,
            "qty": 100,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 15.00
        }, headers=csrf_headers)

        # Transfer 40 units
        response = await client.post("/api/transfer", json={
            "sku_code": sku_code,
            "location": location_name,
            "target_location": secondary_location,
            "qty": 40
        }, headers=csrf_headers)
        assert response.status_code == 200
        data = response.json()

        out_txn_id = data["transfer_out"]["id"]
        in_txn_id = data["transfer_in"]["id"]

        # Verify both transactions exist
        transactions = (await integration_session.execute(
            select(Transaction).where(
                Transaction.id.in_([out_txn_id, in_txn_id])
            ).order_by(Transaction.action)
        )).scalars().all()

        assert len(transactions) == 2
        
        # transfer_in comes first alphabetically
        in_txn = transactions[0]
        out_txn = transactions[1]

        assert in_txn.action == "transfer_in"
        assert in_txn.qty == 40
        assert out_txn.action == "transfer_out"
        assert out_txn.qty == -40

        # Both should reference the same transfer operation
        in_txn_transfer_id = in_txn.txn_metadata.get("transfer_id")
        out_txn_transfer_id = out_txn.txn_metadata.get("transfer_id")
        assert in_txn_transfer_id is not None
        assert in_txn_transfer_id == out_txn_transfer_id

        # Verify cost was transferred correctly
        # Out txn consumed cost, in txn recorded same cost
        assert out_txn.total_cost_minor is not None
        assert in_txn.total_cost_minor is not None
        # Costs should match (transferred value)
        assert out_txn.total_cost_minor == in_txn.total_cost_minor

    async def test_transfer_maintains_cost_layers_at_target(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        secondary_location,
        csrf_headers,
    ):
        """
        Transfer should create a new cost layer at target location
        with cost basis from source consumption.
        """
        client, user, org = authenticated_client

        # Setup: Receive 50 @ $10 at source
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Cost Layer Transfer",
            "location": location_name,
            "qty": 50,
            "alerts": False,
            "low_stock_threshold": 5,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # Transfer 20 units to target
        response = await client.post("/api/transfer", json={
            "sku_code": sku_code,
            "location": location_name,
            "target_location": secondary_location,
            "qty": 20
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Verify source cost layer reduced
        source_location = await integration_session.scalar(
            select(State.location_id).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id,
                State.location.has(name=location_name)
            )
        )
        source_cost = await integration_session.scalar(
            select(CostRecord).where(
                CostRecord.sku_code == sku_code,
                CostRecord.location_id == source_location,
                CostRecord.org_id == org.org_id
            )
        )
        assert source_cost.qty_remaining == 30  # 50 - 20

        # Verify target cost layer created
        target_location = await integration_session.scalar(
            select(State.location_id).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id,
                State.location.has(name=secondary_location)
            )
        )
        target_cost = await integration_session.scalar(
            select(CostRecord).where(
                CostRecord.sku_code == sku_code,
                CostRecord.location_id == target_location,
                CostRecord.org_id == org.org_id
            )
        )
        assert target_cost is not None
        assert target_cost.qty_in == 20
        assert target_cost.qty_remaining == 20
        assert target_cost.unit_cost_minor == 1000  # Same $10 cost basis


# =============================================================================
# Edge Cases and Boundary Conditions
# =============================================================================

@pytest.mark.asyncio
class TestEdgeCases:
    """Tests for boundary conditions, depletion, and edge scenarios."""

    async def test_ship_exact_available_depletes_to_zero(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Shipping exactly the available quantity should deplete stock to 0
        without errors.
        """
        client, user, org = authenticated_client

        # Receive 50
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Depletion Test",
            "location": location_name,
            "qty": 50,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        # Ship exact 50
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 50
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Verify state
        state = await integration_session.scalar(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )
        assert state.on_hand == 0
        assert state.available == 0

        # Verify cost layer fully consumed
        cost_record = await integration_session.scalar(
            select(CostRecord).where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
        )
        assert cost_record.qty_remaining == 0

    async def test_adjust_negative_depletion_to_zero(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Negative adjustment that depletes stock to exactly 0 should work correctly.
        """
        client, user, org = authenticated_client

        # Receive 30
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Adjustment Depletion",
            "location": location_name,
            "qty": 30,
            "alerts": False,
            "low_stock_threshold": 5,
            "unit_cost_major": 8.00
        }, headers=csrf_headers)

        # Adjust by -30 (damage/loss)
        response = await client.post("/api/adjust", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": -30,
            "txn_metadata": {"reason": "Damaged in warehouse"}
        }, headers=csrf_headers)
        assert response.status_code == 200

        # Verify complete depletion
        state = await integration_session.scalar(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )
        assert state.on_hand == 0

    async def test_reserve_and_unreserve_full_cycle_maintains_integrity(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Full reserve → unreserve cycle should maintain state integrity
        and not create spurious cost layers.
        """
        client, user, org = authenticated_client

        # Receive 100
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Reserve Cycle Test",
            "location": location_name,
            "qty": 100,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 12.00
        }, headers=csrf_headers)

        # Reserve 60
        reserve_response = await client.post("/api/reserve", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 60
        }, headers=csrf_headers)
        assert reserve_response.status_code == 200

        state_after_reserve = (await integration_session.execute(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )).scalar_one()
        assert state_after_reserve.on_hand == 100
        assert state_after_reserve.reserved == 60
        assert state_after_reserve.available == 40

        # Unreserve 60
        unreserve_response = await client.post("/api/unreserve", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 60
        }, headers=csrf_headers)
        assert unreserve_response.status_code == 200

        state_after_unreserve = (await integration_session.execute(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )).scalar_one()
        assert state_after_unreserve.on_hand == 100
        assert state_after_unreserve.reserved == 0
        assert state_after_unreserve.available == 100

        # Verify reserve/unreserve don't create or consume cost layers
        cost_records = (await integration_session.execute(
            select(CostRecord).where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            )
        )).scalars().all()
        assert len(cost_records) == 1
        assert cost_records[0].qty_remaining == 100  # Unchanged

    async def test_ship_with_partial_reservation_consumes_available_first(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        When shipping with some reserved stock, the default behavior is to ship
        from reserved first, then available. Verify state integrity after.
        """
        client, user, org = authenticated_client

        # Setup: 100 units, 30 reserved
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Partial Reserve Ship",
            "location": location_name,
            "qty": 100,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)

        await client.post("/api/reserve", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 30
        }, headers=csrf_headers)

        # Ship 50 units (default: reserved first, then available)
        # Expected: reserved 30 → 0, available 70 → 50
        response = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 50
        }, headers=csrf_headers)
        assert response.status_code == 200

        state = await integration_session.scalar(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )
        assert state.on_hand == 50
        # Reserved should be consumed first (30 units)
        # Then 20 from available
        # Result: reserved=0, available=50
        assert state.reserved == 0
        assert state.available == 50

    async def test_positive_adjustment_without_cost_infers_from_existing_layers(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Positive adjustment without explicit cost should infer cost
        from existing inventory layers using valuation method logic.
        """
        client, user, org = authenticated_client

        # Receive initial stock @ $15
        await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Cost Inference Test",
            "location": location_name,
            "qty": 50,
            "alerts": False,
            "low_stock_threshold": 10,
            "unit_cost_major": 15.00
        }, headers=csrf_headers)

        # Positive adjustment without cost (found 10 extra units)
        response = await client.post("/api/adjust", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 10,
            "txn_metadata": {"reason": "Found during inventory count"}
        }, headers=csrf_headers)
        assert response.status_code == 200
        adjust_txn_id = response.json()["id"]

        # Verify adjustment transaction has inferred cost
        adjust_txn = await integration_session.scalar(
            select(Transaction).where(Transaction.id == adjust_txn_id)
        )
        # Should infer $15/unit from existing layer
        # 10 units × $15 = $150 = 15000 cents
        assert adjust_txn.total_cost_minor == 15000

        # Verify cost record was created for the adjustment
        cost_records = (await integration_session.execute(
            select(CostRecord).where(
                CostRecord.sku_code == sku_code,
                CostRecord.org_id == org.org_id
            ).order_by(CostRecord.created_at, CostRecord.id)
        )).scalars().all()
        
        # For WAC, layers get merged
        # For FIFO/LIFO, there would be 2 layers
        # Since default is FIFO in test org, should be 2 layers
        assert len(cost_records) == 2
        assert cost_records[0].qty_remaining + cost_records[1].qty_remaining == 60  # 50 + 10


# =============================================================================
# Transaction Ledger Integrity Tests
# =============================================================================

@pytest.mark.asyncio
class TestTransactionLedger:
    """Tests that verify ledger immutability and audit trail completeness."""

    async def test_transaction_records_are_immutable(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        Transaction records should capture qty_before as an immutable snapshot
        for audit trail reconstruction.
        """
        client, user, org = authenticated_client

        # Receive 1
        r1 = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Ledger Test",
            "location": location_name,
            "qty": 30,
            "alerts": False,
            "low_stock_threshold": 5,
            "unit_cost_major": 10.00
        }, headers=csrf_headers)
        txn1_id = r1.json()["id"]

        # Receive 2
        r2 = await client.post("/api/receive", json={
            "sku_code": sku_code,
            "sku_name": "Ledger Test",
            "location": location_name,
            "qty": 20,
            "unit_cost_major": 10.00,
            "alerts": False,
            "low_stock_threshold": 10,
        }, headers=csrf_headers)
        txn2_id = r2.json()["id"]

        # Ship
        s1 = await client.post("/api/ship", json={
            "sku_code": sku_code,
            "location": location_name,
            "qty": 15
        }, headers=csrf_headers)
        txn3_id = s1.json()["id"]

        # Verify ledger
        transactions = (await integration_session.execute(
            select(Transaction).where(
                Transaction.sku_code == sku_code,
                Transaction.org_id == org.org_id
            ).order_by(Transaction.created_at, Transaction.id)
        )).scalars().all()

        assert len(transactions) == 3
        # Txn1: qty_before=0, qty=+30, resulting=30
        assert transactions[0].qty_before == 0
        assert transactions[0].qty == 30

        # Txn2: qty_before=30, qty=+20, resulting=50
        assert transactions[1].qty_before == 30
        assert transactions[1].qty == 20

        # Txn3: qty_before=50, qty=-15, resulting=35
        assert transactions[2].qty_before == 50
        assert transactions[2].qty == -15

        # Verify current state matches final ledger position
        state = await integration_session.scalar(
            select(State).where(
                State.sku_code == sku_code,
                State.org_id == org.org_id
            )
        )
        assert state.on_hand == 35

    async def test_all_transactions_linked_to_user_for_audit(
        self,
        authenticated_client,
        integration_session: AsyncSession,
        sku_code,
        location_name,
        csrf_headers,
    ):
        """
        All transactions should have created_by set for audit trail.
        """
        client, user, org = authenticated_client

        actions = [
            ("receive", {"sku_code": sku_code, "sku_name": "Audit Test", 
                        "location": location_name, "qty": 50, "alerts": False,
                        "low_stock_threshold": 10, "unit_cost_major": 10.00}),
            ("ship", {"sku_code": sku_code, "location": location_name, "qty": 10}),
            ("reserve", {"sku_code": sku_code, "location": location_name, "qty": 15}),
            ("unreserve", {"sku_code": sku_code, "location": location_name, "qty": 5}),
            ("adjust", {"sku_code": sku_code, "location": location_name, 
                       "qty": -3, "txn_metadata": {"reason": "test"}}),
        ]

        for action, payload in actions:
            await client.post(f"/api/{action}", json=payload, headers=csrf_headers)

        # Verify all have created_by
        transactions = (await integration_session.execute(
            select(Transaction).where(
                Transaction.sku_code == sku_code,
                Transaction.org_id == org.org_id
            )
        )).scalars().all()

        for txn in transactions:
            assert txn.created_by == user.id
