from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Literal
from datetime import date


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
        

class Transaction(BaseModel):
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
    sku: str
    locations: int
    location: Optional[str]
    transactions: List[Transaction]
        

class OnHandValue(BaseModel):
    value: int
    delta_pct: float
    

class InventorySummary(BaseModel):
    available: int
    reserved: int
    on_hand: OnHandValue

class SkuInventoryResponse(BaseModel):
    sku: str
    product_name: str
    status: str
    location: Optional[str] = None  # None = aggregated, or location name
    locations: int
    location_names: list[str]
    inventory_pct: float
    summary: InventorySummary


class TrendPoint(BaseModel):
    date: date
    on_hand: int

class InventoryTrendResponse(BaseModel):
    sku: str
    locations: int
    location: Optional[str]
    oldest_data_point: Optional[date] = None
    points: List[TrendPoint]
