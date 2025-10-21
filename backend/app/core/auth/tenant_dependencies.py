"""
Tenant-aware database session dependency.
"""
from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.core.db import async_session_maker
from app.core.auth.dependencies import get_current_user
from app.core.tenancy import set_current_tenant_id, clear_current_tenant_id


async def get_tenant_session(
    user: User = Depends(get_current_user)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session with automatic tenant filtering.
    """
    async with async_session_maker() as session:
        set_current_tenant_id(user.org_id)
        
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            clear_current_tenant_id()
            await session.close()
