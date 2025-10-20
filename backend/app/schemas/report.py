from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from app.schemas.common import OnHandValue, TrendPoint

class DashboardMetricsResponse(BaseModel):
    """High-level metrics for the dashboard header."""
    total_available: int
    total_on_hand: OnHandValue
    stockouts: int
    low_stock: int
    location: Optional[str] = None

class DashboardSummaryResponse(BaseModel):
    """Detailed summary for the main dashboard body, providing actionable insights."""
    first_name: str = Field(..., description="User's first name (currently hard-coded)")
    low_stock: int = Field(..., description="Count of SKUs with available quantity between 1-9")
    out_of_stock: int = Field(..., description="Count of SKUs with available quantity of 0")
    fast_mover_low_stock_sku: Optional[List[str]] = None
    fast_mover_out_of_stock_sku: Optional[List[str]] = None
    inactive_sku_in_stock: Optional[List[str]] = None
    empty_inventory: bool
    locations: List[str]

class TopSKUsItem(BaseModel):
    """Represents a single SKU in a 'top movers' or 'top inactives' report."""
    sku: str
    sku_name: str
    available: int
    status: str

class TopSKUsResponse(BaseModel):
    location: Optional[str]
    skus: List[TopSKUsItem]

class TrendResponse(BaseModel):
    """Generic response for any time-series inventory trend report."""
    sku: Optional[str] = None
    location: Optional[str]
    oldest_data_point: Optional[date] = None
    points: List[TrendPoint]
