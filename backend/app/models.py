from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, JSON, func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base, column_property
import uuid

Base = declarative_base()


class InventoryTransaction(Base):
    __tablename__ = "inventory_txn"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=False, index=True, default=1)
    qty = Column(Integer, nullable=False)  # +ve for receipts, -ve for shipments

    type = Column(
        String,
        nullable=False,  # e.g. 'receive', 'ship', 'adjust', 'reserve', 'unreserve', 'transfer'
    )
    reference = Column(String, nullable=True)  # order id, supplier invoice, etc.
    metadata = Column(JSON, nullable=True)

    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryState(Base):
    __tablename__ = "inventory_state"

    sku_id = Column(Integer, primary_key=True)
    location_id = Column(Integer, primary_key=True, default=1)

    on_hand = Column(Integer, nullable=False, default=0)
    reserved = Column(Integer, nullable=False, default=0)
    available = column_property(on_hand - reserved)

    version = Column(Integer, nullable=False, default=0)  # optimistic locking / OCC


class Serial(Base):
    __tablename__ = "serials"

    serial = Column(String, primary_key=True)
    sku_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=False, index=True, default=1)

    status = Column(
        String,
        nullable=False,  # 'in_stock','reserved','shipped','in_repair'
        default="in_stock"
    )
    current_tx_id = Column(
        Integer,
        ForeignKey("inventory_txn.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("InventoryTransaction", backref="serials")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(String, nullable=False, index=True)
    sku_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=False, index=True, default=1)
    qty = Column(Integer, nullable=False)

    expires_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, default="active")  # active, fulfilled, cancelled, expired

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("order_id", "sku_id", "location_id", name="uq_order_sku_loc"),
    )
