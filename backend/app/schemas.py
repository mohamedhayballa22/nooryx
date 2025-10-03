from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Literal


class BaseTxn(BaseModel):
    sku_id: str
    location: str
    product_name: str
    reference: Optional[str] = None
    txn_metadata: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None


class ReceiveTxn(BaseTxn):
    action: Literal["receive"] = "receive"
    qty: int = Field(gt=0)


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


class InventoryItemResponse(BaseModel):
    sku: str
    product_name: str
    location: str
    available: int
    last_transaction: str
    status: str

    class Config:
        from_attributes = True
        

class TransactionHistoryResponse(BaseModel):
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
        
class OnHandValue(BaseModel):
    value: int
    delta_pct: float


class LocationInventory(BaseModel):
    id: int
    name: str
    status: str
    available: int
    reserved: int
    on_hand: OnHandValue


class InventorySummary(BaseModel):
    available: int
    reserved: int
    on_hand: OnHandValue
    locations: int


class SkuInventoryResponse(BaseModel):
    sku: str
    product_name: str
    status: str
    locations: List[LocationInventory]
    summary: InventorySummary
