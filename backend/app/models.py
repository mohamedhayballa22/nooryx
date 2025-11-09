from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Integer,
    String,
    ForeignKey,
    ForeignKeyConstraint,
    DateTime,
    func,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
import uuid
from app.core.db import Base
from fastapi_users.db import SQLAlchemyBaseUserTableUUID


class SKU(Base):
    """Stock Keeping Unit representing a distinct product or item."""

    __tablename__ = "skus"

    code = Column(String, nullable=False, primary_key=True, doc="Unique SKU code identifier.")
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), nullable=False, primary_key=True)
    name = Column(String, nullable=False, doc="Human-readable product name.")
    alerts = Column(Boolean, nullable=False, default=True, server_default="true")
    low_stock_threshold = Column(Integer, nullable=False, default=10, server_default="10")
    reorder_point = Column(Integer, nullable=False, default=15, server_default="15")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="sku")
    states = relationship("State", back_populates="sku")
    cost_records = relationship("CostRecord", back_populates="sku")
    organization = relationship("Organization", back_populates="skus")

    __table_args__ = (
        Index('ix_skus_org_code_prefix', 'org_id', 'code'),
        Index('ix_skus_org_name_trgm', func.lower(name), postgresql_using='gin', postgresql_ops={'lower': 'gin_trgm_ops'}),
    )


class Location(Base):
    """Physical or logical location where inventory is stored."""
    
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="location")
    states = relationship("State", back_populates="location")
    cost_records = relationship("CostRecord", back_populates="location")
    organization = relationship("Organization", back_populates="locations")

    __table_args__ = (
        UniqueConstraint("name", "org_id", name="uix_locations_org_id_name"),
        Index('ix_locations_orgid_lower_name_trgm', func.lower(name), postgresql_using='gin', postgresql_ops={'lower': 'gin_trgm_ops'}),
    )


class Transaction(Base):
    """Immutable ledger of all inventory movements (receipts, shipments, adjustments, reservations)."""

    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), index=True, nullable=False)
    sku_code = Column(String, nullable=False)
    location_id = Column(UUID(as_uuid=True), nullable=False)

    qty = Column(
        Integer, nullable=False, doc="Quantity delta (+= receipt, -= shipment)."
    )
    qty_before = Column(
        Integer, nullable=False, doc="Quantity before this transaction."
    )
    cost_price = Column(BigInteger, nullable=True, doc="Cost price per unit in minor units at time of txn.")

    action = Column(
        String,
        nullable=False,
        doc="Nature of transaction: receive, ship, adjust, reserve, unreserve, transfer_in, transfer_out.",
    )
    reference = Column(
        String,
        nullable=True,
        doc="External reference (order id, supplier invoice, etc.).",
    )
    txn_metadata = Column(
        JSONB,
        nullable=True,
        doc="Free-form JSON for contextual details (reason codes, batch numbers).",
    )

    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sku = relationship("SKU", back_populates="transactions")
    location = relationship("Location", back_populates="transactions")
    cost_records = relationship("CostRecord", back_populates="transaction", cascade="all, delete-orphan", overlaps="cost_records,sku,organization")
    organization = relationship("Organization", back_populates="transactions", overlaps="sku,transactions")
    created_by_user = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        ForeignKeyConstraint(
            ['sku_code', 'org_id'],
            ['skus.code', 'skus.org_id'],
            ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ['location_id'],
            ['locations.id'],
            ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ['created_by'],
            ['users.id'],
            ondelete="SET NULL"
        ),
        UniqueConstraint('id', 'org_id', name='uq_transactions_id_org_id'),
        Index('ix_transactions_org_id', 'org_id'),
        Index('ix_transactions_org_sku_loc', 'org_id', 'sku_code', 'location_id'),
        Index('ix_transactions_org_created', 'org_id', 'created_at'),
        Index('ix_transactions_sku_code', 'sku_code'),
        Index('ix_transactions_location_id', 'location_id'),
    )

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


class State(Base):
    """Current stock snapshot per SKU-location optimized for fast queries."""

    __tablename__ = "states"

    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), nullable=False, primary_key=True)
    sku_code = Column(String, primary_key=True)
    location_id = Column(UUID(as_uuid=True), primary_key=True)

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

    sku = relationship("SKU", back_populates="states")
    location = relationship("Location", back_populates="states")
    organization = relationship("Organization", back_populates="states", overlaps="sku,states")

    __table_args__ = (
        ForeignKeyConstraint(
            ['sku_code', 'org_id'],
            ['skus.code', 'skus.org_id'],
            ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ['location_id'],
            ['locations.id'],
            ondelete="CASCADE"
        ),
        CheckConstraint('reserved >= 0', name='ck_state_reserved_nonnegative'),
    )

    __mapper_args__ = {"version_id_col": version}

    @hybrid_property
    def available(self):
        """Derived: sellable units (on_hand - reserved)."""
        return self.on_hand - self.reserved

    @available.expression
    def available(cls):
        """SQL-level expression for the 'available' property."""
        return cls.on_hand - cls.reserved


class CostRecord(Base):
    """
    Tracks the cost basis and remaining quantity for valuation purposes.
    Used to support FIFO, LIFO, and WAC methods.
    """

    __tablename__ = "cost_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), nullable=False, index=True)
    sku_code = Column(String, nullable=False)
    location_id = Column(UUID(as_uuid=True), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), nullable=True)

    qty_in = Column(Integer, nullable=False, doc="Quantity received in this cost record.")
    qty_remaining = Column(Integer, nullable=False, doc="Quantity still available from this cost record.")
    cost_price = Column(BigInteger, nullable=False, doc="Cost price per unit in minor units.")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="cost_records", overlaps="cost_records,sku,organization")
    sku = relationship("SKU", back_populates="cost_records", overlaps="transaction,organization")
    location = relationship("Location", back_populates="cost_records")
    organization = relationship("Organization", back_populates="cost_records", overlaps="sku,transaction,cost_records")

    __table_args__ = (
        ForeignKeyConstraint(
            ['sku_code', 'org_id'],
            ['skus.code', 'skus.org_id'],
            ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ['location_id'],
            ['locations.id'],
            ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ['transaction_id', 'org_id'],
            ['transactions.id', 'transactions.org_id'],
            ondelete="CASCADE"
        ),
        UniqueConstraint("sku_code", "transaction_id", "org_id", name="uix_cost_records_org_sku_txn"),
        Index('ix_cost_records_org_sku_loc', 'org_id', 'sku_code', 'location_id'),
        Index('ix_cost_records_org_created', 'org_id', 'created_at'),
        Index('ix_cost_records_fifo_query', 'org_id', 'sku_code', 'location_id', 'qty_remaining', 'created_at'),
    )


class Organization(Base):
    """Represents a tenant organization in the multi-tenant design."""
    
    __tablename__ = "orgs"

    org_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    valuation_method = Column(String, nullable=False, default="WAC", doc="FIFO, LIFO, WAC")
    currency = Column(String(3), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    skus = relationship("SKU", back_populates="organization", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="organization", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="organization", cascade="all, delete-orphan", overlaps="sku,transactions")
    states = relationship("State", back_populates="organization", cascade="all, delete-orphan", overlaps="sku,states")
    cost_records = relationship("CostRecord", back_populates="organization", cascade="all, delete-orphan", overlaps="cost_records,sku,transaction")

    subscription = relationship("Subscription", uselist=False, back_populates="organization")
    settings = relationship("OrganizationSettings", uselist=False, back_populates="organization", cascade="all, delete-orphan")


class User(SQLAlchemyBaseUserTableUUID, Base):
    """User account with multi-tenant organization association."""
    
    __tablename__ = "users"

    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(String, doc="Job title of the user")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", back_populates="users")
    settings = relationship("UserSettings", uselist=False, back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("id", "org_id", name="uq_user_id_org_id"),
    )


class Subscription(Base):
    """Subscription and billing information for organizations."""
    
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), nullable=False, unique=True)
    plan_name = Column(String, nullable=True)
    status = Column(String, nullable=False, default="inactive")
    billing_frequency = Column(String, nullable=False, server_default="monthly", doc="monthly, yearly")
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="subscription")
    

class RefreshToken(Base):
    """Refresh tokens for managing user session persistence and rotation."""
    
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True, doc="SHA-256 hash of the refresh token.")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Integer, nullable=False, default=0, doc="0=active, 1=revoked")
    device_info = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)

    user = relationship("User", backref="refresh_tokens")

    __table_args__ = (
        ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            ondelete="CASCADE"
        ),
        Index('ix_refresh_tokens_user_id', 'user_id'),
        Index('ix_refresh_tokens_token_hash', 'token_hash'),
    )
    

class OrganizationSettings(Base):
    __tablename__ = "org_settings"

    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.org_id", ondelete="CASCADE"), primary_key=True)
    alerts = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", back_populates="settings")


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    locale = Column(String, nullable=False, default="system", server_default="system")
    pagination = Column(Integer, nullable=False, default=25, server_default="25")
    date_format = Column(String, nullable=False, default="system", server_default="system")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="settings")
