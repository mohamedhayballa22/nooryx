from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import NooryxAdmin
from app.core.auth.manager import AdminManager
from app.core.auth.users import get_admin_db
from app.core.logger_config import logger
from fastapi_users import schemas


class AdminCreate(schemas.BaseUserCreate):
    """
    Schema used ONLY for creating NooryxAdmin users.
    """
    pass


async def create_initial_admin(session: AsyncSession) -> None:
    if not settings.FIRST_ADMIN_EMAIL or not settings.FIRST_ADMIN_PASSWORD:
        return

    result = await session.execute(
        select(NooryxAdmin.id).limit(1)
    )
    if result.scalar_one_or_none():
        return

    admin_db = await get_admin_db(session).__anext__()
    admin_manager = AdminManager(admin_db)

    admin_create = AdminCreate(
        email=settings.FIRST_ADMIN_EMAIL,
        password=settings.FIRST_ADMIN_PASSWORD,
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )

    await admin_manager.create(admin_create)

    logger.warning(
        "Initial NooryxAdmin created from environment variables. "
        "REMOVE FIRST_ADMIN_* FROM PROD."
    )
