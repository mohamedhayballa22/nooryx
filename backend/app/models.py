from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, JSON, func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base, column_property
from sqlalchemy.ext.hybrid import hybrid_property
import uuid

Base = declarative_base()


class InventoryTransaction(Base):
    __tablename__ = "inventory_txn"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku_id = Column(Integer, nullable=False, index=True, doc="SKU identifier this transaction applies to.")
    location_id = Column(Integer, nullable=False, index=True, default=1, doc="Warehouse/location where the transaction occurred.")
    qty = Column(Integer, nullable=False, doc="Quantity delta (+ve = receipt, -ve = shipment).")

    type = Column(
        String,
        nullable=False,
        doc="Nature of transaction: receive, ship, adjust, reserve, unreserve, transfer."
    )
    reference = Column(String, nullable=True, doc="External reference (order id, supplier invoice, etc.).")
    metadata = Column(JSON, nullable=True, doc="Free-form JSON for contextual details (reason codes, batch numbers).")

    created_by = Column(String, nullable=True, doc="Actor who created the transaction (user/service).")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryState(Base):
    __tablename__ = "inventory_state"

    sku_id = Column(Integer, primary_key=True)
    location_id = Column(Integer, primary_key=True, default=1)

    on_hand = Column(Integer, nullable=False, default=0, doc="Total physical stock recorded at this location.")
    reserved = Column(Integer, nullable=False, default=0, doc="Units promised to orders but not yet shipped.")
    available = column_property(on_hand - reserved, doc="Derived: sellable units (on_hand - reserved).")

    version = Column(Integer, nullable=False, default=0, doc="Optimistic concurrency control version counter.")

    __mapper_args__ = {"version_id_col": version}


class Serial(Base):
    __tablename__ = "serials"

    serial = Column(String, primary_key=True)
    sku_id = Column(Integer, nullable=False, index=True, doc="SKU identifier this serial belongs to.")
    location_id = Column(Integer, nullable=False, index=True, default=1, doc="Current warehouse/location of this serial.")

    status = Column(
        String,
        nullable=False,
        default="in_stock",
        doc="Lifecycle state of this unit: in_stock, reserved, shipped, in_repair."
    )
    current_tx_id = Column(
        Integer,
        ForeignKey("inventory_txn.id", ondelete="SET NULL"),
        nullable=True,
        doc="Pointer to the last inventory transaction affecting this serial."
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("InventoryTransaction", backref="serials")

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
    __tablename__ = "reservations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(String, nullable=False, index=True, doc="Business order identifier this reservation belongs to.")
    sku_id = Column(Integer, nullable=False, index=True, doc="SKU being reserved.")
    location_id = Column(Integer, nullable=False, index=True, default=1, doc="Location where stock is reserved from.")
    qty = Column(Integer, nullable=False, doc="Number of units reserved.")

    expires_at = Column(DateTime(timezone=True), nullable=True, doc="Optional expiry timestamp after which reservation auto-releases.")
    status = Column(
        String,
        nullable=False,
        default="active",
        doc="Lifecycle: active, fulfilled, cancelled, expired."
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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
