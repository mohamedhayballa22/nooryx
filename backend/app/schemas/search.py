from pydantic import BaseModel, Field
from typing import List


class SKUSearchResult(BaseModel):
    sku_code: str
    sku_name: str
    