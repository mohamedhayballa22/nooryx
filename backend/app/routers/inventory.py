from fastapi import APIRouter, Depends, Query
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from enum import Enum

from app.schemas.inventory import (
    InventoryItemResponse, 
    SkuInventoryResponse, 
    InventorySummary, 
    OnHandValue
    )
from app.models import InventoryState, Location, InventoryTransaction
from app.core.db import get_session
from app.services.transaction.exceptions import TransactionBadRequest, NotFound
from app.services.metrics import calculate_weekly_delta


router = APIRouter()


class StockStatus(str, Enum):
    OUT_OF_STOCK = "Out of Stock"
    LOW_STOCK = "Low Stock"
    IN_STOCK = "In Stock"


@router.get("/inventory", response_model=Page[InventoryItemResponse])
async def get_inventory(
    db: AsyncSession = Depends(get_session),
    # Filtering parameters
    search: Optional[str] = Query(
        None, description="Search across SKU and location (partial match)"
    ),
    stock_status: Optional[List[StockStatus]] = Query(
        None, description="Filter by stock status (can specify multiple)"
    ),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "sku",
        description="Sort by field",
        regex="^(sku|product_name|location|available|status)$",
    ),
    order: Optional[str] = Query("asc", description="Sort order", regex="^(asc|desc)$"),
):
    """
    Returns current inventory status across all SKUs and locations.
    Efficiently joins inventory state with latest transaction per SKU/location.

    Supports searching across SKU and location, filtering by stock status, and sorting by multiple fields.
    """
    # Check if any inventory exists at all (only when no filters are applied)
    if not search and not stock_status:
        inventory_count = await db.scalar(
            select(func.count()).select_from(InventoryState)
        )
        if inventory_count == 0:
            raise NotFound

    # Subquery to get the most recent transaction for each SKU/location
    latest_txn_subq = (
        select(
            InventoryTransaction.sku_id,
            InventoryTransaction.location_id,
            func.max(InventoryTransaction.id).label("max_txn_id"),
        )
        .group_by(InventoryTransaction.sku_id, InventoryTransaction.location_id)
        .subquery()
    )

    # Define the status case expression for reuse
    status_expr = case(
        (InventoryState.available == 0, "Out of Stock"),
        (InventoryState.available < 10, "Low Stock"),
        else_="In Stock",
    ).label("status")

    # Main query joining inventory state with latest transaction
    query = (
        select(
            InventoryState.sku_id.label("sku"),
            InventoryState.product_name.label("product_name"),
            Location.name.label("location"),
            InventoryState.available.label("available"),
            InventoryTransaction,
            status_expr,
        )
        .join(Location, InventoryState.location_id == Location.id)
        .outerjoin(
            latest_txn_subq,
            (InventoryState.sku_id == latest_txn_subq.c.sku_id)
            & (InventoryState.location_id == latest_txn_subq.c.location_id),
        )
        .outerjoin(
            InventoryTransaction, InventoryTransaction.id == latest_txn_subq.c.max_txn_id
        )
        .options(selectinload(InventoryTransaction.location))
    )

    # Apply search filter across SKU and location
    if search:
        query = query.where(
            or_(
                InventoryState.sku_id.ilike(f"%{search}%"),
                Location.name.ilike(f"%{search}%"),
            )
        )

    # Apply stock_status filter at the database level if possible
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
        "product_name": InventoryState.product_name,
        "location": Location.name,
        "available": InventoryState.available,
        "status": status_expr,
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
                last_transaction=row.InventoryTransaction.narrative
                if row.InventoryTransaction
                else "No transactions yet",
                status=row.status,
            )
            for row in rows
        ],
    )


@router.get("/inventory/{sku_id}", response_model=SkuInventoryResponse)
async def get_sku_inventory(
    sku_id: str, 
    location: Optional[str] = Query(None, description="Location name (None = aggregate across all locations)"),
    db: AsyncSession = Depends(get_session)
):
    """Get comprehensive inventory view for a SKU across all locations or for a specific location."""

    # Check if SKU exists
    sku_exists_query = select(InventoryState.sku_id).where(InventoryState.sku_id == sku_id)

    if location is not None:
        sku_exists_query = sku_exists_query.join(InventoryState.location).where(Location.name == location)

    sku_exists_result = await db.execute(sku_exists_query)
    if sku_exists_result.scalar() is None:
        raise NotFound

    # Build base query
    stmt = (
        select(InventoryState)
        .options(selectinload(InventoryState.location))
        .where(InventoryState.sku_id == sku_id)
        .order_by(InventoryState.location_id)
    )
    
    # Apply location filter if specified (by name)
    location_id = None
    if location is not None:
        stmt = stmt.where(InventoryState.location.has(name=location))
        # Get location_id for delta calculation
        loc_stmt = select(Location.id).where(Location.name == location)
        loc_result = await db.execute(loc_stmt)
        location_id = loc_result.scalar_one_or_none()
        if location_id is None:
            raise TransactionBadRequest(detail=f"Location '{location}' not found")
    
    result = await db.execute(stmt)
    states = result.scalars().all()

    if not states:
        if location is not None:
            raise TransactionBadRequest(
                detail=f"SKU {sku_id} not found at location '{location}'"
            )
        raise TransactionBadRequest(detail=f"SKU {sku_id} not found")

    product_name = states[0].product_name
    
    # Get all location names for this SKU (always across all locations)
    location_names_stmt = (
        select(Location.name)
        .join(InventoryState, InventoryState.location_id == Location.id)
        .where(InventoryState.sku_id == sku_id)
        .order_by(Location.name)
    )
    location_names_result = await db.execute(location_names_stmt)
    location_names = list(location_names_result.scalars().all())
    
    # Get total location count for this SKU (always across all locations)
    total_locations = len(location_names)

    # If SKU exists in only one location, auto-assign it
    if location is None and total_locations == 1:
        location = location_names[0]

    # Calculate totals from the filtered states
    total_available = 0
    total_reserved = 0
    total_on_hand = 0

    for state in states:
        total_available += state.available
        total_reserved += state.reserved
        total_on_hand += state.on_hand

    # Calculate global on_hand total (across ALL locations) for inventory_pct
    global_on_hand_stmt = (
        select(func.sum(InventoryState.on_hand))
        .where(InventoryState.sku_id == sku_id)
    )
    global_on_hand_result = await db.execute(global_on_hand_stmt)
    global_on_hand = global_on_hand_result.scalar() or 0

    # Calculate inventory_pct
    if location is None or total_locations == 1 or global_on_hand == 0:
        inventory_pct = 100.0
    else:
        inventory_pct = round((total_on_hand / global_on_hand) * 100, 1)

    # Determine overall status
    if total_available == 0:
        status = "Out of Stock"
    elif total_available < 10:
        status = "Low Stock"
    else:
        status = "In Stock"

    # Calculate delta (aggregated if no location, specific if location provided)
    total_delta_pct = await calculate_weekly_delta(db, total_on_hand, sku_id=sku_id, location_id=location_id)

    return SkuInventoryResponse(
        sku=sku_id,
        product_name=product_name,
        status=status,
        location=location,
        locations=total_locations,
        location_names=location_names,
        inventory_pct=inventory_pct,
        summary=InventorySummary(
            available=total_available,
            reserved=total_reserved,
            on_hand=OnHandValue(value=total_on_hand, delta_pct=total_delta_pct),
        ),
    )
