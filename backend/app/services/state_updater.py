from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction, State
from app.services.exceptions import TransactionBadRequest


class StateUpdater:
    """
    Handles inventory state updates based on transaction actions.
    Encapsulates all business logic for state transitions.
    """
    
    def __init__(self, session: AsyncSession, org_id: UUID):
        self.session = session
        self.org_id = org_id
    
    async def update_state(self, state: State, txn: Transaction) -> None:
        """
        Apply an inventory transaction to the state.
        
        Args:
            state: Current inventory state
            txn: Transaction to apply
            
        Raises:
            TransactionBadRequest: If transaction cannot be applied
        """
        action = txn.action
        qty = txn.qty
        
        if action == "receive":
            await self._handle_receive(state, qty)
        elif action == "reserve":
            await self._handle_reserve(state, qty)
        elif action == "unreserve":
            await self._handle_unreserve(state, qty)
        elif action == "ship":
            await self._handle_ship(state, qty, txn.txn_metadata)
        elif action == "adjust":
            await self._handle_adjust(state, qty)
        elif action == "transfer_out":
            await self._handle_transfer_out(state, qty)
        elif action == "transfer_in":
            await self._handle_transfer_in(state, qty)
        else:
            raise TransactionBadRequest(
                detail=f"Unsupported transaction action: {action}"
            )
    
    async def _handle_receive(self, state: State, qty: int) -> None:
        """Handle receiving inventory."""
        state.on_hand += qty
    
    async def _handle_reserve(self, state: State, qty: int) -> None:
        """Handle reserving inventory."""
        units = abs(qty)
        if state.available < units:
            raise TransactionBadRequest(
                detail=f"Not enough available stock to reserve. "
                       f"Available: {state.available}, Requested: {units}"
            )
        state.reserved += units
    
    async def _handle_unreserve(self, state: State, qty: int) -> None:
        """Handle unreserving inventory."""
        units = abs(qty)
        if state.reserved < units:
            raise TransactionBadRequest(
                detail=f"Not enough reserved stock to unreserve. "
                       f"Reserved: {state.reserved}, Requested: {units}"
            )
        state.reserved -= units
    
    async def _handle_ship(
        self, 
        state: State, 
        qty: int, 
        metadata: dict | None
    ) -> None:
        """Handle shipping inventory with flexible sourcing."""
        units = abs(qty)
        ship_from = metadata.get("ship_from") if metadata else None
        
        if ship_from == "reserved":
            await self._ship_from_reserved(state, units)
        elif ship_from == "available":
            await self._ship_from_available(state, units)
        else:
            # Default: ship from reserved first, then available
            await self._ship_default(state, units)
    
    async def _ship_from_reserved(self, state: State, units: int) -> None:
        """Ship exclusively from reserved stock."""
        if state.reserved < units:
            raise TransactionBadRequest(
                detail=f"Not enough reserved stock to ship. "
                       f"Reserved: {state.reserved}, Requested: {units}"
            )
        state.reserved -= units
        state.on_hand -= units
    
    async def _ship_from_available(self, state: State, units: int) -> None:
        """Ship exclusively from available (unreserved) stock."""
        if state.available < units:
            raise TransactionBadRequest(
                detail=f"Not enough available stock to ship. "
                       f"Available: {state.available}, Requested: {units}"
            )
        state.on_hand -= units
    
    async def _ship_default(self, state: State, units: int) -> None:
        """Ship from reserved first, then available."""
        if state.on_hand < units:
            raise TransactionBadRequest(
                detail=f"Not enough total stock to ship. "
                       f"On hand: {state.on_hand}, Requested: {units}"
            )
        
        if state.reserved >= units:
            state.reserved -= units
            state.on_hand -= units
        else:
            # Use all reserved, then take from available
            state.reserved = 0
            state.on_hand -= units
    
    async def _handle_adjust(self, state: State, qty: int) -> None:
        """Handle inventory adjustment."""
        new_on_hand = state.on_hand + qty
        if new_on_hand < 0:
            raise TransactionBadRequest(
                detail=f"Adjustment would result in negative inventory. "
                       f"Current: {state.on_hand}, Adjustment: {qty}"
            )
        if new_on_hand < state.reserved:
            raise TransactionBadRequest(
                detail=f"Adjustment would result in on_hand < reserved. "
                       f"Reserved: {state.reserved}, New on_hand: {new_on_hand}"
            )
        state.on_hand = new_on_hand
    
    async def _handle_transfer_out(self, state: State, qty: int) -> None:
        """Handle transferring inventory out."""
        units = abs(qty)
        if state.on_hand < units:
            raise TransactionBadRequest(
                detail=f"Not enough stock to transfer out. "
                       f"On hand: {state.on_hand}, Requested: {units}"
            )
        state.on_hand -= units
    
    async def _handle_transfer_in(self, state: State, qty: int) -> None:
        """Handle receiving transferred inventory."""
        units = abs(qty)
        state.on_hand += units
