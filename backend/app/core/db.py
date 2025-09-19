from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from .config import settings


engine = create_async_engine(
    settings.DATABASE_URL, pool_pre_ping=True, pool_recycle=3600
)


async def get_session():
    async_session = async_sessionmaker(
        autocommit=False, autoflush=False, expire_on_commit=False, bind=engine
    )
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


Base = declarative_base()
