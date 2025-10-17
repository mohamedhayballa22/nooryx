from typing import Optional
from pydantic import BaseModel
from app.schemas.common import OnHandValue

class InventoryItemResponse(BaseModel):
    """Represents a single row in the main inventory list view."""
    sku: str
    product_name: str
    location: str
    available: int
    last_transaction: str
    status: str

    class Config:
        from_attributes = True

class InventorySummary(BaseModel):
    """A summary of quantities for a SKU at one or more locations."""
    available: int
    reserved: int
    on_hand: OnHandValue

class SkuInventoryResponse(BaseModel):
    """A comprehensive view of a single SKU's current inventory state."""
    sku: str
    product_name: str
    status: str
    location: Optional[str] = None
    locations: int
    location_names: list[str]
    inventory_pct: float
    summary: InventorySummary
