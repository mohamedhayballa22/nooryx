from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from app.schemas import ReceiveTxn, ShipTxn, AdjustTxn, ReserveTxn, UnreserveTxn, TransferTxn
from app.models import InventoryState, Location

from app.core.config import settings
from app.core.db import get_session
from app.services.transaction.txn import apply_txn
from app.middleware.rate_limit import RateLimitMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


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
    txn, _ = await apply_txn(db, txn)

    response_data = {
        "sku_id": txn.sku_id,
        "location_id": txn.location_id,
        "narrative": txn.narrative,
    }

    await db.commit()

    return response_data

@app.post("/inventory/ship")
async def ship_stock(txn: ShipTxn, db: AsyncSession = Depends(get_session),):
    txn, _ = await apply_txn(db, txn)

    response_data = {
        "sku_id": txn.sku_id,
        "location_id": txn.location_id,
        "narrative": txn.narrative,
    }

    await db.commit()

    return response_data

@app.post("/inventory/adjust")
async def adjust_stock(txn: AdjustTxn, db: AsyncSession = Depends(get_session),):
    txn, _ = await apply_txn(db, txn)

    response_data = {
        "sku_id": txn.sku_id,
        "location_id": txn.location_id,
        "narrative": txn.narrative,
    }

    await db.commit()

    return response_data

@app.post("/inventory/reserve")
async def reserve_stock(txn: ReserveTxn, db: AsyncSession = Depends(get_session),):
    txn, _ = await apply_txn(db, txn)

    response_data = {
        "sku_id": txn.sku_id,
        "location_id": txn.location_id,
        "narrative": txn.narrative,
    }

    await db.commit()

    return response_data

@app.post("/inventory/unreserve")
async def unreserve_stock(txn: UnreserveTxn, db: AsyncSession = Depends(get_session),):
    txn, _ = await apply_txn(db, txn)

    response_data = {
        "sku_id": txn.sku_id,
        "location_id": txn.location_id,
        "narrative": txn.narrative,
    }

    await db.commit()

    return response_data

@app.post("/inventory/transfer")
async def transfer_stock(txn: TransferTxn, db: AsyncSession = Depends(get_session),):
    txn_data = txn.model_dump()
    source_location = txn_data["location"]
    target_location = txn_data.get("txn_metadata", {}).get("target_location")
    if not target_location:
        raise ValueError("Missing target_location in txn_metadata")
    qty = abs(txn_data["qty"])
    sku_id = txn_data["sku_id"]
    
    # Validate source and target are different
    if source_location == target_location:
        raise ValueError("Source and target locations must be different")
    
    # Resolve source location ID
    result = await db.execute(select(Location).filter_by(name=source_location))
    source_loc = result.scalar_one_or_none()
    if not source_loc:
        raise ValueError(f"Source location {source_location} does not exist")
    
    # Get source inventory state
    source_state = await db.get(InventoryState, (sku_id, source_loc.id))
    if not source_state:
        raise ValueError("Source doesn't exist")
    
    # Check if source has enough inventory
    if source_state.available < qty:
        raise ValueError(f"Not enough inventory available at {source_location}. Available: {source_state.available}, Requested: {qty}")
    
    # Outbound txn (transfer_out)
    outbound_txn_data = txn_data.copy()
    outbound_txn_data["qty"] = -qty
    outbound_txn_data["action"] = "transfer_out"
    outbound_txn = TransferTxn(**outbound_txn_data)

    # Inbound txn (transfer_in)
    inbound_txn_data = txn_data.copy()
    inbound_txn_data["qty"] = qty
    inbound_txn_data["action"] = "transfer_in"
    inbound_txn_data["location"] = target_location
    inbound_txn_data["txn_metadata"] = {"source_location": source_location}
    inbound_txn = TransferTxn(**inbound_txn_data)

    # Apply them
    _, _ = await apply_txn(db, outbound_txn)
    _, _ = await apply_txn(db, inbound_txn)
    
    response_data = {
        "sku_id": sku_id,
        "narrative": f"Transferred {qty} units from {source_location} to {target_location}",
    }
    
    await db.commit()
    
    return response_data
