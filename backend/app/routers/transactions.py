from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, String, func, exists
from typing import Optional, List

from app.schemas.transaction import LatestTransactionsResponse, Transaction
from app.models import Transaction as TransactionModel, Location, State, User
from app.core.db import get_session
from app.services.exceptions import NotFound


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


@router.get("/transactions", response_model=Page[Transaction])
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
        regex="^(created_at|action|sku_code|location|qty)$",
    ),
    order: Optional[str] = Query(
        "desc", description="Sort order", regex="^(asc|desc)$"
    ),
):
    """
    Returns paginated transaction history with stock before/after calculations.

    Supports searching across actor, action, SKU, location, and metadata fields.
    """

    # Check if ANY transactions exist at all (before filters)
    has_filters = bool(search or action)
    
    if not has_filters:
        # Only check for existence when there are no filters
        exists_query = select(exists().where(TransactionModel.id.isnot(None)))
        result = await db.execute(exists_query)
        has_any_transactions = result.scalar()
        
        if not has_any_transactions:
            raise NotFound("No transactions found")

    # Main query with joins - include User for actor name
    query = (
        select(
            TransactionModel,
            Location.name.label("location_name"),
            User.first_name,
            User.last_name,
        )
        .join(Location, TransactionModel.location_id == Location.id)
        .outerjoin(User, TransactionModel.created_by == User.id)
    )

    # Apply action filter
    if action:
        db_actions = []
        for display_action in action:
            db_actions.extend(_get_db_actions_from_display(display_action))
        query = query.where(TransactionModel.action.in_(db_actions))

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        metadata_search = func.cast(
            TransactionModel.txn_metadata, String
        ).ilike(search_pattern)
        # Search in user's first and last name
        user_name_search = or_(
            User.first_name.ilike(search_pattern),
            User.last_name.ilike(search_pattern),
            func.concat(User.first_name, ' ', User.last_name).ilike(search_pattern),
        )
        query = query.where(
            or_(
                user_name_search,
                TransactionModel.action.ilike(search_pattern),
                TransactionModel.sku_code.ilike(search_pattern),
                Location.name.ilike(search_pattern),
                metadata_search,
            )
        )

    # Apply sorting
    sort_mapping = {
        "created_at": TransactionModel.created_at,
        "action": TransactionModel.action,
        "sku_code": TransactionModel.sku_code,
        "location": Location.name,
        "qty": TransactionModel.qty,
    }
    sort_column = sort_mapping.get(sort_by, TransactionModel.created_at)

    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    if sort_by != "created_at":
        query = query.order_by(TransactionModel.created_at.desc())

    return await apaginate(
        db,
        query,
        transformer=lambda rows: [
            Transaction(
                id=str(row.Transaction.id),
                date=row.Transaction.created_at.strftime(
                    "%b %d, %Y at %I:%M %p"
                ),
                actor=f"{row.first_name} {row.last_name}" if row.first_name and row.last_name else "System",
                action=_format_action(row.Transaction.action),
                quantity=abs(row.Transaction.qty),
                sku_code=row.Transaction.sku_code,
                location=row.location_name,
                qty_before=row.Transaction.qty_before,
                qty_after=_calculate_stock_after(
                    row.Transaction.qty_before,
                    row.Transaction.qty,
                    row.Transaction.action,
                ),
                metadata=row.Transaction.txn_metadata,
            )
            for row in rows
        ],
    )


@router.get("/transactions/latest/{sku_code}", response_model=LatestTransactionsResponse)
async def get_latest_transactions_by_sku(
    sku_code: str,
    db: AsyncSession = Depends(get_session),
    location: Optional[str] = Query(None, description="Filter by location name"),
):
    """
    Returns the two most recent transactions for a specific SKU.
    
    Optionally filtered by location. If no location is provided, returns transactions across all locations.
    Includes stock before/after calculations for each transaction.
    """

    # Check if SKU exists
    sku_exists_query = select(State.sku_code).where(State.sku_code == sku_code)

    if location is not None:
        sku_exists_query = sku_exists_query.join(State.location).where(Location.name == location)

    sku_exists_result = await db.execute(sku_exists_query)
    if sku_exists_result.scalar() is None:
        raise NotFound
    
    # Count distinct locations where this SKU is present (has transactions)
    location_count_query = (
        select(func.count(func.distinct(TransactionModel.location_id)))
        .where(TransactionModel.sku_code == sku_code)
    )
    location_count_result = await db.execute(location_count_query)
    location_count = location_count_result.scalar() or 0

    # If SKU exists in only one location, auto-assign it
    if location is None and location_count == 1:
        single_location_query = (
            select(Location.name)
            .join(TransactionModel, TransactionModel.location_id == Location.id)
            .where(TransactionModel.sku_code == sku_code)
            .limit(1)
        )
        single_location_result = await db.execute(single_location_query)
        location = single_location_result.scalar()
    
    # Main query with joins - include User for actor name
    query = (
        select(
            TransactionModel,
            Location.name.label("location_name"),
            User.first_name,
            User.last_name,
        )
        .join(Location, TransactionModel.location_id == Location.id)
        .outerjoin(User, TransactionModel.created_by == User.id)
        .where(TransactionModel.sku_code == sku_code)
    )
    
    # Apply location filter if provided
    if location:
        query = query.where(Location.name == location)
    
    query = query.order_by(TransactionModel.created_at.desc()).limit(2)
    
    result = await db.execute(query)
    rows = result.all()
    
    transactions = [
        Transaction(
            id=str(row.Transaction.id),
            date=row.Transaction.created_at.strftime(
                "%b %d, %Y at %I:%M %p"
            ),
            actor=f"{row.first_name} {row.last_name}" if row.first_name and row.last_name else "System",
            action=_format_action(row.Transaction.action),
            quantity=abs(row.Transaction.qty),
            sku_code=row.Transaction.sku_code,
            location=row.location_name,
            qty_before=row.Transaction.qty_before,
            qty_after=_calculate_stock_after(
                row.Transaction.qty_before,
                row.Transaction.qty,
                row.Transaction.action,
            ),
            metadata=row.Transaction.txn_metadata,
        )
        for row in rows
    ]
    
    return LatestTransactionsResponse(
        sku_code=sku_code,
        location=location,
        transactions=transactions
    )


@router.get("/transactions/latest", response_model=LatestTransactionsResponse)
async def get_latest_transactions(
    db: AsyncSession = Depends(get_session),
    location: Optional[str] = Query(None, description="Filter by location name"),
):
    """
    Returns the two most recent transactions across all inventory.
    
    Optionally filtered by location. If no location is provided, returns transactions across all locations.
    Includes stock before/after calculations for each transaction.
    """
    
    # Count distinct locations that have transactions
    location_count_query = select(func.count(func.distinct(TransactionModel.location_id)))
    
    location_count_result = await db.execute(location_count_query)
    location_count = location_count_result.scalar() or 0

    # If transactions exist in only one location, auto-assign it
    if location is None and location_count == 1:
        single_location_query = (
            select(Location.name)
            .join(TransactionModel, TransactionModel.location_id == Location.id)
            .limit(1)
        )
        single_location_result = await db.execute(single_location_query)
        location = single_location_result.scalar()
    
    # Main query with joins - include User for actor name
    query = (
        select(
            TransactionModel,
            Location.name.label("location_name"),
            User.first_name,
            User.last_name,
        )
        .join(Location, TransactionModel.location_id == Location.id)
        .outerjoin(User, TransactionModel.created_by == User.id)
    )
    
    # Apply location filter if provided
    if location:
        query = query.where(Location.name == location)
    
    query = query.order_by(TransactionModel.created_at.desc()).limit(2)
    
    result = await db.execute(query)
    rows = result.all()
    
    # If no transactions found, return empty list
    if not rows:
        return LatestTransactionsResponse(
            location=location,
            transactions=[]
        )
    
    transactions = [
        Transaction(
            id=str(row.Transaction.id),
            date=row.Transaction.created_at.strftime(
                "%b %d, %Y at %I:%M %p"
            ),
            actor=f"{row.first_name} {row.last_name}" if row.first_name and row.last_name else "System",
            action=_format_action(row.Transaction.action),
            quantity=abs(row.Transaction.qty),
            sku_code=row.Transaction.sku_code,
            location=row.location_name,
            qty_before=row.Transaction.qty_before,
            qty_after=_calculate_stock_after(
                row.Transaction.qty_before,
                row.Transaction.qty,
                row.Transaction.action,
            ),
            metadata=row.Transaction.txn_metadata,
        )
        for row in rows
    ]
    
    resp = LatestTransactionsResponse(
        location=location,
        transactions=transactions,
    )

    return JSONResponse(content=resp.model_dump(exclude={"sku_code"}))
