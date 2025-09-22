from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Union, Literal


class BaseTxn(BaseModel):
    sku_id: str
    location: str
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
    qty: int = Field(lt=0)


class TransferTxn(BaseTxn):
    action: Literal["transfer", "transfer_in", "transfer_out"] = "transfer"
    qty: int = Field(..., ne=0)
    txn_metadata: Dict[str, Any] = Field(..., description="Must include target_location")


# Union type for OpenAPI
InventoryTransactionIn = Union[
    ReceiveTxn, ShipTxn, AdjustTxn, ReserveTxn, UnreserveTxn, TransferTxn
]
