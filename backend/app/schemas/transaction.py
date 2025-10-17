from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Literal

# Request Schemas (for creating transactions)

class BaseTxn(BaseModel):
    sku_id: str
    location: str
    product_name: Optional[str] = None
    reference: Optional[str] = None
    txn_metadata: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None

class ReceiveTxn(BaseTxn):
    action: Literal["receive"] = "receive"
    qty: int = Field(gt=0)
    product_name: str

class ShipTxn(BaseTxn):
    action: Literal["ship"] = "ship"
    qty: int = Field(lt=0)
    txn_metadata: Optional[Dict[str, Any]] = Field(None, description="Can optionally include ship_from")

class AdjustTxn(BaseTxn):
    action: Literal["adjust"] = "adjust"
    qty: int = Field(..., ne=0)
    txn_metadata: Dict[str, Any] = Field(..., description="Must include reason")

class ReserveTxn(BaseTxn):
    action: Literal["reserve"] = "reserve"
    qty: int = Field(gt=0)

class UnreserveTxn(BaseTxn):
    action: Literal["unreserve"] = "unreserve"
    qty: int = Field(gt=0)

class TransferTxn(BaseTxn):
    action: Literal["transfer", "transfer_in", "transfer_out"] = "transfer"
    qty: int = Field(..., ne=0)
    txn_metadata: Dict[str, Any] = Field(..., description="Must include target_location")


# Response Schemas (for viewing the ledger)

class Transaction(BaseModel):
    """Represents a single, historical transaction record from the ledger."""
    id: int
    date: str
    actor: str
    action: str
    quantity: int
    sku: str
    location: str
    stock_before: int
    stock_after: int
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class LatestTransactionsResponse(BaseModel):
    """Response model for fetching the most recent transactions."""
    sku: Optional[str] = None
    location: Optional[str]
    transactions: List[Transaction]
