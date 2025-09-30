from fastapi import FastAPI, Depends, Query
from fastapi_pagination import add_pagination
from fastapi_pagination.ext.sqlalchemy import apaginate
from fastapi_pagination import Page
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from typing import Optional
from app.schemas import (
    ReceiveTxn,
    ShipTxn,
    AdjustTxn,
    ReserveTxn,
    UnreserveTxn,
    TransferTxn,
    InventoryItemResponse
)
from app.models import InventoryState, Location, InventoryTransaction
from enum import Enum

from app.core.config import settings
from app.core.db import get_session
from app.services.transaction.txn import apply_txn
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.correlation import CorrelationIdMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_, and_
from sqlalchemy.orm import selectinload
from typing import List
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.logger_config import logger
from fastapi.exceptions import RequestValidationError


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
