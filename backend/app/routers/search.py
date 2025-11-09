from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth.tenant_dependencies import get_tenant_session
from app.schemas.search import SKUSearchResult
from app.services.search import search_skus, search_locations
from typing import List


router = APIRouter()


@router.get("/skus", response_model=List[SKUSearchResult])
async def search_sku(
    q: str = Query(..., min_length=1, max_length=100, description="Search query string"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of results"),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Search for SKUs by partial match on code or name.
    
    - **q**: Search query (case-insensitive, partial match)
    - **limit**: Maximum results to return (default: 5, max: 20)
    
    Results are ranked by relevance:
    1. SKU code starts with query
    2. SKU name starts with query
    3. SKU code contains query
    4. SKU name contains query
    """
    results = await search_skus(db=db, query=q, limit=limit)
    
    return [
            SKUSearchResult(
                sku_code=row["sku_code"],
                sku_name=row["sku_name"],
                alerts_enabled=row["alerts"],
                reorder_point=row["reorder_point"],
                low_stock_threshold=row["low_stock_threshold"]
            )
            for row in results
        ]


@router.get("/locations", response_model=List[str])
async def search_location(
    q: str = Query(..., min_length=1, max_length=100, description="Search query string"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of results"),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Search for locations by partial match on name.
    
    - **q**: Search query (case-insensitive, partial match)
    - **limit**: Maximum results to return (default: 5, max: 20)
    """
    
    return await search_locations(db=db, query=q, limit=limit)
