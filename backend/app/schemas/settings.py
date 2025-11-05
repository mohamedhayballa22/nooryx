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
