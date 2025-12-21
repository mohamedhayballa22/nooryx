from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Transaction, CostRecord, Organization
from app.services.exceptions import TransactionBadRequest, InsufficientStockError


class CostTracker:
    """
    Handles cost tracking for FIFO, LIFO, and WAC valuation methods.
    Responsible for maintaining CostRecord layers (cost basis) and 
    consuming them according to the organization's chosen valuation method.
    """

    def __init__(self, session: AsyncSession, org_id: UUID):
        self.session = session
        self.org_id = org_id
        self._valuation_method = None

    async def get_valuation_method(self) -> str:
        """Fetch and cache the organization's valuation method."""
        if self._valuation_method is None:
            result = await self.session.execute(
                select(Organization.valuation_method)
                .filter_by(org_id=self.org_id)
            )
            self._valuation_method = result.scalar_one()
        return self._valuation_method

    async def _get_cost_records(
        self, 
        sku_code: str, 
        location_id: UUID, 
        order_by=None,
        lock: bool = False
    ):
        query = (
            select(CostRecord)
            .filter_by(
                org_id=self.org_id,
                sku_code=sku_code,
                location_id=location_id
            )
            .filter(CostRecord.qty_remaining > 0)
        )
        
        if order_by is not None:
            if isinstance(order_by, list):
                query = query.order_by(*order_by) # Unpack list for multiple columns
            else:
                query = query.order_by(order_by)
        
        if lock:
            query = query.with_for_update()
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def record_cost(self, txn: Transaction) -> None:
        """
        Record a cost basis for inbound transactions.
        Creates a CostRecord for FIFO/LIFO/WAC tracking.
        """

        # Any physical inventory addition MUST have a cost layer.
        total_cost_minor = txn.total_cost_minor if txn.total_cost_minor is not None else 0
        
        # Convert to cost per unit
        unit_cost_minor = total_cost_minor // abs(txn.qty)

        cost_record = CostRecord(
            org_id=self.org_id,
            sku_code=txn.sku_code,
            location_id=txn.location_id,
            transaction_id=txn.id,
            qty_in=abs(txn.qty),
            qty_remaining=abs(txn.qty),
            unit_cost_minor=int(unit_cost_minor),
        )

        self.session.add(cost_record)
        await self.session.flush()

        # If valuation method is WAC, recompute weighted average layer for performance
        valuation_method = await self.get_valuation_method()
        if valuation_method == "WAC":
            await self._recompute_wac_layer(txn.sku_code, txn.location_id)

    async def _recompute_wac_layer(self, sku_code: str, location_id: UUID) -> None:
        """
        Merge all WAC cost layers into a single averaged one for this SKU/location.
        
        Must lock cost records during WAC recomputation to prevent concurrent
        consumption during the merge operation.
        """
        cost_records = await self._get_cost_records(sku_code, location_id, lock=True)
        if not cost_records:
            return

        total_qty = sum(cr.qty_remaining for cr in cost_records)
        total_value = sum(cr.qty_remaining * cr.unit_cost_minor for cr in cost_records)
        if total_qty <= 0:
            return

        avg_cost = total_value // total_qty

        # Delete existing layers and replace with one merged layer
        for cr in cost_records:
            await self.session.delete(cr)

        merged_record = CostRecord(
            org_id=self.org_id,
            sku_code=sku_code,
            location_id=location_id,
            qty_in=total_qty,
            qty_remaining=total_qty,
            unit_cost_minor=avg_cost,
        )
        self.session.add(merged_record)
        await self.session.flush()

    async def consume_cost(self, txn: Transaction) -> int:
        """
        Consume cost layers for outbound transactions.
        Returns total cost (in minor units) of goods consumed.
        
        Acquires row locks on cost records BEFORE consumption to prevent
        race conditions where multiple concurrent outbound transactions attempt to
        consume from the same cost layers simultaneously.
        """
        valuation_method = await self.get_valuation_method()
        units_to_consume = abs(txn.qty)
        
        if valuation_method == "FIFO":
            return await self._consume_fifo(txn, units_to_consume)
        elif valuation_method == "LIFO":
            return await self._consume_lifo(txn, units_to_consume)
        elif valuation_method == "WAC":
            return await self._consume_wac(txn, units_to_consume)
        else:
            raise TransactionBadRequest(
                detail=f"Unsupported valuation method: {valuation_method}"
            )

    async def _consume_fifo(self, txn: Transaction, units: int) -> int:
        """
        Consume using First-In-First-Out method.
        Locks cost records in FIFO order to ensure consistent cost layer consumption.
        """
        cost_records = await self._get_cost_records(
            txn.sku_code, 
            txn.location_id, 
            # Sort by oldest time, then oldest ID
            order_by=[CostRecord.created_at.asc(), CostRecord.id.asc()], 
            lock=True
        )
        return await self._consume_from_records(cost_records, units)

    async def _consume_lifo(self, txn: Transaction, units: int) -> int:
        """
        Consume using Last-In-First-Out method.
        Locks cost records in LIFO order to ensure consistent cost layer consumption.
        """
        cost_records = await self._get_cost_records(
            txn.sku_code, 
            txn.location_id, 
            # Sort by newest time, then newest ID
            order_by=[CostRecord.created_at.desc(), CostRecord.id.desc()], 
            lock=True
        )
        return await self._consume_from_records(cost_records, units)

    async def _consume_wac(self, txn: Transaction, units: int) -> int:
        """
        Consume using Weighted Average Cost method.
        Locks all cost records to prevent concurrent modifications during WAC calculation.
        """
        cost_records = await self._get_cost_records(
            txn.sku_code, 
            txn.location_id,
            lock=True  # Lock before consumption
        )
        if not cost_records:
            raise InsufficientStockError(detail="No cost basis found for WAC consumption")

        total_qty = sum(cr.qty_remaining for cr in cost_records)
        total_value = sum(cr.qty_remaining * cr.unit_cost_minor for cr in cost_records)
        if total_qty <= 0:
            raise InsufficientStockError(detail="No available quantity for WAC consumption")

        avg_cost = total_value // total_qty
        remaining_to_consume = units

        # Compute ideal proportional consumptions in floats
        proportional_quantities = [
            (cr, (cr.qty_remaining / total_qty) * units) for cr in cost_records
        ]

        # Convert to integers, track rounding error
        int_quantities = [(cr, int(q)) for cr, q in proportional_quantities]
        consumed_total = sum(q for _, q in int_quantities)
        rounding_error = units - consumed_total

        # Correct rounding by distributing ±1 adjustments deterministically
        for cr, _ in proportional_quantities:
            if rounding_error == 0:
                break
            if rounding_error > 0 and cr.qty_remaining > 0:
                for rec in int_quantities:
                    if rec[0] == cr:
                        rec = (rec[0], rec[1] + 1)
                        rounding_error -= 1
                        break
            elif rounding_error < 0:
                for rec in int_quantities:
                    if rec[0] == cr and rec[1] > 0:
                        rec = (rec[0], rec[1] - 1)
                        rounding_error += 1
                        break

        # Apply reductions to LOCKED records
        for cr, consume_qty in int_quantities:
            cr.qty_remaining -= consume_qty
            if cr.qty_remaining < 0:
                cr.qty_remaining = 0
            remaining_to_consume -= consume_qty

        if remaining_to_consume != 0:
            raise InsufficientStockError(detail="WAC rounding mismatch detected")

        await self.session.flush()
        return units * avg_cost

    async def _consume_from_records(self, cost_records: list[CostRecord], units: int) -> int:
        """
        Consume units from cost records sequentially (FIFO/LIFO).
        Updates qty_remaining and returns total cost in minor units.
        
        NOTE: cost_records must already be locked via with_for_update()
        """
        total_consumed_cost = 0
        remaining_to_consume = units

        for record in cost_records:
            if remaining_to_consume <= 0:
                break

            consume_qty = min(record.qty_remaining, remaining_to_consume)
            total_consumed_cost += consume_qty * record.unit_cost_minor
            record.qty_remaining -= consume_qty
            remaining_to_consume -= consume_qty

        if remaining_to_consume > 0:
            raise InsufficientStockError(
                detail=f"Not enough cost layers to cover {units} units."
            )

        await self.session.flush()
        return total_consumed_cost

    async def calculate_cost_basis(
        self, sku_code: str, location_id: UUID, qty: int
    ) -> int:
        """
        Calculate the cost basis (per unit, in minor units) for consuming a specific quantity.
        Used ONLY for outbound transactions (ship, transfer_out, negative adjustments).
        
        This is a READ-ONLY operation that does NOT modify cost records, so no locking needed.
        Actual consumption happens later in consume_cost() which DOES acquire locks.
        
        Args:
            sku_code: SKU identifier
            location_id: Location UUID
            qty: Quantity to consume (must be positive)
        
        Returns:
            Unit cost (int) in minor units
            
        Raises:
            TransactionBadRequest: If no cost records exist or insufficient stock
        """
        if qty <= 0:
            raise TransactionBadRequest(
                detail="calculate_cost_basis requires positive quantity for outbound valuation."
            )
        
        valuation_method = await self.get_valuation_method()

        if valuation_method == "FIFO":
            order_by = CostRecord.created_at.asc()
        elif valuation_method == "LIFO":
            order_by = CostRecord.created_at.desc()
        else:  # WAC
            order_by = None

        # No lock needed - this is read-only calculation
        cost_records = await self._get_cost_records(
            sku_code, 
            location_id, 
            order_by=order_by,
            lock=False
        )
        if not cost_records:
            raise TransactionBadRequest(
                detail=f"No cost records found for SKU '{sku_code}' at the specified location."
            )

        if valuation_method == "WAC":
            total_value = sum(cr.unit_cost_minor * cr.qty_remaining for cr in cost_records)
            total_qty = sum(cr.qty_remaining for cr in cost_records)
            if total_qty == 0:
                raise TransactionBadRequest(
                    detail="No inventory available for WAC valuation."
                )
            return total_value // total_qty

        # FIFO / LIFO: Calculate weighted average across layers consumed
        remaining_to_consume = qty
        total_cost = 0
        total_qty_costed = 0

        for record in cost_records:
            if remaining_to_consume <= 0:
                break
            qty_from_record = min(record.qty_remaining, remaining_to_consume)
            total_cost += record.unit_cost_minor * qty_from_record
            total_qty_costed += qty_from_record
            remaining_to_consume -= qty_from_record

        if total_qty_costed == 0:
            raise InsufficientStockError(
                detail=f"Insufficient stock to consume {qty} units.",
                sku_code=sku_code,
                location=None,  # Location name not available here
                requested=qty,
                available=sum(cr.qty_remaining for cr in cost_records),
                on_hand=None,
                reserved=None
            )

        return total_cost // total_qty_costed


    async def infer_positive_adjustment_cost(
        self, sku_code: str, location_id: UUID
    ) -> int:
        """
        Infer the unit cost for a positive adjustment when user doesn't provide explicit cost.
        
        Strategy is valuation-method aware:
        - FIFO: Use most recent (newest) cost layer - new inventory likely from recent batches
        - LIFO: Use most recent (newest) cost layer - consistent with "last in" principle  
        - WAC: Use weighted average across all existing layers - maintains average cost
        
        This is a READ-ONLY inference operation, so no locking needed.
        
        Args:
            sku_code: SKU identifier
            location_id: Location UUID
        
        Returns:
            Inferred unit cost (int) in minor units
            
        Raises:
            TransactionBadRequest: If no cost records exist to infer from
        """
        valuation_method = await self.get_valuation_method()
        
        # Get cost records ordered by most recent first (no lock - read-only)
        cost_records = await self._get_cost_records(
            sku_code, 
            location_id, 
            order_by=CostRecord.created_at.desc(),
            lock=False
        )
        
        if not cost_records:
            raise TransactionBadRequest(
                detail=f"No cost history found for SKU '{sku_code}' to infer adjustment cost."
            )
        
        if valuation_method == "WAC":
            # WAC: Use weighted average across all existing layers
            total_value = sum(cr.unit_cost_minor * cr.qty_remaining for cr in cost_records)
            total_qty = sum(cr.qty_remaining for cr in cost_records)
            
            if total_qty == 0:
                # All layers exhausted, fall back to most recent cost
                return cost_records[0].unit_cost_minor
            
            return total_value // total_qty
        
        else:  # FIFO or LIFO
            # Use most recent cost layer (newest purchase)
            return cost_records[0].unit_cost_minor
    

    async def get_last_known_cost(self, sku_code: str, location_id: UUID) -> Optional[int]:
        """
        Fetch the cost of the most recent transaction for this SKU/Location,
        regardless of whether the stock is currently present (qty_remaining >= 0).
        Used for inferring value of 'found' items when stock is currently 0.
        
        Read-only operation - no locking needed.
        """
        result = await self.session.execute(
            select(CostRecord.unit_cost_minor)
            .filter_by(
                org_id=self.org_id,
                sku_code=sku_code,
                location_id=location_id
            )
            .order_by(CostRecord.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
