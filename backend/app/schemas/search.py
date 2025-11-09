from pydantic import BaseModel, Field
from typing import List


class SKUSearchResult(BaseModel):
    sku_code: str
    sku_name: str
    alerts_enabled: bool
    reorder_point: int
    low_stock_threshold: int
    