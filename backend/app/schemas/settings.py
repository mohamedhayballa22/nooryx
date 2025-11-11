from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import List, Optional


class Subscription(BaseModel):
    plan_name: str
    status: str
    billing_frequency: str
    current_period_end: str


class UserAccount(BaseModel):
    first_name: str
    last_name: str
    email: str
    role: Optional[str]
    created_at: datetime


class Organization(BaseModel):
    name: str
    created_at: datetime


class SessionInfo(BaseModel):
    id: str
    device_info: Optional[str]
    ip_address: Optional[str]
    last_used_at: Optional[datetime]
    expires_at: datetime
    is_current: bool


class UserAccountResponse(BaseModel):
    user: UserAccount
    organization: Organization
    subscription: Subscription
    sessions: List[SessionInfo]


SUPPORTED_LOCALES = {"system", "en-US", "en-GB", "fr-FR", "es-ES", "de-DE", "pt-BR"}


class SettingsUpdateRequest(BaseModel):
    low_stock_threshold: Optional[int] = None
    reorder_point: Optional[int] = None
    locale: Optional[str] = None
    pagination: Optional[int] = None
    date_format: Optional[str] = None
    role: Optional[str] = None
    alerts: Optional[bool] = None


class SettingsResponse(BaseModel):
    # Organization settings
    currency: str
    valuation_method: str
    alerts: bool
    
    # User settings
    locale: str
    pagination: int
    date_format: str


USER_SETTINGS_DEFAULTS = {
    "locale": "system",
    "pagination": 25,
    "date_format": "system",
}

ORG_SETTINGS_DEFAULTS = {
    "alerts": True,
}


class SKUThresholdsUpdateRequest(BaseModel):
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    reorder_point: Optional[int] = Field(None, ge=0)
    alerts: Optional[bool] = None

    @model_validator(mode='after')
    def validate_thresholds_order(self):
        if (
            self.low_stock_threshold is not None
            and self.reorder_point is not None
            and self.reorder_point > self.low_stock_threshold
        ):
            raise ValueError(
                "Reorder point cannot be greater than the low stock threshold."
            )
        return self

    model_config = {
        "validate_assignment": True,
        "extra": "forbid",
    }
