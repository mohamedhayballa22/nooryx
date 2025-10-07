from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    JSON,
    func,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
import uuid
from app.core.db import Base
from app.services.transaction.exceptions import TransactionBadRequest


class InventoryTransaction(Base):
    """Immutable ledger of all inventory movements (receipts, shipments, adjustments, reservations)."""

    __tablename__ = "inventory_txn"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku_id = Column(
        String,
        nullable=False,
        index=True,
        doc="SKU identifier this transaction applies to.",
    )
    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
        index=True,
        doc="Warehouse/location where the transaction occurred.",
    )
    qty = Column(
        Integer, nullable=False, doc="Quantity delta (+ve = receipt, -ve = shipment)."
    )
    qty_before = Column(
        Integer, nullable=False, doc="Quantity before this transaction."
    )
    action = Column(
        String,
        nullable=False,
        doc="Nature of transaction: receive, ship, adjust, reserve, unreserve, transfer.",
    )
    reference = Column(
        String,
        nullable=True,
        doc="External reference (order id, supplier invoice, etc.).",
    )
    txn_metadata = Column(
        JSON,
        nullable=True,
        doc="Free-form JSON for contextual details (reason codes, batch numbers).",
    )

    created_by = Column(
        String, nullable=True, doc="Actor who created the transaction (user/service)."
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    location = relationship("Location", backref="transactions")

    # Transaction intent helpers
    @hybrid_property
    def is_inbound(self):
        """True if this transaction increases inventory (positive quantity delta)."""
        return self.qty > 0

    @is_inbound.expression
    def is_inbound(cls):
        return cls.qty > 0

    @hybrid_property
    def is_outbound(self):
        """True if this transaction decreases inventory (negative quantity delta)."""
        return self.qty < 0

    @is_outbound.expression
    def is_outbound(cls):
        return cls.qty < 0

    @property
    def narrative(self):
        """Generate human-readable one-liner describing this transaction."""
        qty_abs = abs(self.qty)
        
        templates = {
            'receive': f"Received {qty_abs} units",
            'ship': f"Shipped {qty_abs} units", 
            'adjust': f"Adjusted by {self.qty:+d} units",
            'reserve': f"Reserved {qty_abs} units",
            'unreserve': f"Released {qty_abs} units from reservation",
            'transfer': f"Transferred {qty_abs} units",
            'transfer_in': f"Received {abs(qty_abs)} units from transfer",
            'transfer_out': f"Transferred {abs(qty_abs)} units out",
        }
        
        base_narrative = templates.get(self.action, f"{self.action.title()}: {self.qty:+d} units")
        
        if self.reference:
            base_narrative += f" (ref: {self.reference})"
            
        if self.txn_metadata:
            if 'reason' in self.txn_metadata:
                base_narrative += f" - {self.txn_metadata['reason']}"
            elif 'batch' in self.txn_metadata:
                base_narrative += f" - batch {self.txn_metadata['batch']}"
                
        return base_narrative


class InventoryState(Base):
    """Current stock snapshot per SKU/location, derived from transactions but optimized for fast queries."""

    __tablename__ = "inventory_state"

    sku_id = Column(String, primary_key=True)
    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        primary_key=True,
        nullable=False,
        index=True,
        doc="Warehouse/location where the transaction occurred.",
    )

    product_name = Column(String, nullable=False)

    on_hand = Column(
        Integer,
        nullable=False,
        default=0,
        doc="Total physical stock recorded at this location.",
    )
    reserved = Column(
        Integer,
        nullable=False,
        default=0,
        doc="Units promised to orders but not yet shipped.",
    )

    version = Column(
        Integer,
        nullable=False,
        default=0,
        doc="Optimistic concurrency control version counter.",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    location = relationship("Location", backref="inventory_states")

    __mapper_args__ = {"version_id_col": version}

    @hybrid_property
    def available(self):
        """Derived: sellable units (on_hand - reserved)."""
        return self.on_hand - self.reserved

    @available.expression
    def available(cls):
        """SQL-level expression for the 'available' property."""
        return cls.on_hand - cls.reserved

    def update_state(self, txn: "InventoryTransaction"):
        """
        Apply an inventory transaction to this state.
        
        Args:
            txn (InventoryTransaction): The transaction instance.
        
        Raises:
            TransactionBadRequest: If the transaction cannot be applied due to stock levels or the action is not supported.
        """
        action = txn.action
        qty = txn.qty

        if action == "receive":
            self.on_hand += qty

        elif action == "reserve":
            units = abs(qty)
            if self.available < units:
                raise TransactionBadRequest(detail="Not enough available stock to reserve")
            self.reserved += units

        elif action == "unreserve":
            units = abs(qty)
            if self.reserved < units:
                raise TransactionBadRequest(detail="Not enough reserved stock to unreserve")
            self.reserved -= units

        elif action == "ship":
            ship_from = txn.txn_metadata.get("ship_from") if txn.txn_metadata else None
            units = abs(qty)

            if ship_from == "reserved":
                if self.reserved < units:
                    raise TransactionBadRequest(detail="Not enough reserved stock to ship")
                self.reserved -= units
                self.on_hand -= units

            elif ship_from == "available":
                if self.available < units:
                    raise TransactionBadRequest(detail="Not enough available stock to ship")
                self.on_hand -= units

            else:  # ship from reserved first, then available (available being on_hand - reserved)
                if self.reserved >= units:
                    self.reserved -= units
                    self.on_hand -= units
                else:
                    if self.on_hand < units:
                        raise TransactionBadRequest(detail="Not enough total on-hand stock to ship")
                    self.reserved = 0
                    self.on_hand -= units 

        elif action == "adjust":
            self.on_hand += qty
            if self.on_hand < 0:
                raise TransactionBadRequest(detail="Adjustment results in negative on-hand quantity")
            
        elif action in ("transfer_out", "transfer_in"):
            units = abs(qty)
            
            if action == "transfer_out":
                if self.on_hand < units:
                    raise TransactionBadRequest(detail="Not enough on-hand stock to transfer out")
                self.on_hand -= units
            else:  # transfer_in
                self.on_hand += units

        else:
            raise TransactionBadRequest(f"Unsupported transaction action: {action}")


class Serial(Base):
    """Tracks individual serialized units (e.g. devices) with lifecycle state and transaction linkage."""

    __tablename__ = "serials"

    serial = Column(String, primary_key=True)
    sku_id = Column(
        String,
        nullable=False,
        index=True,
        doc="SKU identifier this serial belongs to.",
    )
    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
        index=True,
        doc="Warehouse/location where the transaction occurred.",
    )

    status = Column(
        String,
        nullable=False,
        default="in_stock",
        doc="Lifecycle state of this unit: in_stock, reserved, shipped, in_repair.",
    )
    current_tx_id = Column(
        Integer,
        ForeignKey("inventory_txn.id", ondelete="SET NULL"),
        nullable=True,
        doc="Pointer to the last inventory transaction affecting this serial.",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("InventoryTransaction", backref="serials")
    location = relationship("Location", backref="serials")

    # Helper for lifecycle flags
    @hybrid_property
    def is_reserved(self):
        return self.status == "reserved"

    @is_reserved.expression
    def is_reserved(cls):
        return cls.status == "reserved"

    @hybrid_property
    def is_shipped(self):
        return self.status == "shipped"

    @is_shipped.expression
    def is_shipped(cls):
        return cls.status == "shipped"


class Reservation(Base):
    """Holds stock reservations tied to orders, ensuring availability and preventing oversells."""

    __tablename__ = "reservations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(
        String,
        nullable=False,
        index=True,
        doc="Business order identifier this reservation belongs to.",
    )
    sku_id = Column(String, nullable=False, index=True, doc="SKU being reserved.")
    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
        index=True,
        doc="Warehouse/location where the transaction occurred.",
    )
    qty = Column(Integer, nullable=False, doc="Number of units reserved.")

    expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        doc="Optional expiry timestamp after which reservation auto-releases.",
    )
    status = Column(
        String,
        nullable=False,
        default="active",
        doc="Lifecycle: active, fulfilled, cancelled, expired.",
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location = relationship("Location", backref="reservations")

    __table_args__ = (
        UniqueConstraint("order_id", "sku_id", "location_id", name="uq_order_sku_loc"),
    )

    # Encapsulate "is this reservation actually valid right now?"
    @hybrid_property
    def is_active(self):
        if self.status != "active":
            return False
        if self.expires_at is None:
            return True
        return self.expires_at >= func.now()

    @is_active.expression
    def is_active(cls):
        return (cls.status == "active") & (
            (cls.expires_at == None) | (cls.expires_at >= func.now())
        )
    

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), index=True, unique=True, nullable=False, doc="Warehouse/location where the transaction occurred.")
    code = Column(String(20), nullable=True)
