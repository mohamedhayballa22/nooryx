from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.models import InventoryTransaction, InventoryState
from app.services.transaction.errors import (
    TransactionError,
    ConcurrencyConflict,
    DatabaseError,
    map_errors,
)


def apply_txn(
    session: Session,
    txn: InventoryTransaction,
    *,
    ship_from: Optional[str] = None,
) -> Tuple[InventoryTransaction, InventoryState]:
    """
    Apply a transaction: persist txn row and update inventory state.

    Args:
        session: SQLAlchemy Session (caller controls commit/rollback).
        txn: InventoryTransaction instance (not yet persisted).
        ship_from: forwarded to InventoryState.update_state (None | "reserved" | "on_hand").

    Returns:
        (persisted_txn, updated_state)

    Raises:
        TransactionError or one of its subclasses for structured frontend-friendly errors.
        DatabaseError for unexpected DB exceptions.
    Notes:
        - This function uses a SAVEPOINT (session.begin_nested()) to keep this operation atomic
          relative to the surrounding transaction.
        - Caller should commit when appropriate.
    """
    try:
        with session.begin_nested():
            session.add(txn)
            session.flush()

            state = (
                session.query(InventoryState)
                .filter_by(sku_id=txn.sku_id, location_id=txn.location_id)
                .with_for_update()
                .one_or_none()
            )

            if state is None:
                state = InventoryState(sku_id=txn.sku_id, location_id=txn.location_id)
                session.add(state)
                session.flush()

            try:
                state.update_state(txn, ship_from=ship_from)
            except ValueError as ve:
                raise map_errors(ve)

            session.add(state)
            session.flush()

            return txn, state

    except TransactionError:
        raise
    except StaleDataError as sde:
        raise ConcurrencyConflict(message=str(sde))
    except IntegrityError as ie:
        raise DatabaseError(message="Integrity error", details={"orig": str(ie.orig)})
    except Exception as e:
        raise DatabaseError(message="Unexpected error applying transaction", details={"orig": str(e)})
