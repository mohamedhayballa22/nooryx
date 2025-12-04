from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.auth.dependencies import get_current_user
from app.models import User
from app.services.txn import TransactionService
from app.schemas.actions import (
    ReceiveTxn, ShipTxn, AdjustTxn, 
    ReserveTxn, UnreserveTxn, TransferTxn
)
from app.services.barcodes import link_barcode

router = APIRouter()

def _build_transaction_response(txn, state) -> dict:
    """Helper to build standardized transaction response."""
    return {
        "id": txn.id,
        "narrative": txn.narrative,
        "inventory_state": {
            "sku_code": state.sku_code,
            "location_id": state.location_id,
            "on_hand": state.on_hand,
            "reserved": state.reserved,
            "available": state.available,
        },
    }


@router.post("/receive")
async def receive_stock(
    txn: ReceiveTxn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Receive inventory into a location."""
    service = TransactionService(
        session=db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        background_tasks=background_tasks
    )

    applied_txn, updated_state = await service.apply_transaction(txn)
    
    # Register barcode if provided
    if hasattr(txn.barcode, 'value') and txn.barcode.value:
        await link_barcode(
            db=db,
            org_id=current_user.org_id,
            value=txn.barcode.value,
            sku_code=txn.sku_code,
            format=getattr(txn.barcode, 'format', None)
        )
    
    await db.commit()
    
    service.schedule_low_stock_resolution()
    
    return _build_transaction_response(applied_txn, updated_state)


@router.post("/ship")
async def ship_stock(
    txn: ShipTxn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Ship inventory from a location.
    
    Optional metadata.ship_from values:
    - "reserved": Ship only from reserved stock
    - "available": Ship only from available (unreserved) stock  
    - "auto" or null: Ship from reserved first, then available
    """
    service = TransactionService(
        session=db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        background_tasks=background_tasks
    )
    
    applied_txn, updated_state = await service.apply_transaction(txn)

    # Register barcode if provided
    if hasattr(txn.barcode, 'value') and txn.barcode.value:
        await link_barcode(
            db=db,
            org_id=current_user.org_id,
            value=txn.barcode.value,
            sku_code=txn.sku_code,
            format=getattr(txn.barcode, 'format', None)
        )

    await db.commit()

    service.schedule_low_stock_check()
    
    return _build_transaction_response(applied_txn, updated_state)


@router.post("/adjust")
async def adjust_stock(
    txn: AdjustTxn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Adjust inventory (correction, damage, etc).
    
    Requires metadata.reason field explaining the adjustment.
    """
    service = TransactionService(
        session=db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        background_tasks=background_tasks
    )
    
    applied_txn, updated_state = await service.apply_transaction(txn)

    # Register barcode if provided
    if hasattr(txn.barcode, 'value') and txn.barcode.value:
        await link_barcode(
            db=db,
            org_id=current_user.org_id,
            value=txn.barcode.value,
            sku_code=txn.sku_code,
            format=getattr(txn.barcode, 'format', None)
        )

    await db.commit()

    if txn.qty < 0:
        service.schedule_low_stock_check()
    else:
        service.schedule_low_stock_resolution()

    return _build_transaction_response(applied_txn, updated_state)


@router.post("/reserve")
async def reserve_stock(
    txn: ReserveTxn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Reserve inventory for an order.
    
    Reserves stock from available inventory (on_hand - reserved).
    Optional metadata: order_id, customer, etc.
    """
    service = TransactionService(
        session=db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        background_tasks=background_tasks
    )
    
    applied_txn, updated_state = await service.apply_transaction(txn)

    # Register barcode if provided
    if hasattr(txn.barcode, 'value') and txn.barcode.value:
        await link_barcode(
            db=db,
            org_id=current_user.org_id,
            value=txn.barcode.value,
            sku_code=txn.sku_code,
            format=getattr(txn.barcode, 'format', None)
        )

    await db.commit()
    
    service.schedule_low_stock_check()
    
    return _build_transaction_response(applied_txn, updated_state)


@router.post("/unreserve")
async def unreserve_stock(
    txn: UnreserveTxn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Release a reservation.
    
    Returns reserved stock back to available inventory.
    Optional metadata: order_id, reason, etc.
    """
    service = TransactionService(
        session=db,
        org_id=current_user.org_id,
        user_id=current_user.id,
        background_tasks=background_tasks
    )
    
    applied_txn, updated_state = await service.apply_transaction(txn)

    # Register barcode if provided
    if hasattr(txn.barcode, 'value') and txn.barcode.value:
        await link_barcode(
            db=db,
            org_id=current_user.org_id,
            value=txn.barcode.value,
            sku_code=txn.sku_code,
            format=getattr(txn.barcode, 'format', None)
        )

    await db.commit()
    
    service.schedule_low_stock_resolution()
    
    return _build_transaction_response(applied_txn, updated_state)


@router.post("/transfer")
async def transfer_stock(
    txn: TransferTxn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Atomically transfer inventory between locations.
    Cost is automatically calculated based on organization's valuation method.
    """
    service = TransactionService(
        session=db,
        org_id=current_user.org_id,
        user_id=current_user.id
    )
    
    out_txn, in_txn, source_state, target_state = await service.apply_transfer(txn)

    # Register barcode if provided
    if hasattr(txn.barcode, 'value') and txn.barcode.value:
        await link_barcode(
            db=db,
            org_id=current_user.org_id,
            value=txn.barcode.value,
            sku_code=txn.sku_code,
            format=getattr(txn.barcode, 'format', None)
        )

    await db.commit()
    
    
    return {
        "transfer_out": _build_transaction_response(out_txn, source_state),
        "transfer_in": _build_transaction_response(in_txn, target_state),
        "transfer_id": out_txn.txn_metadata.get('transfer_id'),
        "summary": {
            "sku_code": txn.sku_code,
            "qty_transferred": abs(txn.qty),
            "from_location": txn.location,
            "to_location": txn.target_location,
            "source_remaining": source_state.on_hand,
            "target_new_total": target_state.on_hand,
        }
    }
