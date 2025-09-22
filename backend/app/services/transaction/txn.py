from typing import Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import InventoryTransaction, InventoryState, Location
from app.schemas import AdjustTxn, ReceiveTxn, ShipTxn, ReserveTxn, TransferTxn, UnreserveTxn
from app.services.transaction.errors import (
    TransactionError,
    ConcurrencyConflict,
    DatabaseError,
    map_errors,
)


async def apply_txn(
    session: AsyncSession,
    txn: AdjustTxn | ReceiveTxn | ShipTxn | ReserveTxn | UnreserveTxn | TransferTxn
) -> Tuple[InventoryTransaction, InventoryState]:
    """
    Apply a transaction: persist txn row and update inventory state.

    Args:
        session: SQLAlchemy AsyncSession (caller controls commit/rollback).
        txn: Transaction payload.

    Returns:
        (persisted_txn, updated_state)

    Raises:
        TransactionError or one of its subclasses for structured frontend-friendly errors.
        DatabaseError for unexpected DB exceptions.
    """
    # Get location record
    result = await session.execute(
        select(Location).filter_by(name=txn.location)
    )
    location = result.scalar_one_or_none()

    if not location:
        location = Location(name=txn.location)
        session.add(location)
        await session.flush()

    txn_dict = txn.model_dump()
    txn_dict['location_id'] = location.id
    txn_dict.pop('location', None)  # Remove location name (unknown to the ORM)
    txn = InventoryTransaction(**txn_dict)
    txn.location = location

    try:
        session.add(txn)

        result = await session.execute(
            select(InventoryState)
            .filter_by(sku_id=txn.sku_id, location_id=txn.location_id)
            .with_for_update()
        )
        state = result.scalar_one_or_none()

        if state is None:
            state = InventoryState(
                sku_id=txn.sku_id, 
                location_id=txn.location_id,
                on_hand=txn.qty,
                reserved=0,
            )
            session.add(state)
        else:
            try:
                state.update_state(txn)
            except ValueError as ve:
                raise map_errors(ve)

        return txn, state

    except TransactionError:
        raise
    except StaleDataError as sde:
        raise ConcurrencyConflict(message=str(sde))
    except IntegrityError as ie:
        raise DatabaseError(message="Integrity error", details={"orig": str(ie.orig)})
    except Exception as e:
        raise DatabaseError(message="Unexpected error applying transaction", details={"orig": str(e)})
