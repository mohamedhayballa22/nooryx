from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class TransactionItem(BaseModel):
    """Represents a single, historical transaction record from the ledger."""
    id: str  # UUID as string
    date: str
    actor: str
    action: str
    quantity: int
    sku_code: str
    location: str
    qty_before: int
    qty_after: int
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class LatestTransactionsResponse(BaseModel):
    """Response model for fetching the most recent transactions."""
    sku_code: Optional[str] = None
    location: Optional[str]
    transactions: List[TransactionItem]
