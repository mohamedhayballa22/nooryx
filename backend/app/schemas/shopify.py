"""
Pydantic schemas for Shopify integration API.
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from uuid import UUID


class ShopifyConnectRequest(BaseModel):
    """Request to initiate Shopify OAuth flow."""
    
    shop_domain: str = Field(
        ...,
        description="Shopify store domain (e.g., mystore.myshopify.com)",
        min_length=1
    )
    
    @field_validator("shop_domain")
    @classmethod
    def validate_shop_domain(cls, v: str) -> str:
        """Ensure shop domain is in correct format."""
        v = v.strip().lower()
        
        # Remove protocol if present
        v = v.replace("https://", "").replace("http://", "")
        
        # Remove trailing slash
        v = v.rstrip("/")
        
        # Ensure .myshopify.com suffix
        if not v.endswith(".myshopify.com"):
            if "." not in v:
                v = f"{v}.myshopify.com"
        
        return v


class ShopifyOAuthUrlResponse(BaseModel):
    """Response containing Shopify OAuth authorization URL."""
    
    authorization_url: str = Field(..., description="URL to redirect user to for OAuth")
    state: str = Field(..., description="OAuth state parameter for CSRF protection")


class ShopifyIntegrationResponse(BaseModel):
    """Response schema for Shopify integration status."""
    
    id: UUID
    org_id: UUID
    shop_domain: str
    scopes: str
    is_active: bool
    connected_at: datetime
    last_synced_at: Optional[datetime] = None
    webhooks_installed: bool
    
    class Config:
        from_attributes = True


class ShopifyDisconnectResponse(BaseModel):
    """Response after disconnecting Shopify."""
    
    message: str
    disconnected_at: datetime
    