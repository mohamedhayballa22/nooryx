from pydantic import BaseModel
from datetime import date

class OnHandValue(BaseModel):
    """
    A common model representing an on-hand quantity with its
    historical percentage change. Used in both inventory state and reports.
    """
    value: int
    delta_pct: float

class TrendPoint(BaseModel):
    """
    A single data point in a time-series trend graph.
    Used for both SKU-specific and global inventory trends.
    """
    date: date
    on_hand: int
