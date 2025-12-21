from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.common import OnHandValue

class InventoryItemResponse(BaseModel):
    """Represents a single row in the main inventory list view."""
    sku_code: str
    name: str  # SKU name from SKU table
    location: str
    available: int
    last_transaction: str
    status: str

    model_config = ConfigDict(
        from_attributes = True
    )

class InventorySummary(BaseModel):
    """A summary of quantities for a SKU at one or more locations."""
    available: int
    reserved: int
    on_hand: OnHandValue

class SkuInventoryResponse(BaseModel):
    """A comprehensive view of a single SKU's current inventory state."""
    sku_code: str
    name: str
    alerts: bool
    reorder_point: int
    low_stock_threshold: int
    status: str
    location: Optional[str] = None
    locations: int
    location_names: list[str]
    inventory_pct: float
    summary: InventorySummary
    