from typing import Tuple, Optional
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm.exc import StaleDataError
from uuid import UUID

from app.models import Transaction, State, SKU, Location, Organization
from app.schemas.actions import (
    ReceiveTxn, ShipTxn, 
    AdjustTxn, ReserveTxn, 
    UnreserveTxn, TransferTxn,
    TransferInTxn, TransferOutTxn
)
from app.services.exceptions import (
    TransactionBadRequest, 
    SKUNotFoundError,
    InsufficientStockError,
    CurrencyError
)
from app.core.db import async_session_maker
from app.services.state_updater import StateUpdater
from app.services.cost_tracker import CostTracker
from app.services.currency_service import CurrencyService
from app.services.alert_service import AlertService
from app.core.logger_config import logger


TransactionPayload = (
    ReceiveTxn | ShipTxn | AdjustTxn | 
    ReserveTxn | UnreserveTxn | 
    TransferTxn | TransferInTxn | TransferOutTxn
)


class TransactionService:
    """
    Core service for applying inventory transactions in a multi-tenant context.
    Handles transaction persistence, state updates, and cost tracking.
    """
    
    def __init__(
        self, 
        session: AsyncSession, 
        org_id: UUID,
        user_id: UUID | None = None,
        background_tasks: Optional[BackgroundTasks] = None
    ):
        """
        Initialize transaction service for a specific organization.
        
        Args:
            session: Database session
            org_id: Organization ID (tenant isolation)
            user_id: Optional user ID for audit trail
        """
        self.session = session
        self.org_id = org_id
        self.user_id = user_id
        self.state_updater = StateUpdater(session, org_id)
        self.cost_tracker = CostTracker(session, org_id)
        self.currency_service = CurrencyService()
        self._org_currency: Optional[str] = None
        self.background_tasks = background_tasks
        self._threshold_check_data: Optional[dict] = None
    
    async def _get_org_currency(self) -> str:
        """
        Lazy-load organization currency code.
        
        Returns:
            ISO 4217 currency code (e.g., 'USD', 'EUR', 'JPY')
        """
        if self._org_currency is None:
            result = await self.session.execute(
                select(Organization.currency).filter_by(org_id=self.org_id)
            )
            self._org_currency = result.scalar_one()
        return self._org_currency
    
    async def apply_transaction(
        self,
        txn_payload: TransactionPayload
    ) -> Tuple[Transaction, State]:
        """
        Apply a transaction: persist txn row, update inventory state, and track costs.
        
        Note: If txn_payload contains cost_price, it should be in major currency units (Decimal).
        This method automatically converts it to minor units (int) for internal storage.
        
        Args:
            txn_payload: Transaction payload from the API
            
        Returns:
            (persisted_transaction, updated_state)
            
        Raises:
            SKUNotFoundError: SKU doesn't exist for outbound transactions
            TransactionBadRequest: Invalid transaction
            InsufficientStockError: Not enough stock (with detailed breakdown)
            StaleDataError: Concurrent modification conflict
            CurrencyError: Invalid currency configuration
        """
        try:
            # Convert cost_price from major units (Decimal) to minor units (int) if present
            cost_price_minor = None
            if hasattr(txn_payload, 'cost_price') and txn_payload.cost_price:
                currency = await self._get_org_currency()
                cost_price_minor = self.currency_service.to_minor_units(
                    txn_payload.cost_price,
                    currency
                )
            
            # 1. Validate/create SKU - auto-create for receives, validate for others
            await self._ensure_sku_exists(txn_payload)
            
            # 2. Validate and get/create location
            location = await self._get_or_create_location(txn_payload.location)
            
            # 3. Get or create inventory state with row lock
            state = await self._get_or_create_state(
                txn_payload.sku_code,
                location.id,
                txn_payload.action
            )

            #  Capture org-wide available before transaction
            available_before = await self._get_org_wide_available_before(txn_payload.sku_code)
            
            if txn_payload.action == "ship":
                txn_payload.qty = -abs(txn_payload.qty)
            
            # 4. Create transaction record (with cost_price in minor units)
            transaction = await self._create_transaction(
                txn_payload, 
                location.id,
                state.on_hand,
                cost_price_minor
            )

            available_after = available_before + transaction.qty
            
            # 5. Update inventory state (may raise InsufficientStockError)
            try:
                await self.state_updater.update_state(state, transaction)
            except TransactionBadRequest as e:
                # Enrich error with inventory details if it's stock-related
                if "not enough" in str(e.detail).lower():
                    raise InsufficientStockError(
                        detail=str(e.detail),
                        sku_code=txn_payload.sku_code,
                        location=txn_payload.location,
                        requested=abs(transaction.qty),
                        available=state.available,
                        on_hand=state.on_hand,
                        reserved=state.reserved
                    )
                raise

            # Store threshold check data if this was an outbound transaction
            if transaction.is_outbound:
                self._threshold_check_data = {
                    'sku_code': txn_payload.sku_code,
                    'available_before': available_before,
                    'available_after': available_after
                }
            
            # 6. Track costs for costing methods (FIFO/LIFO/WAC)
            # Note: transaction.cost_price is already in minor units at this point
            if transaction.action in ["receive", "transfer_in", "adjust"] and transaction.cost_price and transaction.qty > 0:
                await self.cost_tracker.record_cost(transaction)
            elif transaction.action in ["ship", "transfer_out", "adjust"] and transaction.qty < 0:
                await self.cost_tracker.consume_cost(transaction)
            
            return transaction, state
            
        except SKUNotFoundError:
            # Re-raise with frontend-friendly error structure
            raise
        except InsufficientStockError:
            # Re-raise with detailed stock info
            raise
        except CurrencyError:
            raise TransactionBadRequest(
                detail="Invalid currency configuration for organization"
            )
        except StaleDataError:
            raise TransactionBadRequest(
                detail="Concurrent modification detected. Please retry."
            )

    async def apply_transfer(
        self,
        txn_payload: TransferTxn
    ) -> Tuple[Transaction, Transaction, State, State]:
        """
        Apply an atomic transfer with automatic cost calculation.
        Cost is determined by organization's valuation method.
        
        Note: Transfer costs are calculated internally in minor units and automatically
        converted for metadata display purposes.
        
        Args:
            txn_payload: Transfer transaction payload
            
        Returns:
            (transfer_out_txn, transfer_in_txn, source_state, target_state)
        """
        try:
            # 0. Retrieve SKU info (needed for potential auto-creation at target)
            sku_exists, sku_name = await self._get_sku_info(txn_payload.sku_code)
            if not sku_exists:
                raise SKUNotFoundError(
                    detail=f"SKU '{txn_payload.sku_code}' not found. Cannot transfer non-existent SKU.",
                    sku_code=txn_payload.sku_code
                )
            
            # 1. Calculate transfer cost from source location (returns int minor units)
            transfer_cost_minor = await self.cost_tracker.calculate_transfer_cost(
                sku_code=txn_payload.sku_code,
                location_id=await self._get_location_id(txn_payload.location),
                qty=txn_payload.qty
            )
            
            # Convert to major units for human-readable metadata display
            currency = await self._get_org_currency()
            transfer_cost_display = self.currency_service.format_amount(
                transfer_cost_minor,
                currency
            )
            
            # 2. Create transfer_out transaction
            transfer_out_payload = TransferOutTxn(
                action="transfer_out",
                sku_code=txn_payload.sku_code,
                qty=-abs(txn_payload.qty),
                location=txn_payload.location,
                txn_metadata={
                    **txn_payload.txn_metadata,
                    'target_location': txn_payload.target_location,
                    'transfer_cost_per_unit': float(transfer_cost_display)
                }
            )
            
            out_txn, source_state = await self.apply_transaction(transfer_out_payload)
            
            # 3. Convert minor units back to Decimal major units for transfer_in payload
            # (apply_transaction will convert it back to minor units for storage)
            transfer_cost_decimal = self.currency_service.to_major_units(
                transfer_cost_minor,
                currency
            )

            txn_metadata = txn_payload.txn_metadata.copy()
            txn_metadata.pop('target_location', None)
            
            # 4. Create transfer_in transaction with calculated cost AND sku_name
            transfer_in_payload = TransferInTxn(
                action="transfer_in",
                sku_code=txn_payload.sku_code,
                sku_name=sku_name,
                qty=abs(txn_payload.qty),
                location=txn_payload.target_location,
                cost_price=transfer_cost_decimal,
                alerts=getattr(txn_payload, 'alerts', True),
                reorder_point=getattr(txn_payload, 'reorder_point', 15),
                low_stock_threshold=getattr(txn_payload, 'low_stock_threshold', 10),
                txn_metadata={
                    **txn_metadata,
                    'source_location': txn_payload.location,
                    'transfer_cost_per_unit': float(transfer_cost_display)
                }
            )
            
            in_txn, target_state = await self.apply_transaction(transfer_in_payload)
            
            return out_txn, in_txn, source_state, target_state
            
        except (SKUNotFoundError, InsufficientStockError, TransactionBadRequest):
            raise
        except StaleDataError:
            raise TransactionBadRequest(
                detail="Concurrent modification detected during transfer. Please retry."
            )

    async def _get_location_id(self, location_name: str) -> UUID:
        """Helper to get location ID by name."""
        result = await self.session.execute(
            select(Location.id).filter_by(
                name=location_name,
                org_id=self.org_id
            )
        )
        location_id = result.scalar_one_or_none()
        if not location_id:
            raise TransactionBadRequest(
                detail=f"Location '{location_name}' not found"
            )
        return location_id
    
    async def _ensure_sku_exists(self, txn_payload: TransactionPayload) -> None:
        """
        Ensure SKU exists - auto-create for receive/transfer_in, validate for others.
        """
        result = await self.session.execute(
            select(SKU).filter_by(
                code=txn_payload.sku_code.upper(),
                org_id=self.org_id
            )
        )
        sku = result.scalar_one_or_none()
        
        if not sku:
            # Auto-create SKU for inbound transactions
            if txn_payload.action in ["receive", "transfer_in"]:
                # Extract alert settings from payload if available (receive action)
                alerts = getattr(txn_payload, 'alerts', True)
                reorder_point = getattr(txn_payload, 'reorder_point', 15)
                low_stock_threshold = getattr(txn_payload, 'low_stock_threshold', 10)
                
                sku = SKU(
                    code=txn_payload.sku_code.upper(),
                    name=txn_payload.sku_name,
                    org_id=self.org_id,
                    alerts=alerts,
                    reorder_point=reorder_point,
                    low_stock_threshold=low_stock_threshold,
                )
                self.session.add(sku)
                await self.session.flush()
            else:
                # For outbound transactions, SKU must exist
                raise SKUNotFoundError(
                    detail=f"SKU '{txn_payload.sku_code}' not found. Cannot perform '{txn_payload.action}' on non-existent SKU.",
                    sku_code=txn_payload.sku_code
                )
    
    async def _get_or_create_location(self, location_name: str) -> Location:
        """Get existing location or create new one for the organization."""
        result = await self.session.execute(
            select(Location).filter_by(
                name=location_name,
                org_id=self.org_id
            )
        )
        location = result.scalar_one_or_none()
        
        if not location:
            location = Location(
                name=location_name,
                org_id=self.org_id
            )
            self.session.add(location)
            await self.session.flush()
        
        return location
    
    async def _get_or_create_state(
        self,
        sku_code: str,
        location_id: UUID,
        action: str
    ) -> State:
        """
        Get existing state or create new one with row-level lock.
        Only allow state creation for inbound actions.
        """
        result = await self.session.execute(
            select(State)
            .filter_by(
                sku_code=sku_code.upper(),
                location_id=location_id,
                org_id=self.org_id
            )
            .with_for_update()
        )
        state = result.scalar_one_or_none()
        
        if state is None:
            if action not in ["receive", "transfer_in"]:
                raise TransactionBadRequest(
                    detail=f"SKU '{sku_code}' has no inventory at the specified location. "
                           f"Cannot perform '{action}' on non-existent inventory."
                )
            
            state = State(
                sku_code=sku_code.upper(),
                location_id=location_id,
                org_id=self.org_id,
                on_hand=0,
                reserved=0
            )
            self.session.add(state)
            await self.session.flush()
        
        return state
    
    async def _create_transaction(
        self,
        txn_payload: TransactionPayload,
        location_id: UUID,
        qty_before: int,
        cost_price_minor: Optional[int] = None
    ) -> Transaction:
        """
        Create and persist transaction record.
        
        Args:
            txn_payload: Transaction payload from the API
            location_id: Location UUID
            qty_before: Quantity before transaction
            cost_price_minor: Cost price already converted to minor units (int)
            
        Returns:
            Persisted Transaction instance with cost_price in minor units
        """
        txn_dict = txn_payload.model_dump(exclude={
            'location', 
            'sku_name', 
            'cost_price',
            'alerts',
            'reorder_point',
            'low_stock_threshold'
            })
        
        # Normalize sku_code to uppercase
        txn_dict['sku_code'] = txn_dict['sku_code'].upper()
        
        transaction = Transaction(
            org_id=self.org_id,
            location_id=location_id,
            qty_before=qty_before,
            created_by=self.user_id,
            cost_price=cost_price_minor,  # Store as integer minor units
            **txn_dict
        )
        
        self.session.add(transaction)
        await self.session.flush()
        
        return transaction
    
    async def _get_sku_info(self, sku_code: str) -> tuple[bool, str | None]:
        """
        Get SKU existence and name.
        
        Returns:
            (exists, name) tuple
        """
        result = await self.session.execute(
            select(SKU.name).filter_by(
                code=sku_code.upper(),
                org_id=self.org_id
            )
        )
        sku_name = result.scalar_one_or_none()
        return (sku_name is not None, sku_name)
    
    def schedule_low_stock_check(self) -> None:
        """
        Schedule a low stock check as a background task if threshold may have been crossed.
        
        This should be called AFTER the transaction is committed in the endpoint.
        The check runs asynchronously and won't block the response.
        """
        if not self.background_tasks or not self._threshold_check_data:
            return
        
        # Extract check data
        check_data = self._threshold_check_data
        
        # Schedule the check to run after response is sent
        self.background_tasks.add_task(
            self._perform_threshold_check,
            check_data['sku_code'],
            check_data['available_before'],
            check_data['available_after']
        )
    
    async def _perform_threshold_check(
        self,
        sku_code: str,
        available_before: int,
        available_after: int
    ) -> None:
        """
        Background task that checks if SKU crossed reorder point threshold.
        
        This runs AFTER the HTTP response has been sent to the client.
        Uses a new database session to avoid connection issues.
        """
        async with async_session_maker() as session:
            try:
                alert_service = AlertService(session, self.org_id)
                await alert_service.check_sku_crossed_threshold(
                    sku_code=sku_code,
                    qty_before=available_before,
                    qty_after=available_after
                )
                await session.commit()
            except Exception as e:
                # Log error but don't crash - this is a background task
                logger(f"Error in threshold check for SKU {sku_code}: {e}")
                await session.rollback()
    
    
    async def _get_org_wide_available_before(self, sku_code: str) -> int:
        """
        Calculate total available stock for a SKU across all locations
        before a transaction is committed.
        
        Args:
            sku_code: SKU to check
            
        Returns:
            Total available across all locations
        """
        result = await self.session.execute(
            select(
                func.coalesce(func.sum(State.available), 0)
            )
            .filter(
                State.sku_code == sku_code.upper(),
                State.org_id == self.org_id
            )
        )
        available = result.scalar_one_or_none()
        
        return available if available is not None else 0
     