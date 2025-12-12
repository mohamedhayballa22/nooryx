from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.db import get_session
from app.core.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.security import encryption_service
from app.core.redis import redis_client
from app.models import User
from app.models import ShopifyIntegration
from app.schemas.shopify import (
    ShopifyConnectRequest,
    ShopifyOAuthUrlResponse,
    ShopifyIntegrationResponse,
    ShopifyDisconnectResponse
)
from app.routers.integrations.shopify.oauth_utils import verify_shopify_hmac, exchange_code_for_token, install_webhooks
import secrets
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode
from app.core.logger_config import logger

router = APIRouter()


# OAUTH FLOW - STEP 1: Initiate Authorization

@router.post("/connect", response_model=ShopifyOAuthUrlResponse)
async def initiate_shopify_connection(
    request_data: ShopifyConnectRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Step 1: Generate Shopify OAuth authorization URL.
    
    User clicks "Connect Shopify" → Frontend calls this → Returns OAuth URL → Frontend redirects user
    """
    
    # Check if org already has Shopify connected
    existing = await session.execute(
        select(ShopifyIntegration).where(ShopifyIntegration.org_id == user.org_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shopify store already connected. Disconnect first to connect a different store."
        )
    
    # Generate secure state parameter for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store user context in Redis (expires in 10 minutes)
    await redis_client.set_json(
        key=f"shopify_oauth:{state}",
        value={
            "user_id": str(user.id),
            "org_id": str(user.org_id),
            "shop_domain": request_data.shop_domain
        },
        expiry_seconds=600  # 10 minutes
    )
    
    # Build Shopify OAuth authorization URL
    oauth_params = {
        "client_id": settings.SHOPIFY_CLIENT_ID,
        "scope": "write_inventory,write_products,read_products,read_inventory,read_orders,read_all_orders",
        "redirect_uri": f"{settings.BASE_BACKEND_URL}/api/shopify/callback",
        "state": state,
        "grant_options[]": "per-user"
    }
    
    authorization_url = (
        f"https://{request_data.shop_domain}/admin/oauth/authorize?"
        f"{urlencode(oauth_params)}"
    )
    
    return ShopifyOAuthUrlResponse(
        authorization_url=authorization_url,
        state=state
    )


# OAUTH FLOW - STEP 2: Handle Callback

@router.get("/callback")
async def shopify_oauth_callback(
    code: str = Query(..., description="Authorization code from Shopify"),
    shop: str = Query(..., description="Shop domain"),
    state: str = Query(..., description="State parameter for CSRF validation"),
    hmac_param: str = Query(..., alias="hmac", description="HMAC signature from Shopify"),
    request: Request = None,
    session: AsyncSession = Depends(get_session)
):
    """
    Step 2: Shopify redirects here after user grants permission.
    
    This endpoint:
    1. Validates the request is from Shopify (HMAC)
    2. Retrieves user context from Redis
    3. Exchanges authorization code for access token
    4. Stores encrypted token in database
    5. Installs webhooks
    6. Redirects user back to frontend
    """
    
    # VALIDATION
    
    # Validate HMAC to ensure request is from Shopify
    if not verify_shopify_hmac(dict(request.query_params), hmac_param):
        logger.error("Invalid HMAC in Shopify OAuth callback")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/core/integrations?error=invalid_hmac"
        )
    
    # Retrieve user context from Redis
    oauth_context = await redis_client.get_json(f"shopify_oauth:{state}")
    if not oauth_context:
        logger.error("OAuth state not found or expired")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/core/integrations?error=session_expired"
        )
    
    user_id = oauth_context["user_id"]
    org_id = oauth_context["org_id"]
    
    # Clean up Redis state
    await redis_client.delete(f"shopify_oauth:{state}")
    
    # Verify shop domain matches
    if shop != oauth_context["shop_domain"]:
        logger.error(f"Shop domain mismatch: {shop} != {oauth_context['shop_domain']}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/core/integrations?error=shop_mismatch"
        )
    
    # TOKEN EXCHANGE 
    
    try:
        access_token, scopes = await exchange_code_for_token(shop, code)
    except Exception as e:
        logger.error(f"Failed to exchange code for token: {str(e)}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/core/integrations?error=token_exchange_failed"
        )
    
    # STORE IN DATABASE
    
    encrypted_token = encryption_service.encrypt(access_token)
    
    shopify_integration = ShopifyIntegration(
        org_id=org_id,
        shop_domain=shop,
        access_token_encrypted=encrypted_token,
        scopes=scopes,
        is_active=True,
        webhooks_installed=False
    )
    
    session.add(shopify_integration)
    await session.commit()
    await session.refresh(shopify_integration)
    
    # INSTALL WEBHOOKS
    try:
        await install_webhooks(shop, access_token)
        
        # Update webhook installation status
        shopify_integration.webhooks_installed = True
        await session.commit()
    except Exception as e:
        # Webhook installation failed - rollback the integration
        logger.error(f"Failed to install webhooks: {str(e)}")
        await session.delete(shopify_integration)
        await session.commit()
        
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/core/integrations?error=webhook_installation_failed"
        )

    # REDIRECT TO FRONTEND
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/core/integrations?shopify_connected=true"
    )


@router.get("/status", response_model=Optional[ShopifyIntegrationResponse])
async def get_shopify_status(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get current Shopify integration status for user's organization.
    
    Frontend uses this to show "Connected ✓" or "Connect" button.
    """
    result = await session.execute(
        select(ShopifyIntegration).where(
            ShopifyIntegration.org_id == user.org_id,
            ShopifyIntegration.is_active == True
        )
    )
    
    integration = result.scalar_one_or_none()
    return integration


@router.delete("/disconnect", response_model=ShopifyDisconnectResponse)
async def disconnect_shopify(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Disconnect Shopify integration for user's organization."""
    await session.execute(
        delete(ShopifyIntegration).where(
            ShopifyIntegration.org_id == user.org_id
        )
    )
    
    await session.commit()
    
    return ShopifyDisconnectResponse(
        message="Shopify integration disconnected successfully",
        disconnected_at=datetime.utcnow()
    )
    