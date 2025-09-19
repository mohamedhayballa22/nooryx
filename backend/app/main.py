from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from app.schemas import ReceiveTxn
from app.models import InventoryTransaction

from app.core.config import settings
from app.core.db import get_session
from app.services.transaction.txn import apply_txn
from app.middleware.rate_limit import RateLimitMiddleware
from sqlalchemy.ext.asyncio import AsyncSession


def custom_generate_unique_id(route: APIRoute) -> str:
    if route.tags:
        tag = route.tags[0]
    else:
        tag = route.name
    
    return f"{tag}-{route.name}"


app = FastAPI(
    title="Nooryx",
    generate_unique_id_function=custom_generate_unique_id,
    debug=settings.ENVIRONMENT == "dev",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.add_middleware(
    RateLimitMiddleware,
    # User can make 25 requests instantly (burst)
    default_capacity=25,
    # Then limited to 5 requests per second
    default_rate=5
    # After 5 seconds of no activity, back to full 25 burst capacity
)

@app.post("/inventory/receive")
async def receive_stock(txn: ReceiveTxn, db: AsyncSession = Depends(get_session),):
    txn = txn.model_dump()
    db_txn = InventoryTransaction(**txn)

    txn, _ = await apply_txn(db, db_txn)

    response_data = {
        "sku_id": txn.sku_id,
        "location_id": txn.location_id,
        "narrative": txn.narrative,
    }

    await db.commit()

    return response_data
