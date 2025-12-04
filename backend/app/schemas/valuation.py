from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from decimal import Decimal


class InventoryValuationRow(BaseModel):
    sku_code: str
    name: str
    total_qty: int
    avg_cost: Decimal
    total_value: Decimal
    currency: str
    

class ValuationHeader(BaseModel):
    total_value: Decimal
    currency: str
    method: str
    method_full_name: str
    timestamp: str

    model_config = ConfigDict(
        json_encoders={Decimal: float}
    )


class COGSResponse(BaseModel):
    total_cogs: float
    currency: str
    sku_code: Optional[str] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    