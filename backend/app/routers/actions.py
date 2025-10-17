from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.schemas.transaction import  (
    ReceiveTxn,
    ShipTxn,
    AdjustTxn,
    ReserveTxn,
    UnreserveTxn,
    TransferTxn,
)
from app.models import InventoryState, Location
from app.core.db import get_session
from app.services.transaction.txn import apply_txn


router = APIRouter()


@router.post("/receive")
async def receive_stock(
    txn: ReceiveTxn,
    db: AsyncSession = Depends(get_session),
):
    applied_txn, updated_state = await apply_txn(db, txn)

    response_data = {
        "narrative": applied_txn.narrative,
        "inventory_state": {
            "sku_id": updated_state.sku_id,
            "location_id": updated_state.location_id,
            "on_hand": updated_state.on_hand,
            "available": updated_state.available,
            "reserved": updated_state.reserved,
        },
    }

    await db.commit()
    return response_data


@router.post("/ship")
async def ship_stock(
    txn: ShipTxn,
    db: AsyncSession = Depends(get_session),
):
    applied_txn, updated_state = await apply_txn(db, txn)

    response_data = {
        "narrative": applied_txn.narrative,
        "inventory_state": {
            "sku_id": updated_state.sku_id,
            "location_id": updated_state.location_id,
            "on_hand": updated_state.on_hand,
            "available": updated_state.available,
            "reserved": updated_state.reserved,
        },
    }

    await db.commit()
    return response_data


@router.post("/adjust")
async def adjust_stock(
    txn: AdjustTxn,
    db: AsyncSession = Depends(get_session),
):
    applied_txn, updated_state = await apply_txn(db, txn)

    response_data = {
        "narrative": applied_txn.narrative,
        "inventory_state": {
            "sku_id": updated_state.sku_id,
            "location_id": updated_state.location_id,
            "on_hand": updated_state.on_hand,
            "available": updated_state.available,
            "reserved": updated_state.reserved,
        },
    }

    await db.commit()
    return response_data


@router.post("/reserve")
async def reserve_stock(
    txn: ReserveTxn,
    db: AsyncSession = Depends(get_session),
):
    applied_txn, updated_state = await apply_txn(db, txn)

    response_data = {
        "narrative": applied_txn.narrative,
        "inventory_state": {
            "sku_id": updated_state.sku_id,
            "location_id": updated_state.location_id,
            "on_hand": updated_state.on_hand,
            "available": updated_state.available,
            "reserved": updated_state.reserved,
        },
    }

    await db.commit()
    return response_data


@router.post("/unreserve")
async def unreserve_stock(
    txn: UnreserveTxn,
    db: AsyncSession = Depends(get_session),
):
    applied_txn, updated_state = await apply_txn(db, txn)

    response_data = {
        "narrative": applied_txn.narrative,
        "inventory_state": {
            "sku_id": updated_state.sku_id,
            "location_id": updated_state.location_id,
            "on_hand": updated_state.on_hand,
            "available": updated_state.available,
            "reserved": updated_state.reserved,
        },
    }

    await db.commit()
    return response_data


@router.post("/transfer")
async def transfer_stock(
    txn: TransferTxn,
    db: AsyncSession = Depends(get_session),
):
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
        raise ValueError(
            f"Not enough inventory available at {source_location}. Available: {source_state.available}, Requested: {qty}"
        )

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
    _, source_updated_state = await apply_txn(db, outbound_txn)
    _, target_updated_state = await apply_txn(db, inbound_txn)

    response_data = {
        "narrative": f"Transferred {qty} units from {source_location} to {target_location}",
        "source_inventory_state": {
            "sku_id": source_updated_state.sku_id,
            "location_id": source_updated_state.location_id,
            "on_hand": source_updated_state.on_hand,
            "available": source_updated_state.available,
            "reserved": source_updated_state.reserved,
        },
        "target_inventory_state": {
            "sku_id": target_updated_state.sku_id,
            "location_id": target_updated_state.location_id,
            "on_hand": target_updated_state.on_hand,
            "available": target_updated_state.available,
            "reserved": target_updated_state.reserved,
        },
    }

    await db.commit()
    return response_data
