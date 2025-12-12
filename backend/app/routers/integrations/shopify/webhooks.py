from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.core.config import settings
import hmac
import hashlib
import base64
from typing import Optional
from app.core.logger_config import logger
from app.core.db import get_session
from app.models import ShopifyIntegration
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()

def verify_webhook_hmac(body: bytes, hmac_header: Optional[str]) -> bool:
    """
    Verify webhook authenticity using HMAC signature.
    
    Critical security check to ensure webhook came from Shopify.
    """
    if not hmac_header:
        return False
    
    computed_hmac = hmac.new(
        settings.SHOPIFY_CLIENT_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()
    
    computed_hmac_b64 = base64.b64encode(computed_hmac).decode()
    
    return hmac.compare_digest(computed_hmac_b64, hmac_header)


async def get_org_from_webhook(
    request: Request,
    session: AsyncSession
) -> Optional[str]:
    """
    Extract org_id from webhook by looking up the shop domain.
    
    Returns None if shop domain not found or integration doesn't exist.
    """
    shop_domain = request.headers.get("X-Shopify-Shop-Domain")
    
    if not shop_domain:
        logger.warning("Received webhook without shop domain")
        return None
    
    result = await session.execute(
        select(ShopifyIntegration).where(
            ShopifyIntegration.shop_domain == shop_domain
        )
    )
    
    integration = result.scalar_one_or_none()
    
    if not integration:
        logger.error(f"No integration found for shop: {shop_domain}")
        return None
    
    return integration.org_id


@router.post("/app-uninstalled", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_app_uninstalled(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """
    Webhook: App uninstalled from Shopify admin.
    
    Clean up the database when merchant uninstalls from their side.
    """
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid webhook signature"
        )
    
    payload = await request.json()
    shop_domain = payload.get("domain") or payload.get("myshopify_domain")
    
    if not shop_domain:
        logger.error("No shop domain in app/uninstalled webhook")
        return
    
    # Find and deactivate/delete the integration
    result = await session.execute(
        select(ShopifyIntegration).where(
            ShopifyIntegration.shop_domain == shop_domain
        )
    )
    
    integration = result.scalar_one_or_none()
    
    if integration:
        await session.delete(integration)
        await session.commit()
        
        logger.info(f"Cleaned up integration for uninstalled app: {shop_domain}")
    
    return


@router.post("/products-create", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_products_create(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Product created in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement product creation sync logic
    logger.info(f"Received products/create webhook for org {org_id}", payload=body)
    return


@router.post("/products-update", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_products_update(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Product updated in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement product update sync logic
    logger.info(f"Received products/update webhook for org {org_id}", payload=body)
    return


@router.post("/products-delete", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_products_delete(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Product deleted in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement product deletion sync logic
    logger.info(f"Received products/delete webhook for org {org_id}", payload=body)
    return


@router.post("/inventory-items-create", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_inventory_items_create(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Inventory item created in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement inventory item sync logic
    logger.info(f"Received inventory_items/create webhook for org {org_id}", payload=body)
    return


@router.post("/inventory-items-update", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_inventory_items_update(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Inventory item updated in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement inventory item sync logic
    logger.info(f"Received inventory_items/update webhook for org {org_id}", payload=body)
    return


@router.post("/inventory-items-delete", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_inventory_items_delete(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Inventory item deleted in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement inventory item sync logic
    logger.info(f"Received inventory_items/delete webhook for org {org_id}", payload=body)
    return


@router.post("/inventory-levels-connect", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_inventory_levels_connect(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Inventory level connected to a location in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement inventory level connect sync logic
    logger.info(f"Received inventory_levels/connect webhook for org {org_id}", payload=body)
    return


@router.post("/inventory-levels-disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_inventory_levels_disconnect(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Inventory level disconnected from a location in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement inventory level disconnect sync logic
    logger.info(f"Received inventory_levels/disconnect webhook for org {org_id}", payload=body)
    return


@router.post("/inventory-levels-update", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_inventory_levels_update(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Inventory level updated in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement inventory level update sync logic
    logger.info(f"Received inventory_levels/update webhook for org {org_id}", payload=body)
    return


@router.post("/orders-create", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_orders_create(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Webhook: Order created in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement order creation sync logic
    logger.info(f"Received orders/create webhook for org {org_id}", payload=body)
    return


@router.post("/orders-updated", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_orders_updated(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Order updated in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement order update sync logic
    logger.info(f"Received orders/updated webhook for org {org_id}", payload=body)
    return


@router.post("/orders-delete", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_orders_delete(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Order deleted in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement order deletion sync logic
    logger.info(f"Received orders/delete webhook for org {org_id}", payload=body)
    return


@router.post("/orders-cancelled", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_orders_cancelled(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Order cancelled in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement order cancellation sync logic
    logger.info(f"Received orders/cancelled webhook for org {org_id}", payload=body)
    return


@router.post("/orders-fulfilled", status_code=status.HTTP_204_NO_CONTENT)
async def webhook_orders_fulfilled(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Webhook: Order fulfilled in Shopify."""
    body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    
    if not verify_webhook_hmac(body, hmac_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    org_id = await get_org_from_webhook(request, session)
    if not org_id:
        return
    
    # TODO: Implement order fulfillment sync logic
    logger.info(f"Received orders/fulfilled webhook for org {org_id}", payload=body)
    return
