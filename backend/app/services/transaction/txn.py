from typing import Tuple

from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import InventoryTransaction, InventoryState, Location
from app.schemas import AdjustTxn, ReceiveTxn, ShipTxn, ReserveTxn, TransferTxn, UnreserveTxn
from app.services.transaction.exceptions import TransactionBadRequest


async def apply_txn(
    session: AsyncSession,
    txn_payload: AdjustTxn | ReceiveTxn | ShipTxn | ReserveTxn | UnreserveTxn | TransferTxn
) -> Tuple[InventoryTransaction, InventoryState]:
    """
    Apply a transaction: persist txn row and update inventory state.

    Args:
        session: SQLAlchemy AsyncSession (caller controls commit/rollback).
        txn_payload: Transaction payload from the API.

    Returns:
        (persisted_txn, updated_state)

    Raises:
        HTTPException: Raises specific subclasses for clear, consistent API error responses.
    """
    # Get or create the Location record
    location_result = await session.execute(
        select(Location).filter_by(name=txn_payload.location)
    )
    location = location_result.scalar_one_or_none()

    if not location:
        location = Location(name=txn_payload.location)
        session.add(location)
        await session.flush()

    # Create the ORM model from the Pydantic payload
    txn_dict = txn_payload.model_dump()
    txn_dict['location_id'] = location.id
    txn_dict.pop('location', None)
    
    db_txn = InventoryTransaction(**txn_dict)
    db_txn.location = location

    try:
        session.add(db_txn)

        state_result = await session.execute(
            select(InventoryState)
            .filter_by(sku_id=db_txn.sku_id, location_id=db_txn.location_id)
            .with_for_update()
        )
        state = state_result.scalar_one_or_none()

        if state is None:
            if txn_payload.action != "receive":
                raise TransactionBadRequest(detail=f"{txn_payload.sku_id} doesn't exist in {txn_payload.location}")
            state = InventoryState(
                sku_id=db_txn.sku_id, 
                location_id=db_txn.location_id,
                on_hand=db_txn.qty,
                reserved=0,
            )
            session.add(state)
        
        state.update_state(db_txn)

        return db_txn, state

    except TransactionBadRequest:
        raise
    except StaleDataError:
        # A row was updated by another transaction after we loaded it.
        raise
    