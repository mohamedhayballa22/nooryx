import pytest
from uuid6 import uuid7
from unittest.mock import AsyncMock

from app.models import State, Transaction
from app.services.state_updater import StateUpdater
from app.services.exceptions import TransactionBadRequest


# Helper factory to create State objects for tests
def create_state(on_hand: int, reserved: int) -> State:
    """Factory function to create a State instance for testing."""
    state = State(on_hand=on_hand, reserved=reserved)
    # The State model has a hybrid property `available` which we can't set directly,
    # but we can assert its value.
    assert state.available == on_hand - reserved
    return state


# Helper factory to create Transaction objects for tests
def create_transaction(action: str, qty: int, metadata: dict | None = None) -> Transaction:
    """Factory function to create a Transaction instance for testing."""
    return Transaction(action=action, qty=qty, txn_metadata=metadata or {})


class TestStateUpdaterSuccess:
    """Tests for successful state transitions."""

    @pytest.fixture
    def state_updater(self) -> StateUpdater:
        """Provides a StateUpdater instance with a mocked session."""
        return StateUpdater(session=AsyncMock(), org_id=uuid7())

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            (create_state(10, 0), 5, create_state(15, 0)),
            (create_state(0, 0), 10, create_state(10, 0)),
            (create_state(10, 5), 5, create_state(15, 5)),
        ],
    )
    async def test_handle_receive(self, state_updater, initial_state, qty, expected_state):
        """Test that 'receive' action correctly increases on_hand quantity."""
        await state_updater._handle_receive(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            (create_state(10, 0), 5, create_state(10, 5)),
            (create_state(10, 5), 5, create_state(10, 10)),
            (create_state(10, 0), 10, create_state(10, 10)),
        ],
    )
    async def test_handle_reserve(self, state_updater, initial_state, qty, expected_state):
        """Test that 'reserve' action correctly increases reserved quantity."""
        await state_updater._handle_reserve(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            (create_state(10, 5), 5, create_state(10, 0)),
            (create_state(10, 10), 5, create_state(10, 5)),
            (create_state(10, 10), 10, create_state(10, 0)),
        ],
    )
    async def test_handle_unreserve(self, state_updater, initial_state, qty, expected_state):
        """Test that 'unreserve' action correctly decreases reserved quantity."""
        await state_updater._handle_unreserve(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            # Positive adjustment
            (create_state(10, 5), 5, create_state(15, 5)),
            # Negative adjustment (within limits)
            (create_state(10, 5), -2, create_state(8, 5)),
        ],
    )
    async def test_handle_adjust_success(self, state_updater, initial_state, qty, expected_state):
        """Test successful 'adjust' actions."""
        await state_updater._handle_adjust(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved
        
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            (create_state(20, 5), 10, create_state(10, 5)),
            (create_state(10, 0), 10, create_state(0, 0)),
        ],
    )
    async def test_handle_transfer_out(self, state_updater, initial_state, qty, expected_state):
        """Test that 'transfer_out' correctly decreases on_hand quantity."""
        await state_updater._handle_transfer_out(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            (create_state(10, 5), 10, create_state(20, 5)),
            (create_state(0, 0), 5, create_state(5, 0)),
        ],
    )
    async def test_handle_transfer_in(self, state_updater, initial_state, qty, expected_state):
        """Test that 'transfer_in' correctly increases on_hand quantity."""
        await state_updater._handle_transfer_in(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved


class TestShipmentStrategiesSuccess:
    """Tests for successful 'ship' action with different strategies."""

    @pytest.fixture
    def state_updater(self) -> StateUpdater:
        return StateUpdater(session=AsyncMock(), org_id=uuid7())

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            # Ship less than reserved
            (create_state(20, 10), 5, create_state(15, 5)),
            # Ship all reserved
            (create_state(20, 10), 10, create_state(10, 0)),
        ],
    )
    async def test_ship_from_reserved_success(self, state_updater, initial_state, qty, expected_state):
        """Test shipping exclusively from reserved stock."""
        await state_updater._ship_from_reserved(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            # Ship from available, leaving some available
            (create_state(20, 5), 10, create_state(10, 5)),
            # Ship all available
            (create_state(20, 5), 15, create_state(5, 5)),
        ],
    )
    async def test_ship_from_available_success(self, state_updater, initial_state, qty, expected_state):
        """Test shipping exclusively from available stock."""
        await state_updater._ship_from_available(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "initial_state, qty, expected_state",
        [
            # Case 1: Reserved stock is sufficient
            (create_state(20, 10), 5, create_state(15, 5)),
            (create_state(20, 10), 10, create_state(10, 0)),
            # Case 2: Reserved is insufficient, pulls from available
            (create_state(20, 5), 10, create_state(10, 0)),
            # Case 3: No reserved, pulls all from available
            (create_state(20, 0), 15, create_state(5, 0)),
            # Case 4: Ship all on_hand stock
            (create_state(20, 5), 20, create_state(0, 0)),
        ],
    )
    async def test_ship_default_success(self, state_updater, initial_state, qty, expected_state):
        """Test default shipping (reserved first, then available)."""
        await state_updater._ship_default(initial_state, qty)
        assert initial_state.on_hand == expected_state.on_hand
        assert initial_state.reserved == expected_state.reserved


class TestStateUpdaterFailures:
    """Tests for failed state transitions that should raise exceptions."""

    @pytest.fixture
    def state_updater(self) -> StateUpdater:
        return StateUpdater(session=AsyncMock(), org_id=uuid7())

    @pytest.mark.asyncio
    async def test_unsupported_action_raises_error(self, state_updater):
        """Test that an unsupported action string raises TransactionBadRequest."""
        state = create_state(10, 0)
        txn = create_transaction("delete", 1)
        with pytest.raises(TransactionBadRequest, match="Unsupported transaction action: delete"):
            await state_updater.update_state(state, txn)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, qty",
        [
            (create_state(10, 0), 11), # Not enough available
            (create_state(5, 5), 1),  # Not enough available (available is 0)
        ],
    )
    async def test_reserve_insufficient_stock_fails(self, state_updater, state, qty):
        """Test reserving more than available stock fails."""
        with pytest.raises(TransactionBadRequest, match="Not enough available stock to reserve"):
            await state_updater._handle_reserve(state, qty)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, qty",
        [
            (create_state(10, 5), 6), # Not enough reserved
            (create_state(10, 0), 1), # No reserved stock
        ],
    )
    async def test_unreserve_insufficient_stock_fails(self, state_updater, state, qty):
        """Test unreserving more than reserved stock fails."""
        with pytest.raises(TransactionBadRequest, match="Not enough reserved stock to unreserve"):
            await state_updater._handle_unreserve(state, qty)

    @pytest.mark.asyncio
    async def test_ship_from_reserved_insufficient_stock_fails(self, state_updater):
        """Test shipping from reserved with insufficient stock fails."""
        state = create_state(10, 5)
        with pytest.raises(TransactionBadRequest, match="Not enough reserved stock to ship"):
            await state_updater._ship_from_reserved(state, 6)

    @pytest.mark.asyncio
    async def test_ship_from_available_insufficient_stock_fails(self, state_updater):
        """Test shipping from available with insufficient stock fails."""
        state = create_state(10, 5) # Available is 5
        with pytest.raises(TransactionBadRequest, match="Not enough available stock to ship"):
            await state_updater._ship_from_available(state, 6)
            
    @pytest.mark.asyncio
    async def test_ship_default_insufficient_stock_fails(self, state_updater):
        """Test default shipping with insufficient total stock fails."""
        state = create_state(10, 5) # On hand is 10
        with pytest.raises(TransactionBadRequest, match="Not enough total stock to ship"):
            await state_updater._ship_default(state, 11)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, qty, expected_error",
        [
            # Adjustment results in negative on_hand
            (create_state(5, 0), -6, "result in negative inventory"),
            # Adjustment results in on_hand < reserved
            (create_state(10, 8), -3, "on_hand < reserved"),
        ],
    )
    async def test_adjust_invalid_fails(self, state_updater, state, qty, expected_error):
        """Test that invalid adjustments fail with the correct error."""
        with pytest.raises(TransactionBadRequest, match=expected_error):
            await state_updater._handle_adjust(state, qty)

    @pytest.mark.asyncio
    async def test_transfer_out_insufficient_stock_fails(self, state_updater):
        """Test transferring out more than on_hand stock fails."""
        state = create_state(10, 5)
        with pytest.raises(TransactionBadRequest, match="Not enough stock to transfer out"):
            await state_updater._handle_transfer_out(state, 11)
