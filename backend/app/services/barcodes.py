from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from app.models import Barcode
import uuid


async def link_barcode(
    db: AsyncSession,
    org_id: uuid.UUID,
    value: str,
    sku_code: str,
    format: str | None = None,
) -> None:
    """Register a barcode-SKU relationship if it doesn't already exist."""
    stmt = insert(Barcode).values(
        org_id=org_id,
        value=value,
        sku_code=sku_code,
        barcode_format=format
    ).on_conflict_do_nothing(
        index_elements=['org_id', 'value']
    )
    
    await db.execute(stmt)
