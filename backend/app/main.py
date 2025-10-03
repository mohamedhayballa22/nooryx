from fastapi import FastAPI, Depends, Query
from fastapi_pagination import add_pagination
from fastapi_pagination.ext.sqlalchemy import apaginate
from fastapi_pagination import Page
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from typing import Optional
from datetime import datetime, timedelta
from app.schemas import (
    ReceiveTxn,
    ShipTxn,
    AdjustTxn,
    ReserveTxn,
    UnreserveTxn,
    TransferTxn,
    InventoryItemResponse,
    TransactionHistoryResponse,
    LocationInventory,
    InventorySummary,
    SkuInventoryResponse,
    OnHandValue
)
from app.models import InventoryState, Location, InventoryTransaction
from enum import Enum

from app.core.config import settings
from app.core.db import get_session
from app.services.transaction.txn import apply_txn
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.correlation import CorrelationIdMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_, and_, String
from sqlalchemy.orm import selectinload
from typing import List
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.logger_config import logger
from fastapi.exceptions import RequestValidationError
from app.services.transaction.exceptions import TransactionBadRequest




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

# Correlation/Request tracking
app.add_middleware(CorrelationIdMiddleware)

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
    default_rate=5,
    # After 5 seconds of no activity, back to full 25 burst capacity
)

add_pagination(app)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for any unhandled exceptions.
    This is a safety net in case middleware doesn't catch something.
    """
    logger.error(
        "unhandled_exception",
        method=request.method,
        path=request.url.path,
        error=str(exc),
        error_type=type(exc).__name__,
    )

    return JSONResponse(
        status_code=500, content={"detail": "An internal server error occurred."}
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions (400, 404, etc.)"""
    request.state.error_detail = exc.detail
    return JSONResponse(status_code=exc.status_code, content={"error": {"detail": exc.detail}})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Transform Pydantic validation errors into a consistent, minimal error envelope.
    """
    errors = []
    for err in exc.errors():
        field = ".".join(map(str, err.get("loc", [])))
        if field.startswith("body."):
            field = field[5:]

        errors.append({
            "field": field,
            "error": err.get("msg"),
        })

    request.state.error_detail = errors

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "type": "validation_error",
                "message": "Invalid request payload",
                "details": errors,
            }
        },
    )


@app.post("/inventory/receive")
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
            "reserved": updated_state.reserved
        }
    }

    await db.commit()

    return response_data


@app.post("/inventory/ship")
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
            "reserved": updated_state.reserved
        }
    }

    await db.commit()

    return response_data


@app.post("/inventory/adjust")
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
            "reserved": updated_state.reserved
        }
    }

    await db.commit()

    return response_data


@app.post("/inventory/reserve")
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
            "reserved": updated_state.reserved
        }
    }

    await db.commit()

    return response_data


@app.post("/inventory/unreserve")
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
            "reserved": updated_state.reserved
        }
    }

    await db.commit()

    return response_data


@app.post("/inventory/transfer")
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
            "reserved": source_updated_state.reserved
        },
        "target_inventory_state": {
            "sku_id": target_updated_state.sku_id,
            "location_id": target_updated_state.location_id,
            "on_hand": target_updated_state.on_hand,
            "available": target_updated_state.available,
            "reserved": target_updated_state.reserved
        }
    }

    await db.commit()

    return response_data

class StockStatus(str, Enum):
    OUT_OF_STOCK = "Out of Stock"
    LOW_STOCK = "Low Stock"
    IN_STOCK = "In Stock"

@app.get("/inventory", response_model=Page[InventoryItemResponse])
async def get_inventory(
    db: AsyncSession = Depends(get_session),
    # Filtering parameters
    search: Optional[str] = Query(None, description="Search across SKU and location (partial match)"),
    stock_status: Optional[List[StockStatus]] = Query(
        None, 
        description="Filter by stock status (can specify multiple)"
    ),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "sku", 
        description="Sort by field",
        regex="^(sku|product_name|location|available|status)$"
    ),
    order: Optional[str] = Query(
        "asc", 
        description="Sort order",
        regex="^(asc|desc)$"
    )
):
    """
    Returns current inventory status across all SKUs and locations.
    Efficiently joins inventory state with latest transaction per SKU/location.
    
    Supports searching across SKU and location, filtering by stock status, and sorting by multiple fields.
    """
    
    # Subquery to get the most recent transaction for each SKU/location
    latest_txn_subq = (
        select(
            InventoryTransaction.sku_id,
            InventoryTransaction.location_id,
            func.max(InventoryTransaction.id).label("max_txn_id")
        )
        .group_by(
            InventoryTransaction.sku_id,
            InventoryTransaction.location_id
        )
        .subquery()
    )
    
    # Define the status case expression for reuse
    status_expr = case(
        (InventoryState.available == 0, "Out of Stock"),
        (InventoryState.available < 10, "Low Stock"),
        else_="In Stock"
    ).label("status")
    
    # Main query joining inventory state with latest transaction
    query = (
        select(
            InventoryState.sku_id.label("sku"),
            InventoryState.sku_id.label("product_name"),
            Location.name.label("location"),
            InventoryState.available.label("available"),
            InventoryTransaction,
            status_expr
        )
        .join(Location, InventoryState.location_id == Location.id)
        .outerjoin(
            latest_txn_subq,
            (InventoryState.sku_id == latest_txn_subq.c.sku_id) &
            (InventoryState.location_id == latest_txn_subq.c.location_id)
        )
        .outerjoin(
            InventoryTransaction,
            InventoryTransaction.id == latest_txn_subq.c.max_txn_id
        )
        .options(selectinload(InventoryTransaction.location))
    )
    
    # Apply search filter across SKU and location
    if search:
        query = query.where(
            or_(
                InventoryState.sku_id.ilike(f"%{search}%"),
                Location.name.ilike(f"%{search}%")
            )
        )
    
    # Apply stock_status filter at the database level if possible
    # This optimizes by filtering before pagination
    if stock_status:
        status_conditions = []
        for status in stock_status:
            if status == StockStatus.OUT_OF_STOCK:
                status_conditions.append(InventoryState.available == 0)
            elif status == StockStatus.LOW_STOCK:
                status_conditions.append(
                    and_(InventoryState.available > 0, InventoryState.available < 10)
                )
            elif status == StockStatus.IN_STOCK:
                status_conditions.append(InventoryState.available >= 10)
        
        if status_conditions:
            query = query.where(or_(*status_conditions))
    
    # Apply sorting
    sort_mapping = {
        "sku": InventoryState.sku_id,
        "product_name": InventoryState.sku_id,  # Same as sku in current implementation
        "location": Location.name,
        "available": InventoryState.available,
        "status": status_expr
    }
    
    sort_column = sort_mapping.get(sort_by, InventoryState.sku_id)
    
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    if sort_by != "location":
        query = query.order_by(Location.name)
    
    return await apaginate(
        db, 
        query,
        transformer=lambda rows: [
            InventoryItemResponse(
                sku=row.sku,
                product_name=row.product_name,
                location=row.location,
                available=row.available,
                last_transaction=row.InventoryTransaction.narrative if row.InventoryTransaction else "No transactions yet",
                status=row.status
            )
            for row in rows
        ]
    )


@app.get("/transactions", response_model=Page[TransactionHistoryResponse])
async def get_transactions(
    db: AsyncSession = Depends(get_session),
    # Filtering parameters
    search: Optional[str] = Query(
        None, 
        description="Search across actor, action, SKU, location, and metadata (partial match)"
    ),
    action: Optional[List[str]] = Query(
        None,
        description="Filter by action type(s)",
    ),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "created_at", 
        description="Sort by field",
        regex="^(created_at|action|sku|location|quantity)$"
    ),
    order: Optional[str] = Query(
        "desc", 
        description="Sort order",
        regex="^(asc|desc)$"
    )
):
    """
    Returns paginated transaction history with stock before/after calculations.
    
    Supports searching across actor, action, SKU, location, and metadata fields.
    """
    
    # Subquery to calculate cumulative stock before each transaction
    # This uses a window function to sum all previous transactions
    stock_before_subq = (
        select(
            InventoryTransaction.id,
            func.coalesce(
                func.sum(InventoryTransaction.qty).over(
                    partition_by=[
                        InventoryTransaction.sku_id,
                        InventoryTransaction.location_id
                    ],
                    order_by=InventoryTransaction.id,
                    rows=(None, -1)  # All rows before current
                ),
                0
            ).label("stock_before")
        )
        .subquery()
    )
    
    # Main query with joins
    query = (
        select(
            InventoryTransaction,
            Location.name.label("location_name"),
            stock_before_subq.c.stock_before
        )
        .join(Location, InventoryTransaction.location_id == Location.id)
        .join(
            stock_before_subq,
            InventoryTransaction.id == stock_before_subq.c.id
        )
    )
    
    # Apply action filter
    if action:
        # Collect all DB actions from all frontend action filters
        db_actions = []
        for display_action in action:
            db_actions.extend(_get_db_actions_from_display(display_action))
        
        query = query.where(InventoryTransaction.action.in_(db_actions))
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        
        # Build metadata search conditions
        # Search for the pattern in any key or value in the JSON metadata
        metadata_search = func.cast(InventoryTransaction.txn_metadata, String).ilike(search_pattern)
        
        query = query.where(
            or_(
                InventoryTransaction.created_by.ilike(search_pattern),
                InventoryTransaction.action.ilike(search_pattern),
                InventoryTransaction.sku_id.ilike(search_pattern),
                Location.name.ilike(search_pattern),
                metadata_search
            )
        )
    
    # Apply sorting
    sort_mapping = {
        "created_at": InventoryTransaction.created_at,
        "action": InventoryTransaction.action,
        "sku": InventoryTransaction.sku_id,
        "location": Location.name,
        "quantity": InventoryTransaction.qty
    }
    
    sort_column = sort_mapping.get(sort_by, InventoryTransaction.created_at)
    
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Add secondary sort by ID to ensure consistent ordering
    if sort_by != "created_at":
        query = query.order_by(InventoryTransaction.created_at.desc())
    
    return await apaginate(
        db, 
        query,
        transformer=lambda rows: [
            TransactionHistoryResponse(
                id=row.InventoryTransaction.id,
                date=row.InventoryTransaction.created_at.strftime("%b %d, %Y at %I:%M %p"),
                actor=row.InventoryTransaction.created_by or "Hannah Kandell",  # Hardcoded fallback
                action=_format_action(row.InventoryTransaction.action),
                quantity=abs(row.InventoryTransaction.qty),
                sku=row.InventoryTransaction.sku_id,
                location=row.location_name,
                stock_before=row.stock_before,
                stock_after=row.stock_before + row.InventoryTransaction.qty,
                metadata=row.InventoryTransaction.txn_metadata
            )
            for row in rows
        ]
    )


def _get_db_actions_from_display(display_action: str) -> list[str]:
    """
    Convert frontend display action to database action(s).
    Returns a list because some display actions map to multiple DB actions.
    """
    action_map = {
        "added": ["receive"],
        "shipped": ["ship"],
        "reserved": ["reserve"],
        "transferred": ["transfer", "transfer_in", "transfer_out"],
        "adjusted": ["adjust"],
        "unreserved": ["unreserve"]
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
        "transfer": "transferred"
    }
    return action_map.get(action, action + "ed")


@app.get("/inventory/{sku_id}", response_model=SkuInventoryResponse)
async def get_sku_inventory(
    sku_id: str,
    db: AsyncSession = Depends(get_session)
):
    """Get comprehensive inventory view for a SKU across all locations."""
    
    # Fetch current inventory states with eager loading
    stmt = (
        select(InventoryState)
        .options(selectinload(InventoryState.location))
        .where(InventoryState.sku_id == sku_id)
        .order_by(InventoryState.location_id)
    )
    result = await db.execute(stmt)
    states = result.scalars().all()
    
    if not states:
        raise TransactionBadRequest(detail=f"SKU {sku_id} not found")
    
    # Build locations list and calculate totals
    locations = []
    total_available = 0
    total_reserved = 0
    total_on_hand = 0
    product_name = states[0].product_name
    
    for state in states:
        # Calculate delta for this specific location
        delta_pct = await _calculate_weekly_delta(db, sku_id, state.location_id, state.on_hand)
        
        # Determine per-location status
        if state.available == 0:
            location_status = "Out of Stock"
        elif state.available < 10:
            location_status = "Low Stock"
        else:
            location_status = "In Stock"
        
        locations.append(
            LocationInventory(
                id=state.location_id,
                name=state.location.name,
                status=location_status,
                available=state.available,
                reserved=state.reserved,
                on_hand=OnHandValue(value=state.on_hand, delta_pct=delta_pct)
            )
        )
        total_available += state.available
        total_reserved += state.reserved
        total_on_hand += state.on_hand
    
    # Determine overall status
    if total_available == 0:
        status = "Out of Stock"
    elif total_available < 10:
        status = "Low Stock"
    else:
        status = "In Stock"
    
    # Calculate aggregate week-over-week delta
    total_delta_pct = await _calculate_weekly_delta(db, sku_id, None, total_on_hand)
    
    return SkuInventoryResponse(
        sku=sku_id,
        product_name=product_name,
        status=status,
        locations=locations,
        summary=InventorySummary(
            available=total_available,
            reserved=total_reserved,
            on_hand=OnHandValue(value=total_on_hand, delta_pct=total_delta_pct),
            locations=len(locations)
        )
    )


async def _calculate_weekly_delta(
    db: AsyncSession,
    sku_id: str,
    location_id: int | None,
    current_on_hand: int
) -> float:
    """Calculate percentage change in on-hand inventory from last week.
    
    Args:
        db: Database session
        sku_id: SKU identifier
        location_id: Specific location (or None for aggregate across all locations)
        current_on_hand: Current on-hand quantity
    """
    
    # Special case: current stock is 0
    if current_on_hand == 0:
        # Check if there was stock last week
        one_week_ago = datetime.now() - timedelta(days=7)
        two_weeks_ago = datetime.now() - timedelta(days=14)
        
        filters = [
            InventoryTransaction.sku_id == sku_id,
            InventoryTransaction.created_at >= two_weeks_ago,
            InventoryTransaction.created_at <= one_week_ago
        ]
        if location_id is not None:
            filters.append(InventoryTransaction.location_id == location_id)
        
        stmt = (
            select(InventoryTransaction)
            .where(and_(*filters))
            .order_by(InventoryTransaction.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        last_week_txn = result.scalar_one_or_none()
        
        if last_week_txn:
            last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)
            if last_week_on_hand > 0:
                return -100.0
        
        return 0.0
    
    # Find transaction from 5-11 days ago, closest to 7 days
    today = datetime.now()
    min_date = today - timedelta(days=11)
    max_date = today - timedelta(days=5)
    
    filters = [
        InventoryTransaction.sku_id == sku_id,
        InventoryTransaction.created_at >= min_date,
        InventoryTransaction.created_at <= max_date
    ]
    if location_id is not None:
        filters.append(InventoryTransaction.location_id == location_id)
    
    # If calculating aggregate (location_id is None), we need to sum across locations
    if location_id is None:
        # Get all transactions in the window, group by timestamp to find closest date
        stmt = (
            select(
                InventoryTransaction.created_at,
                func.sum(
                    case(
                        (InventoryTransaction.action.in_(["reserve", "unreserve"]), InventoryTransaction.qty_before),
                        else_=InventoryTransaction.qty_before + InventoryTransaction.qty
                    )
                ).label("total_on_hand")
            )
            .where(and_(*filters))
            .group_by(InventoryTransaction.created_at)
            .order_by(
                func.abs(
                    func.extract('epoch', InventoryTransaction.created_at - (today - timedelta(days=7)))
                )
            )
            .limit(1)
        )
        
        result = await db.execute(stmt)
        row = result.first()
        
        if not row or row.total_on_hand == 0:
            return 0.0
        
        last_week_on_hand = row.total_on_hand
    else:
        # Single location calculation
        stmt = (
            select(InventoryTransaction)
            .where(and_(*filters))
            .order_by(
                func.abs(
                    func.extract('epoch', InventoryTransaction.created_at - (today - timedelta(days=7)))
                )
            )
            .limit(1)
        )
        
        result = await db.execute(stmt)
        last_week_txn = result.scalar_one_or_none()
        
        if not last_week_txn:
            return 0.0
        
        last_week_on_hand = _calculate_on_hand_from_txn(last_week_txn)
        
        if last_week_on_hand == 0:
            return 0.0
    
    delta_pct = ((current_on_hand - last_week_on_hand) / last_week_on_hand) * 100
    return round(delta_pct, 1)


def _calculate_on_hand_from_txn(txn: InventoryTransaction) -> int:
    """Calculate on-hand quantity at the time of a transaction."""
    if txn.action in ["reserve", "unreserve"]:
        return txn.qty_before
    else:
        return txn.qty_before + txn.qty
