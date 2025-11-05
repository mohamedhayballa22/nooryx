from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


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
    sessions: List[SessionInfo]


SUPPORTED_LOCALES = {"en-US", "en-GB", "fr-FR", "es-ES", "de-DE", "pt-BR"}


class SettingsUpdateRequest(BaseModel):
    low_stock_threshold: Optional[int] = None
    reorder_point: Optional[int] = None
    locale: Optional[str] = None
    pagination: Optional[int] = None
    date_format: Optional[str] = None
    role: Optional[str] = None


USER_SETTINGS_DEFAULTS = {
    "locale": "en-US",
    "pagination": 25,
    "date_format": "system",
}

ORG_SETTINGS_DEFAULTS = {
    "low_stock_threshold": 10,
    "reorder_point": 15,
}
