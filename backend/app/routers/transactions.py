from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, String, func
from typing import Optional, List

from app.schemas import TransactionHistoryResponse
from app.models import InventoryTransaction, Location
from app.core.db import get_session


router = APIRouter()


def _get_db_actions_from_display(display_action: str) -> list[str]:
    """Convert frontend display action to database action(s)."""
    action_map = {
        "added": ["receive"],
        "shipped": ["ship"],
        "reserved": ["reserve"],
        "transferred": ["transfer", "transfer_in", "transfer_out"],
        "adjusted": ["adjust"],
        "unreserved": ["unreserve"],
    }
    return action_map.get(display_action, [])


def _format_action(action: str) -> str:
    """Convert action to past tense for display."""
    action_map = {
        "receive": "added",
        "ship": "shipped",
        "adjust": "adjusted",
        "reserve": "reserved",
        "unreserve": "unreserved",
        "transfer_out": "transferred out",
        "transfer_in": "transferred in",
        "transfer": "transferred",
    }
    return action_map.get(action, action + "ed")


def _calculate_stock_after(qty_before: int, qty: int, action: str) -> int:
    """Calculate stock after based on qty_before, qty, and action type."""
    if action in ["reserve", "unreserve"]:
        return qty_before
    return qty_before + qty


@router.get("/transactions", response_model=Page[TransactionHistoryResponse])
async def get_transactions(
    db: AsyncSession = Depends(get_session),
    # Filtering parameters
    search: Optional[str] = Query(
        None,
        description="Search across actor, action, SKU, location, and metadata (partial match)",
    ),
    action: Optional[List[str]] = Query(
        None,
        description="Filter by action type(s)",
    ),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "created_at",
        description="Sort by field",
        regex="^(created_at|action|sku|location|quantity)$",
    ),
    order: Optional[str] = Query(
        "desc", description="Sort order", regex="^(asc|desc)$"
    ),
):
    """
    Returns paginated transaction history with stock before/after calculations.

    Supports searching across actor, action, SKU, location, and metadata fields.
    """

    # Main query with joins - no subquery needed, use qty_before field
    query = (
        select(
            InventoryTransaction,
            Location.name.label("location_name"),
        )
        .join(Location, InventoryTransaction.location_id == Location.id)
    )

    # Apply action filter
    if action:
        db_actions = []
        for display_action in action:
            db_actions.extend(_get_db_actions_from_display(display_action))
        query = query.where(InventoryTransaction.action.in_(db_actions))

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        metadata_search = func.cast(
            InventoryTransaction.txn_metadata, String
        ).ilike(search_pattern)
        query = query.where(
            or_(
                InventoryTransaction.created_by.ilike(search_pattern),
                InventoryTransaction.action.ilike(search_pattern),
                InventoryTransaction.sku_id.ilike(search_pattern),
                Location.name.ilike(search_pattern),
                metadata_search,
            )
        )

    # Apply sorting
    sort_mapping = {
        "created_at": InventoryTransaction.created_at,
        "action": InventoryTransaction.action,
        "sku": InventoryTransaction.sku_id,
        "location": Location.name,
        "quantity": InventoryTransaction.qty,
    }
    sort_column = sort_mapping.get(sort_by, InventoryTransaction.created_at)

    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    if sort_by != "created_at":
        query = query.order_by(InventoryTransaction.created_at.desc())

    return await apaginate(
        db,
        query,
        transformer=lambda rows: [
            TransactionHistoryResponse(
                id=row.InventoryTransaction.id,
                date=row.InventoryTransaction.created_at.strftime(
                    "%b %d, %Y at %I:%M %p"
                ),
                actor=row.InventoryTransaction.created_by or "Hannah Kandell",
                action=_format_action(row.InventoryTransaction.action),
                quantity=abs(row.InventoryTransaction.qty),
                sku=row.InventoryTransaction.sku_id,
                location=row.location_name,
                stock_before=row.InventoryTransaction.qty_before,
                stock_after=_calculate_stock_after(
                    row.InventoryTransaction.qty_before,
                    row.InventoryTransaction.qty,
                    row.InventoryTransaction.action,
                ),
                metadata=row.InventoryTransaction.txn_metadata,
            )
            for row in rows
        ],
    )


@router.get("/transactions/latest/{sku_id}", response_model=List[TransactionHistoryResponse])
async def get_latest_transactions_by_sku(
    sku_id: str,
    db: AsyncSession = Depends(get_session),
    location: Optional[str] = Query(None, description="Filter by location name"),
):
    """
    Returns the three most recent transactions for a specific SKU.
    
    Optionally filtered by location. If no location is provided, returns transactions across all locations.
    Includes stock before/after calculations for each transaction.
    """
    
    # Main query with joins - no subquery needed, use qty_before field
    query = (
        select(
            InventoryTransaction,
            Location.name.label("location_name"),
        )
        .join(Location, InventoryTransaction.location_id == Location.id)
        .where(InventoryTransaction.sku_id == sku_id)
    )
    
    # Apply location filter if provided
    if location:
        query = query.where(Location.name == location)
    
    query = query.order_by(InventoryTransaction.created_at.desc()).limit(3)
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        TransactionHistoryResponse(
            id=row.InventoryTransaction.id,
            date=row.InventoryTransaction.created_at.strftime(
                "%b %d, %Y at %I:%M %p"
            ),
            actor=row.InventoryTransaction.created_by or "Hannah Kandell",
            action=_format_action(row.InventoryTransaction.action),
            quantity=abs(row.InventoryTransaction.qty),
            sku=row.InventoryTransaction.sku_id,
            location=row.location_name,
            stock_before=row.InventoryTransaction.qty_before,
            stock_after=_calculate_stock_after(
                row.InventoryTransaction.qty_before,
                row.InventoryTransaction.qty,
                row.InventoryTransaction.action,
            ),
            metadata=row.InventoryTransaction.txn_metadata,
        )
        for row in rows
    ]
