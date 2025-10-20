from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Literal
from decimal import Decimal


class BaseTxn(BaseModel):
    """Base transaction schema with common fields."""
    sku_code: str = Field(..., description="SKU code identifier")
    location: str = Field(..., description="Location name where transaction occurs")
    reference: Optional[str] = Field(None, description="External reference (PO, invoice, order ID)")
    txn_metadata: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    
    @field_validator('sku_code')
    @classmethod
    def validate_sku_code(cls, v: str) -> str:
        return v.upper()


class ReceiveTxn(BaseTxn):
    """Receive inventory into a location."""
    sku_name: str = Field(..., description="Product name for SKU creation if needed")
    action: Literal["receive"] = "receive"
    qty: int = Field(..., gt=0, description="Quantity to receive (positive)")
    cost_price: Decimal = Field(..., gt=0, description="Cost price per unit received")
    

class ShipTxn(BaseTxn):
    """Ship inventory from a location."""
    action: Literal["ship"] = "ship"
    qty: int = Field(..., lt=0, description="Quantity to ship (negative)")
    txn_metadata: Optional[Dict[str, Any]] = Field(
        None, 
        description="Optional: {ship_from: 'reserved'|'available'|'auto'}"
    )
    
    @field_validator('txn_metadata')
    @classmethod
    def validate_ship_from(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Validate ship_from option if provided."""
        if v and 'ship_from' in v:
            valid_options = {'reserved', 'available', 'auto'}
            if v['ship_from'] not in valid_options:
                raise ValueError(f"ship_from must be one of {valid_options}")
        return v


class AdjustTxn(BaseTxn):
    """Adjust inventory (correction, damage, etc)."""
    action: Literal["adjust"] = "adjust"
    qty: int = Field(..., ne=0, description="Adjustment delta (positive or negative)")
    txn_metadata: Dict[str, Any] = Field(..., description="Must include 'reason' field")
    
    @field_validator('txn_metadata')
    @classmethod
    def validate_reason(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure adjustment has a reason."""
        if 'reason' not in v or not v['reason']:
            raise ValueError("Adjustment metadata must include 'reason' field")
        return v


class ReserveTxn(BaseTxn):
    """Reserve inventory for an order."""
    action: Literal["reserve"] = "reserve"
    qty: int = Field(..., gt=0, description="Quantity to reserve (positive)")
    txn_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional: {order_id: str, customer: str}"
    )


class UnreserveTxn(BaseTxn):
    """Release a reservation."""
    action: Literal["unreserve"] = "unreserve"
    qty: int = Field(..., gt=0, description="Quantity to unreserve (positive)")
    txn_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional: {order_id: str, reason: str}"
    )


class TransferTxn(BaseModel):
    """
    Atomic transfer between two locations.
    Cost is automatically determined by organization's valuation method.
    """
    action: Literal["transfer"] = "transfer"
    sku_code: str
    qty: int = Field(gt=0, description="Quantity to transfer (must be positive)")
    
    location: str = Field(description="Source location name")
    target_location: str = Field(description="Destination location name")
    
    txn_metadata: dict = Field(
        default_factory=dict,
        description="Optional metadata (notes, reference, etc.)"
    )
    
    class Config:
        populate_by_name = True
    

class TransferOutTxn(BaseModel):
    """
    Internal transaction for the outbound leg of a transfer.
    Generated automatically by transfer operation.
    """
    action: Literal["transfer_out"] = "transfer_out"
    sku_code: str
    sku_name: str | None = None
    qty: int = Field(lt=0, description="Quantity leaving location (must be negative)")
    
    location: str = Field(description="Source location name")
    
    txn_metadata: dict = Field(
        default_factory=dict,
        description="Transfer metadata including transfer_uuid and target_location"
    )
    
    class Config:
        populate_by_name = True


class TransferInTxn(BaseModel):
    """
    Internal transaction for the inbound leg of a transfer.
    Generated automatically by transfer operation with calculated cost.
    """
    action: Literal["transfer_in"] = "transfer_in"
    sku_code: str
    sku_name: str | None = None
    qty: int = Field(gt=0, description="Quantity arriving at location (must be positive)")
    
    location: str = Field(description="Destination location name")
    cost_price: Decimal | None = Field(
        None,
        description="Unit cost calculated from source location's valuation method"
    )
    
    txn_metadata: dict = Field(
        default_factory=dict,
        description="Transfer metadata including transfer_uuid and source_location"
    )
    
    class Config:
        populate_by_name = True
        