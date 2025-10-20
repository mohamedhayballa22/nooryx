from fastapi_users import schemas
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

class UserRead(schemas.BaseUser[UUID]):
    org_id: UUID
    email: str
    first_name: str
    last_name: str

class UserCreate(schemas.BaseUserCreate):
    org_id: Optional[UUID] = None
    first_name: str
    last_name: str

class UserUpdate(schemas.BaseUserUpdate):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class OrgCreate(BaseModel):
    name: str = Field(..., description="Organization name")
    currency: str = Field(..., min_length=3, max_length=3, description="Currency code, e.g. 'USD'")
    valuation_method: str = Field(default="WAC", description="Valuation method: FIFO, LIFO, or WAC")

class OrgRegisterRequest(BaseModel):
    org: OrgCreate
    user: UserCreate

class OrgRegisterResponse(BaseModel):
    org_id: UUID
    user_id: UUID
    email: EmailStr
    org_name: str
    
# Invitation issuing
class InvitationCreateRequest(BaseModel):
    email: EmailStr = Field(..., description="Email of the user to invite")

class InvitationCreateResponse(BaseModel):
    token: str
    expires_at: datetime

# Invitation acceptance
class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., description="Signed invitation token")
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=8, description="User's password")

class InvitationAcceptResponse(BaseModel):
    email: EmailStr
    org_name: str
