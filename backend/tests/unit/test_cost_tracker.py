import pytest
from sqlalchemy import select
from app.models import CostRecord
from app.schemas.actions import ReceiveTxn, ShipTxn, AdjustTxn, TransferTxn
import asyncio
from app.services.exceptions import InsufficientStockError
from app.services.txn import TransactionService
from app.models import Organization

@pytest.mark.asyncio
class TestCostTracking:
    """
    Test inventory valuation logic through the TransactionService.
    This mirrors how the application actually uses cost tracking.
    """

    async def test_fifo_valuation_through_transactions(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test FIFO: First-In-First-Out cost consumption.
        Oldest inventory is consumed first.
        """
        # Setup organization with FIFO
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        # Receipt 1: 10 units @ $1.00 each
        receive1 = ReceiveTxn(
            sku_code="FIFO-WIDGET",
            sku_name="Widget",
            location="Warehouse A",
            qty=10,
            unit_cost_major=1.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        txn1, state1 = await service.apply_transaction(receive1)
        
        
        assert txn1.qty == 10
        assert txn1.total_cost_minor == 1000  # 10 units * 100 minor units
        assert state1.on_hand == 10
        
        # Receipt 2: 10 units @ $2.00 each
        receive2 = ReceiveTxn(
            sku_code="FIFO-WIDGET",
            sku_name="Widget",
            location="Warehouse A",
            qty=10,
            unit_cost_major=2.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        txn2, state2 = await service.apply_transaction(receive2)
        
        
        assert state2.on_hand == 20
        
        # Ship 15 units - FIFO should consume all 10 from first batch, then 5 from second
        # Expected cost: (10 * $1.00) + (5 * $2.00) = $10 + $10 = $20 = 2000 minor units
        ship = ShipTxn(
            sku_code="FIFO-WIDGET",
            location="Warehouse A",
            qty=15,
            action="ship",
            txn_metadata={}
        )
        ship_txn, ship_state = await service.apply_transaction(ship)
        
        
        assert ship_txn.qty == -15
        assert ship_txn.total_cost_minor == 2000
        assert ship_state.on_hand == 5
        
        # Verify cost records: First layer exhausted, second has 5 remaining
        result = await db_session.execute(
            select(CostRecord)
            .filter_by(sku_code="FIFO-WIDGET", org_id=org.org_id)
            .order_by(CostRecord.created_at.asc(), CostRecord.id.asc())
        )
        layers = result.scalars().all()
        
        assert len(layers) == 2
        assert layers[0].qty_remaining == 0   # First batch exhausted
        assert layers[0].unit_cost_minor == 100
        assert layers[1].qty_remaining == 5   # 5 units left from second batch
        assert layers[1].unit_cost_minor == 200

    async def test_lifo_valuation_through_transactions(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test LIFO: Last-In-First-Out cost consumption.
        Newest inventory is consumed first.
        """
        org = await create_org(valuation_method="LIFO")
        service = txn_service(org.org_id)
        
        # Receipt 1: 10 units @ $1.00 each
        receive1 = ReceiveTxn(
            sku_code="LIFO-WIDGET",
            sku_name="Widget",
            location="Warehouse A",
            qty=10,
            unit_cost_major=1.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive1)
        
        
        # Receipt 2: 10 units @ $2.00 each
        receive2 = ReceiveTxn(
            sku_code="LIFO-WIDGET",
            sku_name="Widget",
            location="Warehouse A",
            qty=10,
            unit_cost_major=2.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive2)
        
        
        # Ship 15 units - LIFO should consume all 10 from second batch, then 5 from first
        # Expected cost: (10 * $2.00) + (5 * $1.00) = $20 + $5 = $25 = 2500 minor units
        ship = ShipTxn(
            sku_code="LIFO-WIDGET",
            location="Warehouse A",
            qty=15,
            action="ship",
            txn_metadata={}
        )
        ship_txn, ship_state = await service.apply_transaction(ship)
        
        
        assert ship_txn.qty == -15
        assert ship_txn.total_cost_minor == 2500
        assert ship_state.on_hand == 5
        
        # Verify cost records: Second layer exhausted, first has 5 remaining
        result = await db_session.execute(
            select(CostRecord)
            .filter_by(sku_code="LIFO-WIDGET", org_id=org.org_id)
            .order_by(CostRecord.created_at.asc(), CostRecord.id.asc())
        )
        layers = result.scalars().all()
        
        assert len(layers) == 2
        assert layers[0].qty_remaining == 5   # 5 units left from first batch
        assert layers[0].unit_cost_minor == 100
        assert layers[1].qty_remaining == 0   # Second batch exhausted
        assert layers[1].unit_cost_minor == 200

    async def test_wac_valuation_through_transactions(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test WAC: Weighted Average Cost automatically merges layers.
        All inventory valued at weighted average.
        """
        org = await create_org(valuation_method="WAC")
        service = txn_service(org.org_id)
        
        # Receipt 1: 10 units @ $1.00 each
        receive1 = ReceiveTxn(
            sku_code="WAC-WIDGET",
            sku_name="Widget",
            location="Warehouse A",
            qty=10,
            unit_cost_major=1.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive1)
        
        
        # Receipt 2: 10 units @ $3.00 each
        # Weighted average: (10*$1 + 10*$3) / 20 = $40 / 20 = $2.00
        receive2 = ReceiveTxn(
            sku_code="WAC-WIDGET",
            sku_name="Widget",
            location="Warehouse A",
            qty=10,
            unit_cost_major=3.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive2)
        
        
        # Verify WAC merged layers into single average
        result = await db_session.execute(
            select(CostRecord)
            .filter_by(sku_code="WAC-WIDGET", org_id=org.org_id)
        )
        layers = result.scalars().all()
        
        assert len(layers) == 1  # WAC merges all layers
        assert layers[0].qty_remaining == 20
        assert layers[0].unit_cost_minor == 200  # $2.00 average
        
        # Ship 5 units at weighted average cost
        # Expected: 5 * $2.00 = $10 = 1000 minor units
        ship = ShipTxn(
            sku_code="WAC-WIDGET",
            location="Warehouse A",
            qty=5,
            action="ship",
            txn_metadata={}
        )
        ship_txn, ship_state = await service.apply_transaction(ship)
        
        
        assert ship_txn.total_cost_minor == 1000
        assert ship_state.on_hand == 15

    async def test_transfer_preserves_cost_basis(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test that transfers preserve cost basis from source location.
        """
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        # Receive inventory at Warehouse A @ $5.00 each
        receive = ReceiveTxn(
            sku_code="TRANSFER-ITEM",
            sku_name="Item",
            location="Warehouse A",
            qty=100,
            unit_cost_major=5.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive)
        
        
        # Transfer 30 units to Warehouse B
        transfer = TransferTxn(
            sku_code="TRANSFER-ITEM",
            location="Warehouse A",
            target_location="Warehouse B",
            qty=30,
            action="transfer",
            txn_metadata={}
        )
        out_txn, in_txn, src_state, tgt_state = await service.apply_transfer(transfer)
        
        
        # Verify transfer consumed cost from source
        assert out_txn.total_cost_minor == 15000  # 30 * $5.00 = $150
        assert in_txn.total_cost_minor == 15000   # Same cost transferred
        
        # Verify states
        assert src_state.on_hand == 70  # 100 - 30
        assert tgt_state.on_hand == 30
        
        # Verify cost basis at target location
        result = await db_session.execute(
            select(CostRecord)
            .filter_by(sku_code="TRANSFER-ITEM", location_id=tgt_state.location_id)
        )
        target_layers = result.scalars().all()
        
        assert len(target_layers) == 1
        assert target_layers[0].qty_remaining == 30
        assert target_layers[0].unit_cost_minor == 500  # $5.00 preserved

    async def test_positive_adjustment_infers_cost(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test that positive adjustments without explicit cost infer from existing inventory.
        """
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        # Receive initial inventory @ $10.00 each
        receive = ReceiveTxn(
            sku_code="ADJUST-ITEM",
            sku_name="Item",
            location="Store",
            qty=50,
            unit_cost_major=10.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive)
        
        
        # Positive adjustment without explicit cost (e.g., "found" inventory)
        # Should infer cost from most recent layer
        adjust = AdjustTxn(
            sku_code="ADJUST-ITEM",
            location="Store",
            qty=5,
            action="adjust",
            txn_metadata={"reason": "cycle count found extra units"}
        )
        adj_txn, adj_state = await service.apply_transaction(adjust)
        
        
        # Should have inferred $10.00 cost
        assert adj_txn.total_cost_minor == 5000  # 5 * $10.00
        assert adj_state.on_hand == 55

    async def test_negative_adjustment_consumes_cost(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test that negative adjustments consume cost according to valuation method.
        """
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        # Setup two cost layers
        receive1 = ReceiveTxn(
            sku_code="SHRINK-ITEM",
            sku_name="Item",
            location="Store",
            qty=10,
            unit_cost_major=5.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive1)
        
        
        receive2 = ReceiveTxn(
            sku_code="SHRINK-ITEM",
            sku_name="Item",
            location="Store",
            qty=10,
            unit_cost_major=10.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive2)
        
        
        # Negative adjustment (damage/shrinkage) - should consume via FIFO
        adjust = AdjustTxn(
            sku_code="SHRINK-ITEM",
            location="Store",
            qty=-12,
            action="adjust",
            txn_metadata={"reason": "damaged goods"}
        )
        adj_txn, adj_state = await service.apply_transaction(adjust)
        
        
        # FIFO: (10 * $5) + (2 * $10) = $50 + $20 = $70
        assert adj_txn.total_cost_minor == 7000
        assert adj_state.on_hand == 8

    async def test_insufficient_stock_error(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test that attempting to ship more than available raises detailed error.
        """
        from app.services.exceptions import InsufficientStockError
        
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        # Receive only 10 units
        receive = ReceiveTxn(
            sku_code="LIMITED-ITEM",
            sku_name="Item",
            location="Warehouse",
            qty=10,
            unit_cost_major=1.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive)
        
        
        # Try to ship 20 units
        ship = ShipTxn(
            sku_code="LIMITED-ITEM",
            location="Warehouse",
            qty=20,
            action="ship",
            txn_metadata={}
        )
        
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.apply_transaction(ship)
        
    async def test_multi_location_cost_tracking(
        self, 
        db_session, 
        create_org, 
        txn_service
    ):
        """
        Test that cost layers are tracked independently per location.
        """
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        # Receive at Warehouse A @ $1.00
        receive_a = ReceiveTxn(
            sku_code="MULTI-LOC",
            sku_name="Item",
            location="Warehouse A",
            qty=10,
            unit_cost_major=1.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive_a)
        
        
        # Receive at Warehouse B @ $2.00
        receive_b = ReceiveTxn(
            sku_code="MULTI-LOC",
            sku_name="Item",
            location="Warehouse B",
            qty=10,
            unit_cost_major=2.00,
            action="receive",
            txn_metadata={},
            alerts=False,
            low_stock_threshold=10,
        )
        await service.apply_transaction(receive_b)
        
        
        # Ship from Warehouse A - should use $1.00 cost
        ship_a = ShipTxn(
            sku_code="MULTI-LOC",
            location="Warehouse A",
            qty=5,
            action="ship",
            txn_metadata={}
        )
        ship_a_txn, _ = await service.apply_transaction(ship_a)
        
        
        assert ship_a_txn.total_cost_minor == 500  # 5 * $1.00
        
        # Ship from Warehouse B - should use $2.00 cost
        ship_b = ShipTxn(
            sku_code="MULTI-LOC",
            location="Warehouse B",
            qty=5,
            action="ship",
            txn_metadata={}
        )
        ship_b_txn, _ = await service.apply_transaction(ship_b)
        
        
        assert ship_b_txn.total_cost_minor == 1000  # 5 * $2.00
        
    @pytest.mark.asyncio
    async def test_concurrent_fifo_consumption_is_serialized(
        self,
        session_factory,
    ):
        # Setup organization with one session
        async with session_factory() as session:
            org = Organization(name="Test Org", valuation_method="FIFO", currency="USD")
            session.add(org)
            await session.commit()
            org_id = org.org_id
        
        # Setup initial inventory
        async with session_factory() as session:
            service = TransactionService(
                session=session,
                org_id=org_id,
                user_id=None
            )
            receive = ReceiveTxn(
                sku_code="CONCURRENT-FIFO",
                sku_name="Item",
                location="Warehouse",
                qty=10,
                unit_cost_major=1.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
            await service.apply_transaction(receive)
            await session.commit()

        # Two concurrent shipments of 7 units each (total demand = 14 > 10)
        ship = ShipTxn(
            sku_code="CONCURRENT-FIFO",
            location="Warehouse",
            qty=7,
            action="ship",
            txn_metadata={},
        )

        async def attempt_ship():
            async with session_factory() as session:
                service = TransactionService(
                    session=session,
                    org_id=org_id,
                    user_id=None
                )
                result = await service.apply_transaction(ship)
                await session.commit()
                return result

        results = await asyncio.gather(
            attempt_ship(),
            attempt_ship(),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, Exception)]
        failures = [r for r in results if isinstance(r, Exception)]

        # Exactly one should succeed, one should fail
        assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
        assert len(failures) == 1, f"Expected 1 failure, got {len(failures)}"
        assert isinstance(failures[0], InsufficientStockError), \
            f"Expected InsufficientStockError, got {type(failures[0]).__name__}: {failures[0]}"
        
    @pytest.mark.asyncio
    async def test_wac_rounding_preserves_total_quantity_and_value(
        self,
        db_session,
        create_org,
        txn_service,
    ):
        org = await create_org(valuation_method="WAC")
        service = txn_service(org.org_id)

        # Uneven layers
        # 3 @ $1.00
        await service.apply_transaction(
            ReceiveTxn(
                sku_code="WAC-ROUND",
                sku_name="Item",
                location="Warehouse",
                qty=3,
                unit_cost_major=1.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
        )
        

        # 7 @ $2.00
        await service.apply_transaction(
            ReceiveTxn(
                sku_code="WAC-ROUND",
                sku_name="Item",
                location="Warehouse",
                qty=7,
                unit_cost_major=2.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
        )
        

        # Total value = (3*100 + 7*200) = 1700
        # Avg cost = 170
        ship = ShipTxn(
            sku_code="WAC-ROUND",
            location="Warehouse",
            qty=5,
            action="ship",
            txn_metadata={},
        )

        ship_txn, state = await service.apply_transaction(ship)
        

        assert ship_txn.total_cost_minor == 5 * 170
        assert state.on_hand == 5

        # Remaining inventory value must still reconcile
        result = await db_session.execute(
            select(CostRecord).filter_by(sku_code="WAC-ROUND")
        )
        layers = result.scalars().all()

        remaining_value = sum(cr.qty_remaining * cr.unit_cost_minor for cr in layers)
        assert remaining_value == 1700 - ship_txn.total_cost_minor
        
    @pytest.mark.asyncio
    async def test_positive_adjustment_uses_last_known_cost_when_stock_zero(
        self,
        create_org,
        txn_service,
    ):
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)

        # Receive 5 @ $4.00
        await service.apply_transaction(
            ReceiveTxn(
                sku_code="ZERO-STOCK",
                sku_name="Item",
                location="Store",
                qty=5,
                unit_cost_major=4.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
        )
        

        # Ship all 5
        await service.apply_transaction(
            ShipTxn(
                sku_code="ZERO-STOCK",
                location="Store",
                qty=5,
                action="ship",
                txn_metadata={},
            )
        )
        

        # Positive adjustment after stock is zero
        adjust = AdjustTxn(
            sku_code="ZERO-STOCK",
            location="Store",
            qty=2,
            action="adjust",
            txn_metadata={"reason": "found items"},
        )

        adj_txn, state = await service.apply_transaction(adjust)
        

        assert adj_txn.total_cost_minor == 2 * 400
        assert state.on_hand == 2
        
    @pytest.mark.asyncio
    async def test_cost_layer_invariants_hold_after_consumption(
        self,
        db_session,
        create_org,
        txn_service,
    ):
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)

        await service.apply_transaction(
            ReceiveTxn(
                sku_code="INVARIANT",
                sku_name="Item",
                location="Warehouse",
                qty=20,
                unit_cost_major=3.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
        )
        

        ship_txn, state = await service.apply_transaction(
            ShipTxn(
                sku_code="INVARIANT",
                location="Warehouse",
                qty=12,
                action="ship",
                txn_metadata={},
            )
        )
        

        result = await db_session.execute(
            select(CostRecord).filter_by(sku_code="INVARIANT")
        )
        layers = result.scalars().all()

        # Invariants
        for layer in layers:
            assert layer.qty_remaining >= 0
            assert layer.qty_remaining <= layer.qty_in

        assert sum(l.qty_remaining for l in layers) == state.on_hand
        
    @pytest.mark.asyncio
    async def test_financial_reconciliation_complex_sequence(
        self,
        db_session,
        create_org,
        txn_service,
    ):
        """
        CRITICAL: Verify the accounting identity holds across complex operations.
        Total Value In = Total Value Out + Remaining Inventory Value
        
        This is the #1 test for financial reliability - if this breaks, books don't balance.
        """
        org = await create_org(valuation_method="FIFO")
        service = txn_service(org.org_id)
        
        total_value_in = 0
        total_value_out = 0
        
        # Complex sequence mixing receives, ships, adjustments, transfers
        
        # Receive batch 1
        r1, _ = await service.apply_transaction(
            ReceiveTxn(
                sku_code="RECONCILE",
                sku_name="Item",
                location="WH-A",
                qty=100,
                unit_cost_major=5.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
        )
        total_value_in += r1.total_cost_minor
        
        # Ship some
        s1, _ = await service.apply_transaction(
            ShipTxn(
                sku_code="RECONCILE",
                location="WH-A",
                qty=30,
                action="ship",
                txn_metadata={},
            )
        )
        total_value_out += s1.total_cost_minor
        
        # Receive batch 2
        r2, _ = await service.apply_transaction(
            ReceiveTxn(
                sku_code="RECONCILE",
                sku_name="Item",
                location="WH-A",
                qty=50,
                unit_cost_major=6.00,
                action="receive",
                txn_metadata={},
                alerts=False,
                low_stock_threshold=1,
            )
        )
        total_value_in += r2.total_cost_minor
        
        # Transfer to another location
        t_out, t_in, _, _ = await service.apply_transfer(
            TransferTxn(
                sku_code="RECONCILE",
                location="WH-A",
                target_location="WH-B",
                qty=40,
                action="transfer",
                txn_metadata={},
            )
        )
        # Transfer is value-neutral (out = in)
        
        # Ship from both locations
        s2, _ = await service.apply_transaction(
            ShipTxn(
                sku_code="RECONCILE",
                location="WH-A",
                qty=20,
                action="ship",
                txn_metadata={},
            )
        )
        total_value_out += s2.total_cost_minor
        
        s3, _ = await service.apply_transaction(
            ShipTxn(
                sku_code="RECONCILE",
                location="WH-B",
                qty=15,
                action="ship",
                txn_metadata={},
            )
        )
        total_value_out += s3.total_cost_minor
        
        # Negative adjustment (shrinkage)
        adj, _ = await service.apply_transaction(
            AdjustTxn(
                sku_code="RECONCILE",
                location="WH-A",
                qty=-10,
                action="adjust",
                txn_metadata={"reason": "damaged"},
            )
        )
        total_value_out += abs(adj.total_cost_minor)
        
        # Calculate remaining inventory value across ALL locations
        result = await db_session.execute(
            select(CostRecord).filter_by(sku_code="RECONCILE", org_id=org.org_id)
        )
        cost_records = result.scalars().all()
        
        remaining_value = sum(
            cr.qty_remaining * cr.unit_cost_minor for cr in cost_records
        )
        
        # THE CRITICAL ASSERTION: Books must balance
        assert total_value_in == total_value_out + remaining_value, (
            f"Financial reconciliation failed!\n"
            f"Value In: {total_value_in}\n"
            f"Value Out: {total_value_out}\n"
            f"Remaining: {remaining_value}\n"
            f"Difference: {total_value_in - (total_value_out + remaining_value)}"
        )


    @pytest.mark.asyncio
    async def test_concurrent_wac_recompute_and_consumption(
        self,
        session_factory,
    ):
        """
        CRITICAL: WAC's _recompute_wac_layer must be safe during concurrent operations.
        This tests the most dangerous concurrent scenario in WAC.
        
        Tests that row locks prevent corruption when:
        - One transaction is receiving (triggering WAC recompute)
        - Another transaction is consuming (reading/modifying cost layers)
        """
        # Setup
        async with session_factory() as session:
            org = Organization(name="Test Org", valuation_method="WAC", currency="USD")
            session.add(org)
            await session.commit()
            org_id = org.org_id
        
        # Initial inventory: 10 @ $1.00
        async with session_factory() as session:
            service = TransactionService(session=session, org_id=org_id, user_id=None)
            await service.apply_transaction(
                ReceiveTxn(
                    sku_code="WAC-CONCURRENT",
                    sku_name="Item",
                    location="Warehouse",
                    qty=10,
                    unit_cost_major=1.00,
                    action="receive",
                    txn_metadata={},
                    alerts=False,
                    low_stock_threshold=1,
                )
            )
            await session.commit()
        
        # Two concurrent operations:
        # 1. Receive (triggers WAC recompute/merge)
        # 2. Ship (consumes from cost layers)
        
        async def concurrent_receive():
            async with session_factory() as session:
                service = TransactionService(session=session, org_id=org_id, user_id=None)
                result = await service.apply_transaction(
                    ReceiveTxn(
                        sku_code="WAC-CONCURRENT",
                        sku_name="Item",
                        location="Warehouse",
                        qty=10,
                        unit_cost_major=3.00,
                        action="receive",
                        txn_metadata={},
                        alerts=False,
                        low_stock_threshold=1,
                    )
                )
                await session.commit()
                return result
        
        async def concurrent_ship():
            async with session_factory() as session:
                service = TransactionService(session=session, org_id=org_id, user_id=None)
                result = await service.apply_transaction(
                    ShipTxn(
                        sku_code="WAC-CONCURRENT",
                        location="Warehouse",
                        qty=5,
                        action="ship",
                        txn_metadata={},
                    )
                )
                await session.commit()
                return result
        
        # Run concurrently
        results = await asyncio.gather(
            concurrent_receive(),
            concurrent_ship(),
            return_exceptions=True,
        )
        
        # Both should succeed (locks prevent corruption)
        errors = [r for r in results if isinstance(r, Exception)]
        assert len(errors) == 0, f"Concurrent WAC operations failed: {errors}"
        
        # Verify final state is consistent
        async with session_factory() as session:
            result = await session.execute(
                select(CostRecord).filter_by(
                    sku_code="WAC-CONCURRENT", 
                    org_id=org_id
                )
            )
            cost_records = result.scalars().all()
            
            # WAC should have merged to single layer
            assert len(cost_records) == 1
            
            # Expected: (10*100 + 10*300 - 5*avg) / 15
            # Initial: 10*100 = 1000
            # Added: 10*300 = 3000
            # Total before ship: 4000 value, 20 qty
            # Avg before ship: 200
            # Ship 5: removes 5*200 = 1000
            # Remaining: 3000 value, 15 qty
            # New avg: 200
            
            assert cost_records[0].qty_remaining == 15
            assert cost_records[0].unit_cost_minor == 200
