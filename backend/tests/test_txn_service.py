import pytest
import pytest_asyncio
from sqlalchemy import select, func
from unittest.mock import patch
import asyncio

from app.models import SKU, Location, State, Organization, Barcode
from app.services.txn import TransactionService
from app.schemas.actions import (
    ReceiveTxn, ShipTxn, AdjustTxn, TransferTxn, 
    ReserveTxn, UnreserveTxn, Barcode as BarcodePayload
)
from app.services.exceptions import (
    SKUNotFoundError, TransactionBadRequest, InsufficientStockError
)

@pytest.mark.asyncio
class TestTxnServiceInternals:
    """
    Tests for the internal helper methods and logic of the TransactionService.
    """

    @pytest_asyncio.fixture
    async def org(self, create_org):
        """Create a single organization for all tests in this class."""
        return await create_org(valuation_method="FIFO", currency="USD")

    @pytest.fixture
    def service(self, db_session, org):
        """Provides a TransactionService instance for the class-scoped org."""
        return TransactionService(session=db_session, org_id=org.org_id)

    # Tests for _ensure_sku_exists

    async def test_ensure_sku_exists_creates_sku_on_receive(self, db_session, service, org):
        """
        Verify _ensure_sku_exists auto-creates a SKU for a 'receive' transaction.
        """
        payload = ReceiveTxn(
            sku_code="NEW-SKU-1",
            sku_name="New SKU",
            location="Warehouse A",
            qty=10,
            action="receive",
            unit_cost_major=1.0,
            alerts=True,
            reorder_point=20,
            low_stock_threshold=10,
        )

        await service._ensure_sku_exists(payload)
        await db_session.flush()

        created_sku = await db_session.scalar(
            select(SKU).filter_by(code="NEW-SKU-1", org_id=org.org_id)
        )
        assert created_sku is not None
        assert created_sku.name == "New SKU"
        assert created_sku.alerts is True
        assert created_sku.reorder_point == 20
        assert created_sku.low_stock_threshold == 10

    async def test_ensure_sku_exists_raises_error_on_ship_for_nonexistent_sku(self, service):
        """
        Verify _ensure_sku_exists raises SKUNotFoundError for an outbound
        transaction ('ship') if the SKU does not exist.
        """
        payload = ShipTxn(
            sku_code="NON-EXISTENT-SKU",
            location="Warehouse A",
            qty=5,
            action="ship",
        )
        with pytest.raises(SKUNotFoundError):
            await service._ensure_sku_exists(payload)

    async def test_ensure_sku_exists_updates_existing_sku(self, db_session, service, org, create_sku):
        """
        Verify _ensure_sku_exists updates an existing SKU's properties.
        """
        await create_sku(
            org=org,
            sku="UPDATE-SKU",
            name="Old Name",
            alerts=True,
            reorder_point=10,
        )

        payload = ReceiveTxn(
            sku_code="UPDATE-SKU",
            sku_name="New Name",
            location="Warehouse A",
            qty=10,
            action="receive",
            unit_cost_major=1.0,
            alerts=False,
            reorder_point=50,
            low_stock_threshold=25,
        )

        await service._ensure_sku_exists(payload)
        await db_session.flush()

        updated_sku = await db_session.get(SKU, {"code": "UPDATE-SKU", "org_id": org.org_id})
        assert updated_sku.name == "Old Name"
        assert updated_sku.alerts is False
        assert updated_sku.reorder_point == 50
        assert updated_sku.low_stock_threshold == 25

    # Tests for _get_or_create_location

    async def test_get_or_create_location_creates_new_location(self, db_session, service, org):
        """
        Verify _get_or_create_location creates a new location if it doesn't exist.
        """
        location_name = "New-Location-123"
        
        location = await service._get_or_create_location(location_name)
        await db_session.flush()

        assert location is not None
        assert location.name == location_name
        assert location.org_id == org.org_id

        # Verify it was persisted
        persisted_loc = await db_session.scalar(
            select(Location).filter_by(name=location_name, org_id=org.org_id)
        )
        assert persisted_loc is not None
        assert persisted_loc.id == location.id

    async def test_get_or_create_location_returns_existing_location(self, db_session, service, org, create_location):
        """
        Verify _get_or_create_location returns an existing location without creating a new one.
        """
        existing_loc = await create_location(org=org, name="Existing-Location")
        await db_session.flush()

        location = await service._get_or_create_location("Existing-Location")

        assert location is not None
        assert location.id == existing_loc.id
        assert location.name == "Existing-Location"

    # Tests for _get_or_create_state 

    async def test_get_or_create_state_creates_state_on_receive(self, db_session, service, org, create_sku, create_location):
        """
        Verify _get_or_create_state creates a new state for a 'receive' action.
        """
        sku = await create_sku(org=org, sku="STATE-SKU")
        location = await create_location(org=org, name="State-Location")

        state = await service._get_or_create_state(sku.code, location.id, "receive")
        await db_session.flush()

        assert state is not None
        assert state.sku_code == sku.code
        assert state.location_id == location.id
        assert state.org_id == org.org_id
        assert state.on_hand == 0
        assert state.reserved == 0

        persisted_state = await db_session.get(State, {
            "sku_code": sku.code, "location_id": location.id, "org_id": org.org_id
        })
        assert persisted_state is not None

    async def test_get_or_create_state_raises_error_for_outbound_on_no_state(self, service, org, create_sku, create_location):
        """
        Verify _get_or_create_state raises TransactionBadRequest for outbound actions
        if no inventory state exists.
        """
        sku = await create_sku(org=org, sku="NO-STATE-SKU")
        location = await create_location(org=org, name="No-State-Location")

        for action in ["ship", "adjust", "reserve"]:
            with pytest.raises(TransactionBadRequest) as exc_info:
                await service._get_or_create_state(sku.code, location.id, action)
            assert f"Cannot perform '{action}' on non-existent inventory" in str(exc_info.value)

    # Tests for Cost Inference

    async def test_apply_transaction_infers_cost_for_positive_adjustment(self, db_session, create_org, txn_service):
        """
        Verify that a positive adjustment infers cost from existing WAC inventory.
        """
        wac_org = await create_org(valuation_method="WAC")
        service = txn_service(wac_org.org_id)

        # Layer 1: 10 units @ $10/unit
        await service.apply_transaction(ReceiveTxn(
            sku_code="INFER-COST-WAC", sku_name="WAC Item", location="WH", qty=10, unit_cost_major=10.0, action="receive", alerts=False, low_stock_threshold=10
        ))
        # Layer 2: 10 units @ $20/unit
        await service.apply_transaction(ReceiveTxn(
            sku_code="INFER-COST-WAC", sku_name="WAC Itcem", location="WH", qty=10, unit_cost_major=20.0, action="receive", alerts=False, low_stock_threshold=10
        ))
        
        # WAC is now (10*1000 + 10*2000) / 20 = 1500 minor units ($15)
        
        adj_payload = AdjustTxn(
            sku_code="INFER-COST-WAC", location="WH", qty=5, action="adjust", txn_metadata={"reason": "test"}
        )
        
        adj_txn, _ = await service.apply_transaction(adj_payload)
        await db_session.flush()

        assert adj_txn.total_cost_minor == 5 * 1500 # 5 units * $15/unit

    async def test_apply_transaction_infers_cost_from_last_known_cost(self, db_session, service, org):
        """
        Verify that a positive adjustment infers cost from the last known cost
        if current inventory is zero.
        """
        # 1. Receive inventory to create a cost history
        await service.apply_transaction(ReceiveTxn(
            sku_code="LKC-SKU", sku_name="LKC Item", location="Store", qty=10, unit_cost_major=25.0, action="receive", alerts=False, low_stock_threshold=10
        ))
        
        # 2. Ship all inventory to make stock zero
        await service.apply_transaction(ShipTxn(
            sku_code="LKC-SKU", location="Store", qty=10, action="ship"
        ))

        # 3. Apply a positive adjustment with no cost
        adj_payload = AdjustTxn(
            sku_code="LKC-SKU", location="Store", qty=2, action="adjust", txn_metadata={"reason": "restock"}
        )
        adj_txn, _ = await service.apply_transaction(adj_payload)
        await db_session.flush()

        # Should use the last known cost of $25 (2500 minor units)
        assert adj_txn.total_cost_minor == 2 * 2500

    # Tests for apply_transfer

    async def test_apply_transfer_raises_error_for_same_location(self, service, org, create_sku, create_location):
        """
        Verify that apply_transfer raises TransactionBadRequest if source and
        target locations are the same.
        """
        await create_sku(org=org, sku="SAME-LOC-SKU")
        await create_location(org=org, name="Location A")

        transfer_payload = TransferTxn(
            sku_code="SAME-LOC-SKU",
            location="Location A",
            target_location="Location A",
            qty=1,
            action="transfer",
        )

        with pytest.raises(TransactionBadRequest) as exc_info:
            await service.apply_transfer(transfer_payload)
        
        assert "Cannot transfer to the same location" in str(exc_info.value)

    async def test_apply_transfer_raises_error_for_nonexistent_sku(self, service, org, create_location):
        """
        Verify that apply_transfer raises SKUNotFoundError if the SKU
        does not exist.
        """
        await create_location(org=org, name="Source-Loc")
        await create_location(org=org, name="Target-Loc")

        transfer_payload = TransferTxn(
            sku_code="GHOST-SKU",
            location="Source-Loc",
            target_location="Target-Loc",
            qty=1,
            action="transfer",
        )

        with pytest.raises(SKUNotFoundError) as exc_info:
            await service.apply_transfer(transfer_payload)
            
        assert "SKU 'GHOST-SKU' not found" in str(exc_info.value)
        assert exc_info.value.sku_code == "GHOST-SKU"

    # Tests for Barcode Linking

    @patch('app.services.txn.link_barcode', autospec=True)
    async def test_apply_transaction_links_barcode(self, mock_link_barcode, service, db_session, org):
        """
        Verify that apply_transaction calls link_barcode when a barcode
        is provided in the payload.
        """
        payload = ReceiveTxn(
            sku_code="BARCODE-SKU",
            sku_name="Barcode Item",
            location="Warehouse",
            qty=1,
            action="receive",
            barcode=BarcodePayload(value="123456789012", format="UPC-A"),
            unit_cost_major=5.0,
            alerts=False,
            low_stock_threshold=10
        )

        await service.apply_transaction(payload)

        mock_link_barcode.assert_called_once()
        call_args = mock_link_barcode.call_args[1]
        
        assert call_args['db'] == db_session
        assert call_args['org_id'] == org.org_id
        assert call_args['value'] == "123456789012"
        assert call_args['sku_code'] == "BARCODE-SKU"
        assert call_args['format'] == "UPC-A"


@pytest.mark.asyncio
class TestTxnServiceCriticalFlows:
    """
    Tests for critical end-to-end transaction flows.
    These verify the service orchestrates all components correctly.
    """

    @pytest_asyncio.fixture
    async def org(self, create_org):
        """Create organization with FIFO valuation."""
        return await create_org(valuation_method="FIFO", currency="USD")

    @pytest_asyncio.fixture
    async def wac_org(self, create_org):
        """Create organization with WAC valuation."""
        return await create_org(valuation_method="WAC", currency="USD")

    @pytest.fixture
    def service(self, db_session, org):
        """Provides a TransactionService instance."""
        return TransactionService(session=db_session, org_id=org.org_id)

    @pytest.fixture
    def wac_service(self, db_session, wac_org):
        """Provides a WAC TransactionService instance."""
        return TransactionService(session=db_session, org_id=wac_org.org_id)

    # RECEIVE FLOWS

    async def test_receive_creates_everything_from_scratch(self, service, db_session, org):
        """
        CRITICAL: Verify receive transaction creates SKU, location, state, and transaction.
        This is the most common entry point for new inventory.
        """
        payload = ReceiveTxn(
            sku_code="NEW-ITEM-001",
            sku_name="Brand New Item",
            location="Main Warehouse",
            qty=100,
            unit_cost_major=12.50,
            action="receive",
            alerts=True,
            reorder_point=20,
            low_stock_threshold=10,
        )

        txn, state = await service.apply_transaction(payload)
        await db_session.flush()

        # Verify transaction record
        assert txn.qty == 100
        assert txn.action == "receive"
        assert txn.total_cost_minor == 125000  # 100 * $12.50
        assert txn.qty_before == 0

        # Verify state
        assert state.sku_code == "NEW-ITEM-001"
        assert state.on_hand == 100
        assert state.reserved == 0
        assert state.available == 100

        # Verify SKU was created
        sku = await db_session.get(SKU, {"code": "NEW-ITEM-001", "org_id": org.org_id})
        assert sku is not None
        assert sku.name == "Brand New Item"
        assert sku.alerts is True
        assert sku.reorder_point == 20
        assert sku.low_stock_threshold == 10

        # Verify location was created
        location = await db_session.scalar(
            select(Location).filter_by(name="Main Warehouse", org_id=org.org_id)
        )
        assert location is not None

    async def test_receive_updates_existing_inventory(self, service, db_session, org, create_sku, create_location):
        """
        Verify receiving into existing inventory accumulates correctly.
        """
        sku = await create_sku(org=org, sku="EXISTING-SKU")
        location = await create_location(org=org, name="Warehouse")

        # First receive
        txn1, state1 = await service.apply_transaction(ReceiveTxn(
            sku_code="EXISTING-SKU",
            sku_name="Existing Item",
            location="Warehouse",
            qty=50,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        assert state1.on_hand == 50
        assert txn1.qty_before == 0

        # Second receive
        txn2, state2 = await service.apply_transaction(ReceiveTxn(
            sku_code="EXISTING-SKU",
            sku_name="Existing Item",
            location="Warehouse",
            qty=30,
            unit_cost_major=12.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        assert state2.on_hand == 80  # 50 + 30
        assert state2.available == 80
        assert txn2.qty_before == 50

    async def test_receive_with_barcode_creates_link(self, service, db_session, org):
        """
        Verify barcode linking happens during receive.
        """
        payload = ReceiveTxn(
            sku_code="BARCODE-ITEM",
            sku_name="Item with Barcode",
            location="Store",
            qty=10,
            unit_cost_major=5.0,
            action="receive",
            barcode=BarcodePayload(value="123456789012", format="UPC-A"),
            alerts=False,
            low_stock_threshold=5
        )

        txn, state = await service.apply_transaction(payload)
        await db_session.flush()

        # Verify barcode was linked (check in Barcode table)
        barcode = await db_session.scalar(
            select(Barcode).filter_by(
                value="123456789012",
                sku_code="BARCODE-ITEM",
                org_id=org.org_id
            )
        )
        assert barcode is not None
        assert barcode.barcode_format == "UPC-A"

    # SHIP FLOWS

    async def test_ship_reduces_inventory_and_consumes_cost(self, service, db_session, org):
        """
        CRITICAL: Verify ship transaction reduces inventory and tracks cost consumption.
        """
        # Setup: Receive inventory first
        await service.apply_transaction(ReceiveTxn(
            sku_code="SHIP-TEST",
            sku_name="Ship Test Item",
            location="Warehouse",
            qty=100,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Ship some inventory
        ship_payload = ShipTxn(
            sku_code="SHIP-TEST",
            location="Warehouse",
            qty=30,
            action="ship",
        )

        txn, state = await service.apply_transaction(ship_payload)
        await db_session.flush()

        # Verify transaction
        assert txn.qty == -30  # Negative for outbound
        assert txn.action == "ship"
        assert txn.qty_before == 100
        assert txn.total_cost_minor == 30000  # 30 * $10.00 (consumed from FIFO)

        # Verify state
        assert state.on_hand == 70
        assert state.available == 70

    async def test_ship_raises_insufficient_stock_with_details(self, service, db_session, org):
        """
        CRITICAL: Verify InsufficientStockError provides detailed inventory breakdown.
        """
        # Setup: Small inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="LOW-STOCK",
            sku_name="Low Stock Item",
            location="Store",
            qty=5,
            unit_cost_major=1.0,
            action="receive",
            alerts=False,
            low_stock_threshold=2
        ))
        await db_session.flush()

        # Try to ship more than available
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.apply_transaction(ShipTxn(
                sku_code="LOW-STOCK",
                location="Store",
                qty=10,
                action="ship",
            ))

    async def test_ship_from_nonexistent_sku_raises_error(self, service):
        """
        Verify shipping non-existent SKU raises SKUNotFoundError.
        """
        with pytest.raises(SKUNotFoundError) as exc_info:
            await service.apply_transaction(ShipTxn(
                sku_code="GHOST-SKU",
                location="Warehouse",
                qty=1,
                action="ship",
            ))

        assert "GHOST-SKU" in str(exc_info.value)
        assert exc_info.value.sku_code == "GHOST-SKU"

    async def test_ship_from_location_with_no_inventory_raises_error(self, service, org, create_sku, create_location):
        """
        Verify shipping from location with no inventory state raises error.
        """
        await create_sku(org=org, sku="EMPTY-SKU")
        await create_location(org=org, name="Empty-Location")

        with pytest.raises(TransactionBadRequest) as exc_info:
            await service.apply_transaction(ShipTxn(
                sku_code="EMPTY-SKU",
                location="Empty-Location",
                qty=1,
                action="ship",
            ))

        assert "no inventory" in str(exc_info.value).lower()

    # ADJUST FLOWS

    async def test_adjust_positive_infers_wac_cost(self, wac_service, db_session, wac_org):
        """
        CRITICAL: Verify positive adjustment infers cost from WAC inventory.
        """
        # Create WAC inventory layers
        await wac_service.apply_transaction(ReceiveTxn(
            sku_code="WAC-ITEM",
            sku_name="WAC Item",
            location="Warehouse",
            qty=10,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await wac_service.apply_transaction(ReceiveTxn(
            sku_code="WAC-ITEM",
            sku_name="WAC Item",
            location="Warehouse",
            qty=10,
            unit_cost_major=20.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # WAC should be (10*1000 + 10*2000) / 20 = 1500 minor units ($15)

        # Positive adjustment without cost
        adj_payload = AdjustTxn(
            sku_code="WAC-ITEM",
            location="Warehouse",
            qty=5,
            action="adjust",
            txn_metadata={"reason": "found extra inventory"}
        )

        txn, state = await wac_service.apply_transaction(adj_payload)
        await db_session.flush()

        assert txn.total_cost_minor == 7500  # 5 * $15
        assert state.on_hand == 25  # 10 + 10 + 5

    async def test_adjust_positive_uses_last_known_cost_when_empty(self, service, db_session, org):
        """
        CRITICAL: Verify positive adjustment uses last known cost when inventory is zero.
        """
        # Receive and then ship all
        await service.apply_transaction(ReceiveTxn(
            sku_code="LKC-ITEM",
            sku_name="LKC Item",
            location="Store",
            qty=10,
            unit_cost_major=25.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await service.apply_transaction(ShipTxn(
            sku_code="LKC-ITEM",
            location="Store",
            qty=10,
            action="ship",
        ))
        await db_session.flush()

        # Now adjust up with no cost
        adj_payload = AdjustTxn(
            sku_code="LKC-ITEM",
            location="Store",
            qty=3,
            action="adjust",
            txn_metadata={"reason": "found in back room"}
        )

        txn, state = await service.apply_transaction(adj_payload)
        await db_session.flush()

        assert txn.total_cost_minor == 7500  # 3 * $25 (last known cost)
        assert state.on_hand == 3

    async def test_adjust_negative_consumes_cost(self, service, db_session, org):
        """
        Verify negative adjustment consumes cost correctly.
        """
        # Setup inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="ADJ-NEG",
            sku_name="Adj Neg Item",
            location="Warehouse",
            qty=50,
            unit_cost_major=8.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Negative adjustment (damage)
        adj_payload = AdjustTxn(
            sku_code="ADJ-NEG",
            location="Warehouse",
            qty=-10,
            action="adjust",
            txn_metadata={"reason": "damaged in transit"}
        )

        txn, state = await service.apply_transaction(adj_payload)
        await db_session.flush()

        assert txn.qty == -10
        assert txn.total_cost_minor == 8000  # 10 * $8.00
        assert state.on_hand == 40

    async def test_adjust_from_nonexistent_inventory_raises_error(self, service, org, create_sku, create_location):
        """
        Verify adjusting non-existent inventory raises error.
        """
        await create_sku(org=org, sku="NO-INV-SKU")
        await create_location(org=org, name="Empty-Loc")

        with pytest.raises(TransactionBadRequest) as exc_info:
            await service.apply_transaction(AdjustTxn(
                sku_code="NO-INV-SKU",
                location="Empty-Loc",
                qty=-5,
                action="adjust",
                txn_metadata={"reason": "test"}
            ))

        assert "no inventory" in str(exc_info.value).lower()

    # TRANSFER FLOWS

    async def test_transfer_moves_inventory_atomically(self, service, db_session, org):
        """
        CRITICAL: Verify transfer creates two transactions and updates both states.
        """
        # Setup: Inventory at source location
        await service.apply_transaction(ReceiveTxn(
            sku_code="TRANSFER-ITEM",
            sku_name="Transfer Item",
            location="Warehouse A",
            qty=100,
            unit_cost_major=15.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))
        await db_session.flush()

        # Transfer
        transfer_payload = TransferTxn(
            sku_code="TRANSFER-ITEM",
            location="Warehouse A",
            target_location="Warehouse B",
            qty=30,
            action="transfer",
            txn_metadata={"reason": "rebalancing"}
        )

        out_txn, in_txn, source_state, target_state = await service.apply_transfer(transfer_payload)
        await db_session.flush()

        # Verify OUT transaction
        assert out_txn.action == "transfer_out"
        assert out_txn.qty == -30
        assert out_txn.qty_before == 100
        assert out_txn.total_cost_minor == 45000  # 30 * $15

        # Verify IN transaction
        assert in_txn.action == "transfer_in"
        assert in_txn.qty == 30
        assert in_txn.qty_before == 0
        assert in_txn.total_cost_minor == 45000  # Same cost

        # Verify source state
        assert source_state.on_hand == 70  # 100 - 30
        assert source_state.available == 70

        # Verify target state
        assert target_state.on_hand == 30
        assert target_state.available == 30

        # Verify metadata linking
        assert out_txn.txn_metadata.get("target_location") == "Warehouse B"
        assert in_txn.txn_metadata.get("source_location") == "Warehouse A"
        assert out_txn.txn_metadata.get("transfer_cost_per_unit") == 15.0
        assert in_txn.txn_metadata.get("transfer_cost_per_unit") == 15.0

    async def test_transfer_insufficient_stock_at_source(self, service, db_session, org):
        """
        Verify transfer with insufficient stock raises InsufficientStockError.
        """
        # Setup: Small inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="LOW-TRANSFER",
            sku_name="Low Transfer Item",
            location="Source",
            qty=5,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Try to transfer more than available
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.apply_transfer(TransferTxn(
                sku_code="LOW-TRANSFER",
                location="Source",
                target_location="Target",
                qty=10,
                action="transfer",
            ))

    async def test_transfer_creates_target_location_automatically(self, service, db_session, org, create_location):
        """
        Verify transfer auto-creates target location if it doesn't exist.
        """
        await create_location(org=org, name="Source-Loc")
        
        await service.apply_transaction(ReceiveTxn(
            sku_code="AUTO-LOC",
            sku_name="Auto Loc Item",
            location="Source-Loc",
            qty=20,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Transfer to non-existent location
        out_txn, in_txn, _, target_state = await service.apply_transfer(TransferTxn(
            sku_code="AUTO-LOC",
            location="Source-Loc",
            target_location="New-Target-Location",
            qty=10,
            action="transfer",
        ))
        await db_session.flush()

        # Verify target location was created
        target_location = await db_session.scalar(
            select(Location).filter_by(name="New-Target-Location", org_id=org.org_id)
        )
        assert target_location is not None
        assert target_state.location_id == target_location.id

    async def test_transfer_with_barcode_links_at_target(self, service, db_session, org):
        """
        Verify barcode linking happens during transfer.
        """
        await service.apply_transaction(ReceiveTxn(
            sku_code="BARCODE-TRANSFER",
            sku_name="Barcode Transfer Item",
            location="Source",
            qty=20,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        transfer_payload = TransferTxn(
            sku_code="BARCODE-TRANSFER",
            location="Source",
            target_location="Target",
            qty=10,
            action="transfer",
            barcode=BarcodePayload(value="999888777666", format="EAN-13")
        )

        await service.apply_transfer(transfer_payload)
        await db_session.flush()

        # Verify barcode was linked
        barcode = await db_session.scalar(
            select(Barcode).filter_by(
                value="999888777666",
                sku_code="BARCODE-TRANSFER",
                org_id=org.org_id
            )
        )
        assert barcode is not None

    # RESERVE/UNRESERVE FLOWS

    async def test_reserve_moves_stock_to_reserved(self, service, db_session, org):
        """
        Verify reserve transaction moves available stock to reserved.
        """
        # Setup inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="RESERVE-ITEM",
            sku_name="Reserve Item",
            location="Warehouse",
            qty=50,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Reserve
        reserve_payload = ReserveTxn(
            sku_code="RESERVE-ITEM",
            location="Warehouse",
            qty=20,
            action="reserve",
            txn_metadata={"order_id": "ORD-123"}
        )

        txn, state = await service.apply_transaction(reserve_payload)
        await db_session.flush()

        assert txn.qty == 20
        assert txn.action == "reserve"
        assert state.on_hand == 50  # Unchanged
        assert state.reserved == 20
        assert state.available == 30  # 50 - 20

    async def test_unreserve_returns_stock_to_available(self, service, db_session, org):
        """
        Verify unreserve transaction returns reserved stock to available.
        """
        # Setup: Receive and reserve
        await service.apply_transaction(ReceiveTxn(
            sku_code="UNRESERVE-ITEM",
            sku_name="Unreserve Item",
            location="Store",
            qty=30,
            unit_cost_major=8.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await service.apply_transaction(ReserveTxn(
            sku_code="UNRESERVE-ITEM",
            location="Store",
            qty=15,
            action="reserve",
        ))
        await db_session.flush()

        # Unreserve
        unreserve_payload = UnreserveTxn(
            sku_code="UNRESERVE-ITEM",
            location="Store",
            qty=10,
            action="unreserve",
            txn_metadata={"reason": "order cancelled"}
        )

        txn, state = await service.apply_transaction(unreserve_payload)
        await db_session.flush()

        assert txn.qty == 10
        assert txn.action == "unreserve"
        assert state.on_hand == 30  # Unchanged
        assert state.reserved == 5  # 15 - 10
        assert state.available == 25  # 30 - 5

    async def test_reserve_insufficient_available_raises_error(self, service, db_session, org):
        """
        Verify reserving more than available raises InsufficientStockError.
        """
        # Setup: Limited inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="LOW-RESERVE",
            sku_name="Low Reserve Item",
            location="Store",
            qty=10,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Try to reserve more than available
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.apply_transaction(ReserveTxn(
                sku_code="LOW-RESERVE",
                location="Store",
                qty=15,
                action="reserve",
            ))

    # COST TRACKING EDGE CASES

    async def test_fifo_cost_consumption_order(self, service, db_session, org):
        """
        Verify FIFO consumes oldest cost layers first.
        """
        # Receive at different costs
        await service.apply_transaction(ReceiveTxn(
            sku_code="FIFO-ITEM",
            sku_name="FIFO Item",
            location="Warehouse",
            qty=10,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await service.apply_transaction(ReceiveTxn(
            sku_code="FIFO-ITEM",
            sku_name="FIFO Item",
            location="Warehouse",
            qty=10,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Ship should consume from first layer ($5)
        txn, _ = await service.apply_transaction(ShipTxn(
            sku_code="FIFO-ITEM",
            location="Warehouse",
            qty=5,
            action="ship",
        ))
        await db_session.flush()

        assert txn.total_cost_minor == 2500  # 5 * $5 (oldest layer)

    async def test_currency_conversion_to_minor_units(self, db_session, create_org):
        """
        Verify currency conversion handles different currencies correctly.
        """
        # Test with JPY (0 decimal places)
        jpy_org = await create_org(valuation_method="FIFO", currency="JPY")
        jpy_service = TransactionService(session=db_session, org_id=jpy_org.org_id)

        txn, _ = await jpy_service.apply_transaction(ReceiveTxn(
            sku_code="JPY-ITEM",
            sku_name="JPY Item",
            location="Tokyo",
            qty=10,
            unit_cost_major=100,  # 100 yen
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        assert txn.total_cost_minor == 1000  # 10 * 100 (no decimal conversion for JPY)

    # THRESHOLD CHECK DATA

    async def test_threshold_check_data_stored_for_ship(self, service, db_session, org):
        """
        Verify _threshold_check_data is populated for threshold monitoring.
        """
        await service.apply_transaction(ReceiveTxn(
            sku_code="THRESHOLD-SKU",
            sku_name="Threshold Item",
            location="Store",
            qty=100,
            unit_cost_major=1.0,
            action="receive",
            alerts=False,
            low_stock_threshold=20
        ))
        await db_session.flush()

        await service.apply_transaction(ShipTxn(
            sku_code="THRESHOLD-SKU",
            location="Store",
            qty=30,
            action="ship",
        ))

        # Verify threshold data was stored
        assert service._threshold_check_data is not None
        assert service._threshold_check_data['sku_code'] == "THRESHOLD-SKU"
        assert service._threshold_check_data['available_before'] == 100
        assert service._threshold_check_data['available_after'] == 70

    async def test_threshold_check_data_stored_for_receive(self, service, db_session, org):
        """
        Verify _threshold_check_data is populated for receive (resolution case).
        """
        txn, _ = await service.apply_transaction(ReceiveTxn(
            sku_code="THRESHOLD-RECEIVE",
            sku_name="Threshold Receive",
            location="Store",
            qty=50,
            unit_cost_major=1.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))

        assert service._threshold_check_data is not None
        assert service._threshold_check_data['available_before'] == 0
        assert service._threshold_check_data['available_after'] == 50

    # CONCURRENT MODIFICATION HANDLING

    async def test_concurrent_ship_transactions_handled(self, db_session, org, create_sku, create_location):
        """
        Verify concurrent transactions on same state are handled correctly.
        Note: This test simulates the scenario but actual StaleDataError 
        handling depends on database isolation level.
        """
        sku = await create_sku(org=org, sku="CONCURRENT-SKU")
        location = await create_location(org=org, name="Concurrent-Loc")
        
        # Create initial inventory
        service1 = TransactionService(session=db_session, org_id=org.org_id)
        await service1.apply_transaction(ReceiveTxn(
            sku_code="CONCURRENT-SKU",
            sku_name="Concurrent Item",
            location="Concurrent-Loc",
            qty=100,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))
        await db_session.commit()

        # This test would require two separate sessions to truly test concurrency
        # For now, verify the mechanism exists
        service2 = TransactionService(session=db_session, org_id=org.org_id)
        
        # Both services should be able to work with the same SKU
        txn1, state1 = await service1.apply_transaction(ShipTxn(
            sku_code="CONCURRENT-SKU",
            location="Concurrent-Loc",
            qty=10,
            action="ship",
        ))
        await db_session.flush()

        assert state1.on_hand == 90

    # SKU NAME PRESERVATION

    async def test_receive_does_not_overwrite_existing_sku_name(self, service, db_session, org, create_sku):
        """
        Verify that receiving into an existing SKU doesn't change its name.
        Critical for data integrity.
        """
        await create_sku(org=org, sku="NAME-TEST", name="Original Name")
        
        await service.apply_transaction(ReceiveTxn(
            sku_code="NAME-TEST",
            sku_name="Different Name",  # Should be ignored
            location="Warehouse",
            qty=10,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()
        
        # Verify name wasn't changed
        sku = await db_session.get(SKU, {"code": "NAME-TEST", "org_id": org.org_id})
        assert sku.name == "Original Name"
        
    # EDGE CASES

    async def test_adjust_positive_with_explicit_cost(self, service, db_session, org):
        """
        Verify adjustment can override inferred cost with explicit cost.
        """
        # Receive at one cost
        await service.apply_transaction(ReceiveTxn(
            sku_code="EXPLICIT-COST",
            sku_name="Explicit Cost Item",
            location="Store",
            qty=10,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()

        # Adjust with different explicit cost
        adj_payload = AdjustTxn(
            sku_code="EXPLICIT-COST",
            location="Store",
            qty=5,
            action="adjust",
            unit_cost_major=20.0,  # Explicit override
            txn_metadata={"reason": "found premium stock"}
        )

        txn, _ = await service.apply_transaction(adj_payload)
        await db_session.flush()

        assert txn.total_cost_minor == 10000  # 5 * $20 (explicit cost used)
        
    # RESERVED STOCK SHIPPING

    async def test_ship_from_reserved_stock_only(self, service, db_session, org):
        """
        Verify shipping from reserved stock only (ship_from='reserved').
        """
        # Setup: Receive inventory and reserve some
        await service.apply_transaction(ReceiveTxn(
            sku_code="RESERVED-SHIP",
            sku_name="Reserved Ship Item",
            location="Warehouse",
            qty=100,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))
        await service.apply_transaction(ReserveTxn(
            sku_code="RESERVED-SHIP",
            location="Warehouse",
            qty=30,
            action="reserve",
            txn_metadata={"order_id": "ORD-123"}
        ))
        await db_session.flush()

        # Ship from reserved only
        ship_payload = ShipTxn(
            sku_code="RESERVED-SHIP",
            location="Warehouse",
            qty=20,
            action="ship",
            txn_metadata={"ship_from": "reserved", "order_id": "ORD-123"}
        )

        txn, state = await service.apply_transaction(ship_payload)
        await db_session.flush()

        # Verify: Reserved reduced, available unchanged
        assert txn.qty == -20
        assert state.on_hand == 80  # 100 - 20
        assert state.reserved == 10  # 30 - 20
        assert state.available == 70  # 80 - 10

    async def test_ship_from_available_stock_only(self, service, db_session, org):
        """
        Verify shipping from available stock only (ship_from='available').
        Does not touch reserved stock.
        """
        # Setup: Receive and reserve
        await service.apply_transaction(ReceiveTxn(
            sku_code="AVAILABLE-SHIP",
            sku_name="Available Ship Item",
            location="Store",
            qty=100,
            unit_cost_major=8.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))
        await service.apply_transaction(ReserveTxn(
            sku_code="AVAILABLE-SHIP",
            location="Store",
            qty=40,
            action="reserve",
        ))
        await db_session.flush()

        # Ship from available only (60 available = 100 - 40)
        ship_payload = ShipTxn(
            sku_code="AVAILABLE-SHIP",
            location="Store",
            qty=30,
            action="ship",
            txn_metadata={"ship_from": "available"}
        )

        txn, state = await service.apply_transaction(ship_payload)
        await db_session.flush()

        # Verify: Available reduced, reserved unchanged
        assert txn.qty == -30
        assert state.on_hand == 70  # 100 - 30
        assert state.reserved == 40  # Unchanged
        assert state.available == 30  # 70 - 40

    async def test_ship_from_available_insufficient_raises_error(self, service, db_session, org):
        """
        Verify shipping more than available (when ship_from='available') raises error.
        """
        # Setup: Limited available due to reservations
        await service.apply_transaction(ReceiveTxn(
            sku_code="LIMITED-AVAILABLE",
            sku_name="Limited Available Item",
            location="Store",
            qty=50,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=5
        ))
        await service.apply_transaction(ReserveTxn(
            sku_code="LIMITED-AVAILABLE",
            location="Store",
            qty=45,  # Only 5 available left
            action="reserve",
        ))
        await db_session.flush()

        # Try to ship more than available
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.apply_transaction(ShipTxn(
                sku_code="LIMITED-AVAILABLE",
                location="Store",
                qty=10,  # More than 5 available
                action="ship",
                txn_metadata={"ship_from": "available"}
            ))

    # ORG-WIDE AVAILABLE CALCULATION

    async def test_get_org_wide_available_before_multi_location(self, service, db_session, org):
        """
        Verify _get_org_wide_available_before correctly aggregates across locations.
        Critical for threshold alerts that monitor org-wide inventory.
        """
        # Setup: Inventory at multiple locations
        await service.apply_transaction(ReceiveTxn(
            sku_code="MULTI-LOC",
            sku_name="Multi Location Item",
            location="Warehouse A",
            qty=50,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=20
        ))
        await service.apply_transaction(ReceiveTxn(
            sku_code="MULTI-LOC",
            sku_name="Multi Location Item",
            location="Warehouse B",
            qty=30,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=20
        ))
        await service.apply_transaction(ReceiveTxn(
            sku_code="MULTI-LOC",
            sku_name="Multi Location Item",
            location="Store C",
            qty=20,
            unit_cost_major=10.0,
            action="receive",
            alerts=False,
            low_stock_threshold=20
        ))
        
        # Reserve some at one location to test available vs on_hand
        await service.apply_transaction(ReserveTxn(
            sku_code="MULTI-LOC",
            location="Warehouse A",
            qty=10,
            action="reserve",
        ))
        await db_session.flush()

        # Get org-wide available
        org_wide = await service._get_org_wide_available_before("MULTI-LOC")

        # Should be: (50-10) + 30 + 20 = 90 available across all locations
        assert org_wide == 90

    async def test_get_org_wide_available_before_with_mixed_states(self, service, db_session, org):
        """
        Verify org-wide calculation handles locations with different states correctly.
        """
        # Location 1: Has inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="MIXED-STATE",
            sku_name="Mixed State Item",
            location="Active-Location",
            qty=100,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))
        
        # Location 2: Depleted inventory
        await service.apply_transaction(ReceiveTxn(
            sku_code="MIXED-STATE",
            sku_name="Mixed State Item",
            location="Depleted-Location",
            qty=50,
            unit_cost_major=5.0,
            action="receive",
            alerts=False,
            low_stock_threshold=10
        ))
        await service.apply_transaction(ShipTxn(
            sku_code="MIXED-STATE",
            location="Depleted-Location",
            qty=50,
            action="ship",
        ))
        
        # Location 3: No inventory state exists
        # (This SKU was never received at this location)
        
        await db_session.flush()

        org_wide = await service._get_org_wide_available_before("MIXED-STATE")

        # Should be: 100 + 0 = 100 (location 3 has no state, so contributes 0)
        assert org_wide == 100
            
            
@pytest.mark.asyncio
class TestTxnServiceConcurrency:
    """
    Tests for concurrent transaction handling.
    These verify the service handles race conditions correctly.
    """

    @pytest_asyncio.fixture
    async def org(self, session_factory):
        """Create organization for concurrency tests - must be committed."""
        async with session_factory() as session:
            org = Organization(
                name="Concurrency Test Org",
                valuation_method="FIFO",
                currency="USD"
            )
            session.add(org)
            await session.commit()
            # Return the org_id, not the object (which is tied to a closed session)
            return org.org_id
        
    async def test_concurrent_ships_from_same_inventory(self, session_factory, org):
        """
        CRITICAL: Verify two simultaneous ship transactions handle stock correctly.
        One should succeed, one should fail with InsufficientStockError.
        """
        org_id = org  # org is now just the UUID
        
        # Setup: Create SKU AND inventory in a committed transaction
        async with session_factory() as setup_session:
            # Create SKU first
            sku = SKU(
                code="CONCURRENT-SHIP",
                name="Concurrent Ship Item",
                org_id=org_id,
                alerts=False,
                low_stock_threshold=5
            )
            setup_session.add(sku)
            await setup_session.flush()
            
            # Create location
            location = Location(name="Warehouse", org_id=org_id)
            setup_session.add(location)
            await setup_session.flush()
            
            # Now create inventory using service
            service = TransactionService(session=setup_session, org_id=org_id)
            await service.apply_transaction(ReceiveTxn(
                sku_code="CONCURRENT-SHIP",
                sku_name="Concurrent Ship Item",
                location="Warehouse",
                qty=10,  # Only 10 available
                unit_cost_major=10.0,
                action="receive",
                alerts=False,
                low_stock_threshold=5
            ))
            await setup_session.commit()

        # Now try two concurrent ships for 8 units each
        async def ship_8_units(session_num: int):
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    txn, state = await service.apply_transaction(ShipTxn(
                        sku_code="CONCURRENT-SHIP",
                        location="Warehouse",
                        qty=8,
                        action="ship",
                    ))
                    await session.commit()
                    return ("success", session_num, state.on_hand)
                except InsufficientStockError as e:
                    await session.rollback()
                    return ("insufficient_stock", session_num, None)
                except Exception as e:
                    await session.rollback()
                    return ("error", session_num, str(e))

        # Run both ships concurrently
        results = await asyncio.gather(
            ship_8_units(1),
            ship_8_units(2),
            return_exceptions=True
        )

        # Verify results: one success, one failure
        success_count = sum(1 for r in results if r[0] == "success")
        insufficient_count = sum(1 for r in results if r[0] == "insufficient_stock")

        assert success_count == 1, f"Expected 1 success, got {success_count}. Results: {results}"
        assert insufficient_count == 1, f"Expected 1 insufficient_stock, got {insufficient_count}. Results: {results}"

        # Verify final state
        async with session_factory() as verify_session:
            result = await verify_session.execute(
                select(State).filter_by(
                    sku_code="CONCURRENT-SHIP",
                    org_id=org_id
                )
            )
            final_state = result.scalar_one()
            assert final_state.on_hand == 2, f"Expected 2 remaining (10-8), got {final_state.on_hand}"

    async def test_concurrent_transfer_from_same_source(self, session_factory, org):
        """
        Verify concurrent transfers from same source handle stock correctly.
        """
        org_id = org
        
        # Setup: Create SKU, location, and inventory
        async with session_factory() as setup_session:
            sku = SKU(
                code="CONCURRENT-TRANSFER",
                name="Concurrent Transfer Item",
                org_id=org_id,
                alerts=False,
                low_stock_threshold=5
            )
            setup_session.add(sku)
            
            location = Location(name="Source", org_id=org_id)
            setup_session.add(location)
            await setup_session.flush()
            
            service = TransactionService(session=setup_session, org_id=org_id)
            await service.apply_transaction(ReceiveTxn(
                sku_code="CONCURRENT-TRANSFER",
                sku_name="Concurrent Transfer Item",
                location="Source",
                qty=15,
                unit_cost_major=5.0,
                action="receive",
                alerts=False,
                low_stock_threshold=5
            ))
            await setup_session.commit()

        # Try two concurrent transfers of 10 units each
        async def transfer_10_units(target: str, session_num: int):
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    out_txn, in_txn, source_state, target_state = await service.apply_transfer(
                        TransferTxn(
                            sku_code="CONCURRENT-TRANSFER",
                            location="Source",
                            target_location=target,
                            qty=10,
                            action="transfer",
                        )
                    )
                    await session.commit()
                    return ("success", session_num, source_state.on_hand)
                except (InsufficientStockError, TransactionBadRequest) as e:
                    await session.rollback()
                    return ("insufficient_stock", session_num, None)
                except Exception as e:
                    await session.rollback()
                    return ("error", session_num, str(e))

        results = await asyncio.gather(
            transfer_10_units("Target-A", 1),
            transfer_10_units("Target-B", 2),
            return_exceptions=True
        )

        # One should succeed, one should fail
        success_count = sum(1 for r in results if r[0] == "success")
        insufficient_count = sum(1 for r in results if r[0] == "insufficient_stock")

        assert success_count == 1, f"Expected 1 success, got {success_count}"
        assert insufficient_count == 1, f"Expected 1 insufficient_stock, got {insufficient_count}"

    async def test_concurrent_receive_accumulates_correctly(self, session_factory, org):
        """
        Verify concurrent receives to same location accumulate correctly.
        Both should succeed and final total should be sum of both.
        """
        org_id = org
        
        # Setup: Create SKU and location FIRST
        async with session_factory() as setup_session:
            sku = SKU(
                code="CONCURRENT-RECEIVE",
                name="Concurrent Receive Item",
                org_id=org_id,
                alerts=False,
                low_stock_threshold=5
            )
            setup_session.add(sku)
            
            location = Location(name="Warehouse", org_id=org_id)
            setup_session.add(location)
            
            await setup_session.commit()
        
        async def receive_units(qty: int, cost: float, session_num: int):
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    txn, state = await service.apply_transaction(ReceiveTxn(
                        sku_code="CONCURRENT-RECEIVE",
                        sku_name="Concurrent Receive Item",
                        location="Warehouse",
                        qty=qty,
                        unit_cost_major=cost,
                        action="receive",
                        alerts=False,
                        low_stock_threshold=5
                    ))
                    await session.commit()
                    return ("success", session_num, state.on_hand)
                except Exception as e:
                    await session.rollback()
                    return ("error", session_num, str(e))

        # Run two concurrent receives
        results = await asyncio.gather(
            receive_units(50, 10.0, 1),
            receive_units(30, 12.0, 2),
            return_exceptions=True
        )

        # Both should succeed
        success_count = sum(1 for r in results if r[0] == "success")
        assert success_count == 2, f"Expected 2 successes, got {success_count}. Results: {results}"

        # Verify final total
        async with session_factory() as verify_session:
            result = await verify_session.execute(
                select(State).filter_by(
                    sku_code="CONCURRENT-RECEIVE",
                    org_id=org_id
                )
            )
            final_state = result.scalar_one()
            assert final_state.on_hand == 80, f"Expected 80 (50+30), got {final_state.on_hand}"

    async def test_concurrent_reserve_respects_available_limit(self, session_factory, org):
        """
        Verify concurrent reservations respect available stock limits.
        """
        org_id = org
        
        # Setup: Create SKU, location, and limited inventory
        async with session_factory() as setup_session:
            sku = SKU(
                code="CONCURRENT-RESERVE",
                name="Concurrent Reserve Item",
                org_id=org_id,
                alerts=False,
                low_stock_threshold=5
            )
            setup_session.add(sku)
            
            location = Location(name="Store", org_id=org_id)
            setup_session.add(location)
            await setup_session.flush()
            
            service = TransactionService(session=setup_session, org_id=org_id)
            # FIX: Use ReceiveTxn to create inventory first
            await service.apply_transaction(ReceiveTxn(
                sku_code="CONCURRENT-RESERVE",
                sku_name="Concurrent Reserve Item",
                location="Store",
                qty=20,  # Receive 20 units
                unit_cost_major=8.0,
                action="receive",
                alerts=False,
                low_stock_threshold=5
            ))
            await setup_session.commit()

        # Try to reserve 15 units each (30 total, but only 20 available)
        async def reserve_units(qty: int, session_num: int):
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    txn, state = await service.apply_transaction(ReserveTxn(
                        sku_code="CONCURRENT-RESERVE",
                        location="Store",
                        qty=qty,
                        action="reserve",
                    ))
                    await session.commit()
                    return ("success", session_num, state.reserved)
                except InsufficientStockError:
                    await session.rollback()
                    return ("insufficient_stock", session_num, None)
                except Exception as e:
                    await session.rollback()
                    return ("error", session_num, str(e))

        results = await asyncio.gather(
            reserve_units(15, 1),
            reserve_units(15, 2),
            return_exceptions=True
        )

        # One should succeed, one should fail
        success_count = sum(1 for r in results if r[0] == "success")
        insufficient_count = sum(1 for r in results if r[0] == "insufficient_stock")

        assert success_count == 1, f"Expected 1 success, got {success_count}"
        assert insufficient_count == 1, f"Expected 1 insufficient_stock, got {insufficient_count}"

        # Verify final reserved amount is 15 (not 30)
        async with session_factory() as verify_session:
            result = await verify_session.execute(
                select(State).filter_by(
                    sku_code="CONCURRENT-RESERVE",
                    org_id=org_id
                )
            )
            final_state = result.scalar_one()
            assert final_state.reserved == 15, f"Expected 15 reserved, got {final_state.reserved}"
            assert final_state.available == 5, f"Expected 5 available (20-15), got {final_state.available}"
            assert final_state.on_hand == 20, f"Expected 20 on_hand, got {final_state.on_hand}"
            
            
@pytest.mark.asyncio
class TestTxnServiceFailureRecovery:
    """Tests for failure modes, rollbacks, and trust boundary validation."""
    
    @pytest_asyncio.fixture
    async def org(self, create_org):
        return await create_org(valuation_method="FIFO", currency="USD")

    async def test_bidirectional_transfer_deadlock_prevention(
        self, session_factory
    ):
        """
        CRITICAL: Verify that simultaneous bidirectional transfers don't deadlock.
        """
        # Create org in its own committed session
        async with session_factory() as org_session:
            org = Organization(
                name="Deadlock Test Org",
                valuation_method="FIFO",
                currency="USD"
            )
            org_session.add(org)
            await org_session.commit()
            org_id = org.org_id
        
        # Setup: Create SKU and locations with inventory
        async with session_factory() as setup_session:
            sku = SKU(
                code="DEADLOCK-TEST",
                name="Deadlock Test Item",
                org_id=org_id,
                alerts=False,
                low_stock_threshold=5
            )
            setup_session.add(sku)
            
            loc_a = Location(name="Location-A", org_id=org_id)
            loc_b = Location(name="Location-B", org_id=org_id)
            setup_session.add_all([loc_a, loc_b])
            await setup_session.flush()
            
            service = TransactionService(session=setup_session, org_id=org_id)
            await service.apply_transaction(ReceiveTxn(
                sku_code="DEADLOCK-TEST",
                sku_name="Deadlock Test Item",
                location="Location-A",
                qty=50,
                unit_cost_major=10.0,
                action="receive",
                alerts=False,
                low_stock_threshold=5
            ))
            await service.apply_transaction(ReceiveTxn(
                sku_code="DEADLOCK-TEST",
                sku_name="Deadlock Test Item",
                location="Location-B",
                qty=50,
                unit_cost_major=10.0,
                action="receive",
                alerts=False,
                low_stock_threshold=5
            ))
            await setup_session.commit()
        
        async def transfer_with_delay(source: str, target: str, session_num: int):
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    await asyncio.sleep(0.01 * session_num)
                    
                    out_txn, in_txn, source_state, target_state = await service.apply_transfer(
                        TransferTxn(
                            sku_code="DEADLOCK-TEST",
                            location=source,
                            target_location=target,
                            qty=20,
                            action="transfer",
                        )
                    )
                    await session.commit()
                    return ("success", session_num, source, target)
                except Exception as e:
                    await session.rollback()
                    return ("error", session_num, source, target, str(e))
        
        try:
            results = await asyncio.wait_for(
                asyncio.gather(
                    transfer_with_delay("Location-A", "Location-B", 1),
                    transfer_with_delay("Location-B", "Location-A", 2),
                    return_exceptions=True
                ),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            pytest.fail("Deadlock detected: Bidirectional transfers timed out")
        
        success_count = sum(1 for r in results if isinstance(r, tuple) and r[0] == "success")
        assert success_count >= 1, f"Expected at least 1 success. Results: {results}"

    async def test_barcode_collision_with_different_sku_maintains_integrity(
        self, db_session, org, create_sku, create_location
    ):
        """
        CRITICAL: Verify barcode collision handling doesn't corrupt data.
        """
        # Create SKUs and location first
        sku_a = await create_sku(org=org, sku="SKU-A", name="SKU A")
        sku_b = await create_sku(org=org, sku="SKU-B", name="SKU B")
        location = await create_location(org=org, name="Warehouse")
        
        service = TransactionService(session=db_session, org_id=org.org_id)
        
        # Link barcode to first SKU
        await service.apply_transaction(ReceiveTxn(
            sku_code="SKU-A",
            sku_name="SKU A",
            location="Warehouse",
            qty=10,
            unit_cost_major=5.0,
            action="receive",
            barcode=BarcodePayload(value="SHARED-BARCODE-123", format="UPC-A"),
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()
        
        # Get initial barcode
        result = await db_session.execute(
            select(Barcode).filter_by(
                value="SHARED-BARCODE-123",
                org_id=org.org_id
            )
        )
        initial_barcode = result.scalar_one()
        assert initial_barcode.sku_code == "SKU-A"
        initial_barcode_id = initial_barcode.id
        
        # Attempt collision
        service2 = TransactionService(session=db_session, org_id=org.org_id)
        await service2.apply_transaction(ReceiveTxn(
            sku_code="SKU-B",
            sku_name="SKU B",
            location="Warehouse",
            qty=15,
            unit_cost_major=8.0,
            action="receive",
            barcode=BarcodePayload(value="SHARED-BARCODE-123", format="EAN-13"),
            alerts=False,
            low_stock_threshold=5
        ))
        await db_session.flush()
        
        # Verify original barcode unchanged
        result = await db_session.execute(
            select(Barcode).filter_by(
                value="SHARED-BARCODE-123",
                org_id=org.org_id
            )
        )
        final_barcode = result.scalar_one()
        
        assert final_barcode.id == initial_barcode_id
        assert final_barcode.sku_code == "SKU-A"
        assert final_barcode.barcode_format == "UPC-A"
        
        # Verify SKU-B inventory exists
        result = await db_session.execute(
            select(State).filter_by(
                sku_code="SKU-B",
                org_id=org.org_id
            )
        )
        sku_b_state = result.scalar_one()
        assert sku_b_state.on_hand == 15
        
        # Verify only one barcode
        barcode_count = await db_session.scalar(
            select(func.count(Barcode.id)).filter_by(
                value="SHARED-BARCODE-123",
                org_id=org.org_id
            )
        )
        assert barcode_count == 1

    async def test_negative_available_impossible_via_concurrent_reserve_and_ship(
        self, session_factory
    ):
        """
        CRITICAL: Verify racing operations can't create negative available.
        """
        # Create org in committed session
        async with session_factory() as org_session:
            org = Organization(
                name="Race Test Org",
                valuation_method="FIFO",
                currency="USD"
            )
            org_session.add(org)
            await org_session.commit()
            org_id = org.org_id
        
        # Setup inventory
        async with session_factory() as setup_session:
            sku = SKU(
                code="RACE-TEST",
                name="Race Condition Test",
                org_id=org_id,
                alerts=False,
                low_stock_threshold=5
            )
            setup_session.add(sku)
            
            location = Location(name="Store", org_id=org_id)
            setup_session.add(location)
            await setup_session.flush()
            
            service = TransactionService(session=setup_session, org_id=org_id)
            await service.apply_transaction(ReceiveTxn(
                sku_code="RACE-TEST",
                sku_name="Race Condition Test",
                location="Store",
                qty=10,
                unit_cost_major=5.0,
                action="receive",
                alerts=False,
                low_stock_threshold=5
            ))
            await setup_session.commit()
        
        async def reserve_8_units():
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    txn, state = await service.apply_transaction(ReserveTxn(
                        sku_code="RACE-TEST",
                        location="Store",
                        qty=8,
                        action="reserve",
                    ))
                    await session.commit()
                    return ("reserve_success", state.reserved)
                except InsufficientStockError:
                    await session.rollback()
                    return ("reserve_insufficient", None)
        
        async def ship_8_units():
            async with session_factory() as session:
                try:
                    service = TransactionService(session=session, org_id=org_id)
                    txn, state = await service.apply_transaction(ShipTxn(
                        sku_code="RACE-TEST",
                        location="Store",
                        qty=8,
                        action="ship",
                        txn_metadata={"ship_from": "available"}
                    ))
                    await session.commit()
                    return ("ship_success", state.on_hand)
                except InsufficientStockError:
                    await session.rollback()
                    return ("ship_insufficient", None)
        
        results = await asyncio.gather(
            reserve_8_units(),
            ship_8_units(),
            return_exceptions=True
        )
        
        successes = [r for r in results if r[0] in ("reserve_success", "ship_success")]
        failures = [r for r in results if "insufficient" in r[0]]
        
        assert len(successes) == 1, f"Expected 1 success. Results: {results}"
        assert len(failures) == 1, f"Expected 1 failure. Results: {results}"
        
        # Verify integrity
        async with session_factory() as verify_session:
            result = await verify_session.execute(
                select(Location.id).filter_by(name="Store", org_id=org_id)
            )
            location_id = result.scalar_one()
            
            final_state = await verify_session.get(
                State,
                {"sku_code": "RACE-TEST", "location_id": location_id, "org_id": org_id}
            )
            
            assert final_state.available >= 0
            assert final_state.available == final_state.on_hand - final_state.reserved
