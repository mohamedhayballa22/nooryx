from pydantic import BaseModel, Field
from decimal import Decimal


class InventoryValuationRow(BaseModel):
    sku_code: str
    name: str
    total_qty: int
    avg_cost: Decimal
    total_value: Decimal
    currency: str
    

class ValuationHeader(BaseModel):
    total_value: str
    currency: str
    method: str
    method_full_name: str
    timestamp: str
    locale: str
