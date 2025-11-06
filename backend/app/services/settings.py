from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth.dependencies import get_current_user
from app.core.db import get_session
from app.models import User, OrganizationSettings

async def get_low_stock_threshold(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> int:
    """
    Dependency to get the low stock threshold for the current user's organization.
    Returns the default value if no setting is found.
    """
    stmt = select(OrganizationSettings.low_stock_threshold).where(
        OrganizationSettings.org_id == user.org_id
    )
    result = await session.execute(stmt)
    threshold = result.scalar_one_or_none()

    if threshold is None:
        # Fallback to the default value if no organization-specific setting is found
        return 10
    
    return threshold
