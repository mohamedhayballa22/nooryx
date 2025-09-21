from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Union, Literal


class BaseTxn(BaseModel):
    sku_id: str
    location_id: int = 1
    reference: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None


class ReceiveTxn(BaseTxn):
    action: Literal["receive"] = "receive"
    qty: int = Field(gt=0)


class ShipTxn(BaseTxn):
    action: Literal["ship"] = "ship"
    qty: int = Field(lt=0)


class AdjustTxn(BaseTxn):
    action: Literal["adjust"] = "adjust"
    qty: int = Field(..., ne=0)


class ReserveTxn(BaseTxn):
    action: Literal["reserve"] = "reserve"
    qty: int = Field(gt=0)


class UnreserveTxn(BaseTxn):
    action: Literal["unreserve"] = "unreserve"
    qty: int = Field(lt=0)


class TransferTxn(BaseTxn):
    action: Literal["transfer"] = "transfer"
    qty: int = Field(..., ne=0)
    metadata: Dict[str, Any] = Field(..., description="Must include target_location_id")


# Union type for OpenAPI
InventoryTransactionIn = Union[
    ReceiveTxn, ShipTxn, AdjustTxn, ReserveTxn, UnreserveTxn, TransferTxn
]
