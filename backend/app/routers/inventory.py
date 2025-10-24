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
from app.models import State, Location, Transaction, SKU
from app.core.db import get_session
from app.services.exceptions import TransactionBadRequest, NotFound
from app.services.metrics import calculate_weekly_delta
from app.core.auth.tenant_dependencies import get_tenant_session
from app.core.auth.dependencies import get_current_user
from app.models import User


router = APIRouter()


class StockStatus(str, Enum):
    OUT_OF_STOCK = "Out of Stock"
    LOW_STOCK = "Low Stock"
    IN_STOCK = "In Stock"


@router.get("/inventory", response_model=Page[InventoryItemResponse])
async def get_inventory(
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
    # Filtering parameters
    search: Optional[str] = Query(
        None, description="Search across SKU and location (partial match)"
    ),
    stock_status: Optional[List[StockStatus]] = Query(
        None, description="Filter by stock status (can specify multiple)"
    ),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "sku_code",
        description="Sort by field",
        regex="^(sku_code|name|location|available|status)$",
    ),
    order: Optional[str] = Query("asc", description="Sort order", regex="^(asc|desc)$"),
):
    """
    Returns list of current inventory with stock status across all SKUs 
    (aggregated across locations). Efficiently aggregates inventory and 
    finds the most recent transaction per SKU.

    Supports searching across SKU and location, filtering by stock status, and sorting by multiple fields.
    """
    # Check if any inventory exists at all (only when no filters are applied)
    if not search and len(stock_status) == 3:
        inventory_count = await db.scalar(
            select(func.count()).select_from(State).where(State.org_id == user.org_id)
        )
        if inventory_count == 0:
            raise NotFound

    # Subquery to get the most recent transaction for each SKU (across all locations)
    latest_txn_subq = (
        select(
            Transaction.sku_code,
            Transaction.id,
            func.row_number()
            .over(
                partition_by=Transaction.sku_code,
                order_by=Transaction.created_at.desc()
            )
            .label("rn"),
        )
        .where(Transaction.org_id == user.org_id)
        .subquery()
    )

    # Subquery for aggregated inventory per SKU
    aggregated_inventory = (
        select(
            State.sku_code,
            func.sum(State.available).label("total_available"),
            func.string_agg(Location.name, ", ").label("locations"),
        )
        .join(Location, State.location_id == Location.id)
        .where(State.org_id == user.org_id)
        .group_by(State.sku_code)
    )

    # Apply search filter to the aggregated subquery if needed
    if search:
        aggregated_inventory = aggregated_inventory.where(
            or_(
                State.sku_code.ilike(f"%{search}%"),
                Location.name.ilike(f"%{search}%"),
            )
        )

    aggregated_inventory = aggregated_inventory.subquery()

    # Define the status case expression for reuse (based on aggregated available)
    status_expr = case(
        (aggregated_inventory.c.total_available == 0, "Out of Stock"),
        (aggregated_inventory.c.total_available < 10, "Low Stock"),
        else_="In Stock",
    ).label("status")

    # Main query joining aggregated inventory with SKU and latest transaction
    query = (
        select(
            aggregated_inventory.c.sku_code,
            SKU.name,
            aggregated_inventory.c.locations,
            aggregated_inventory.c.total_available,
            Transaction,
            status_expr,
        )
        .join(SKU, aggregated_inventory.c.sku_code == SKU.code)
        .outerjoin(
            latest_txn_subq,
            (aggregated_inventory.c.sku_code == latest_txn_subq.c.sku_code)
            & (latest_txn_subq.c.rn == 1),
        )
        .outerjoin(
            Transaction,
            Transaction.id == latest_txn_subq.c.id
        )
        .options(selectinload(Transaction.location))
    )

    # Apply stock_status filter at the database level
    if stock_status:
        status_conditions = []
        for status in stock_status:
            if status == StockStatus.OUT_OF_STOCK:
                status_conditions.append(aggregated_inventory.c.total_available == 0)
            elif status == StockStatus.LOW_STOCK:
                status_conditions.append(
                    and_(
                        aggregated_inventory.c.total_available > 0,
                        aggregated_inventory.c.total_available < 10
                    )
                )
            elif status == StockStatus.IN_STOCK:
                status_conditions.append(aggregated_inventory.c.total_available >= 10)

        if status_conditions:
            query = query.where(or_(*status_conditions))

    # Apply sorting
    sort_mapping = {
        "sku_code": aggregated_inventory.c.sku_code,
        "name": SKU.name,
        "location": aggregated_inventory.c.locations,
        "available": aggregated_inventory.c.total_available,
        "status": status_expr,
    }

    sort_column = sort_mapping.get(sort_by, aggregated_inventory.c.sku_code)

    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    return await apaginate(
        db,
        query,
        transformer=lambda rows: [
            InventoryItemResponse(
                sku_code=row.sku_code,
                name=row.name,
                location=row.locations,
                available=row.total_available,
                last_transaction=row.Transaction.narrative
                if row.Transaction
                else "No transactions yet",
                status=row.status,
            )
            for row in rows
        ],
    )


@router.get("/inventory/{sku_code}", response_model=SkuInventoryResponse)
async def get_sku_inventory(
    sku_code: str, 
    location: Optional[str] = Query(None, description="Location name (None = aggregate across all locations)"),
    db: AsyncSession = Depends(get_tenant_session),
):
    """Get comprehensive inventory view for a SKU across all locations or for a specific location."""

    # Check if SKU exists
    sku_exists_query = select(State.sku_code).where(State.sku_code == sku_code)

    if location is not None:
        sku_exists_query = sku_exists_query.join(State.location).where(Location.name == location)

    sku_exists_result = await db.execute(sku_exists_query)
    if sku_exists_result.scalar() is None:
        raise NotFound

    # Build base query
    stmt = (
        select(State)
        .options(
            selectinload(State.location),
            selectinload(State.sku)
        )
        .where(State.sku_code == sku_code)
        .order_by(State.location_id)
    )
    
    # Apply location filter if specified (by name)
    location_id = None
    if location is not None:
        stmt = stmt.where(State.location.has(name=location))
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
                detail=f"SKU {sku_code} not found at location '{location}'"
            )
        raise TransactionBadRequest(detail=f"SKU {sku_code} not found")

    sku_name = states[0].sku.name
    
    # Get all location names for this SKU (always across all locations)
    location_names_stmt = (
        select(Location.name)
        .join(State, State.location_id == Location.id)
        .where(State.sku_code == sku_code)
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
        select(func.sum(State.on_hand))
        .where(State.sku_code == sku_code)
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
    total_delta_pct = await calculate_weekly_delta(
        db, 
        total_on_hand, 
        sku_code=sku_code, 
        location_id=location_id
    )

    return SkuInventoryResponse(
        sku_code=sku_code,
        name=sku_name,
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
