from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal, Any


# ============================================================================
# Alert Metadata Schemas
# ============================================================================

class TeamMemberJoinedMetadata(BaseModel):
    """Metadata for team member joined alerts."""
    user_id: UUID
    user_name: str
    user_email: str
    role: Optional[str] = None


class LowStockItemDetail(BaseModel):
    """Detail for a single low stock SKU."""
    sku_code: str
    sku_name: str
    available: int
    reorder_point: int


class LowStockMetadata(BaseModel):
    """Metadata for low stock alerts."""
    sku_codes: list[str]
    details: list[LowStockItemDetail]
    check_timestamp: datetime


# ============================================================================
# Alert Response Schemas
# ============================================================================

class AlertBase(BaseModel):
    """Base alert fields."""
    alert_type: Literal["team_member_joined", "low_stock"]
    severity: Literal["info", "warning", "critical"]
    title: str
    message: Optional[str] = None
    alert_metadata: Optional[dict[str, Any]] = None


class AlertResponse(AlertBase):
    """Alert response with read status for the requesting user."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    aggregation_key: Optional[str] = None
    is_read: bool = Field(
        default=False,
        description="Whether the requesting user has read this alert"
    )


class UnreadCountResponse(BaseModel):
    """Unread alert count for sidebar badge."""
    count: int


class MarkReadResponse(BaseModel):
    """Response after marking alerts as read."""
    marked_count: int


# ============================================================================
# Internal Service Schemas
# ============================================================================

class LowStockItem(BaseModel):
    """Internal schema for low stock detection."""
    sku_code: str
    sku_name: str
    available: int
    reorder_point: int
    
    @property
    def severity(self) -> Literal["warning", "critical"]:
        """Determine severity based on available quantity."""
        if self.available <= 0:
            return "critical"
        return "warning"
    