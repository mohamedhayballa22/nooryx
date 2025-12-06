from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from decimal import Decimal

from  app.schemas.common import TrendPoint


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
    delta_percentage: float | None = None
    timestamp: str
    

class TrendPoint(BaseModel):
    date: date
    cogs: float

class COGSTrendResponse(BaseModel):
    oldest_data_point: Optional[date] = None
    points: List[TrendPoint]
    