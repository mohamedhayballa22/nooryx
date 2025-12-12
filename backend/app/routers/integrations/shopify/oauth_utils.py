from fastapi import HTTPException, status
from app.core.config import settings
import httpx
import hmac
import hashlib
from app.core.logger_config import logger


def verify_shopify_hmac(params: dict, hmac_to_verify: str) -> bool:
    """
    Verify that the request actually came from Shopify by validating HMAC signature.
    
    Security critical: Prevents malicious actors from spoofing Shopify callbacks.
    """
    # Create a copy and remove hmac and signature params
    encoded_params = "&".join(
        f"{key}={value}"
        for key, value in sorted(params.items())
        if key not in ["hmac", "signature"]
    )
    
    computed_hmac = hmac.new(
        settings.SHOPIFY_CLIENT_SECRET.encode("utf-8"),
        encoded_params.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(computed_hmac, hmac_to_verify)


async def exchange_code_for_token(shop: str, code: str) -> tuple[str, str]:
    """
    Exchange authorization code for permanent access token.
    
    Returns:
        Tuple of (access_token, scopes)
    """
    token_url = f"https://{shop}/admin/oauth/access_token"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            json={
                "client_id": settings.SHOPIFY_CLIENT_ID,
                "client_secret": settings.SHOPIFY_CLIENT_SECRET,
                "code": code
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to obtain access token from Shopify"
            )
        
        data = response.json()
        return data["access_token"], data["scope"]


async def install_webhooks(shop: str, access_token: str):
    """
    Programmatically install webhooks for inventory management events.
    
    NOTE: 
    - Orders and Fulfillments are excluded due to Protected Customer Data requirements.
    - Inventory levels are tracked via 'products/update' (which includes count) 
      and 'inventory_items/update'.
    
    Raises:
        Exception: If webhook installation fails (except for 422 "already taken")
    """
    webhooks = [
        # APP LIFECYCLE - Needed for handling uninstalls
        {
            "topic": "app/uninstalled",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/app-uninstalled",
            "format": "json"
        },
        
        # CATALOG & STOCK STRUCTURE
        {
            "topic": "products/create",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/products-create",
            "format": "json"
        },
        {
            "topic": "products/update",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/products-update",
            "format": "json"
        },
        {
            "topic": "products/delete",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/products-delete",
            "format": "json"
        },
        
        # INVENTORY DEFINITIONS
        {
            "topic": "inventory_items/create",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/inventory-items-create",
            "format": "json"
        },
        {
            "topic": "inventory_items/update",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/inventory-items-update",
            "format": "json"
        },
        {
            "topic": "inventory_items/delete",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/inventory-items-delete",
            "format": "json"
        },
        
        # INVENTORY LEVELS
        {
            "topic": "inventory_levels/connect",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/inventory-levels-connect",
            "format": "json"
        },
        {
            "topic": "inventory_levels/disconnect",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/inventory-levels-disconnect",
            "format": "json"
        },
        {
            "topic": "inventory_levels/update",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/inventory-levels-update",
            "format": "json"
        },
        
        # ORDERS
        {
            "topic": "orders/create",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/orders-create",
            "format": "json"
        },
        {
            "topic": "orders/updated",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/orders-updated",
            "format": "json"
        },
        {
            "topic": "orders/delete",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhook/orders-delete",
            "format": "json"
        },
        {
            "topic": "orders/cancelled",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/orders-cancelled",
            "format": "json"
        },
        {
            "topic": "orders/fulfilled",
            "address": f"{settings.BASE_BACKEND_URL}/api/shopify/webhooks/orders-fulfilled",
            "format": "json"
        },
    ]
    
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json"
    }
    
    webhook_url = f"https://{shop}/admin/api/{settings.SHOPIFY_API_VERSION}/webhooks.json"
    
    async with httpx.AsyncClient() as client:
        for webhook in webhooks:
            try:
                response = await client.post(
                    webhook_url,
                    json={"webhook": webhook},
                    headers=headers,
                    timeout=30.0
                )
                
                if response.status_code == 422:
                    # Check if it's the "already taken" error
                    response_data = response.json()
                    errors = response_data.get("errors", {})
                    
                    if isinstance(errors, dict) and "address" in errors:
                        address_errors = errors["address"]
                        if isinstance(address_errors, list) and any(
                            "has already been taken" in str(err).lower() 
                            for err in address_errors
                        ):
                            continue
                    
                    # Different 422 error - fail
                    logger.error(f"Webhook validation error for {webhook['topic']}: {response.text}")
                    raise Exception(f"Webhook validation failed for {webhook['topic']}")
                else:
                    # Any other error
                    logger.error(f"Failed to install webhook {webhook['topic']}: {response.status_code} - {response.text}")
                    raise Exception(f"Failed to install webhook {webhook['topic']}")
                    
            except Exception as e:
                logger.error(f"Error installing webhook {webhook['topic']}: {str(e)}")
                raise
            