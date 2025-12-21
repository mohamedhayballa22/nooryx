# conftest.py
import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from alembic.config import Config
from alembic import command
from app.models import Organization
from app.services.txn import TransactionService

TEST_DATABASE_URL = "postgresql+asyncpg://souleymane:postgres@localhost:5432/test_db"

@pytest.fixture(scope="session")
def alembic_config():
    """Points to your alembic.ini and sets the test database URL."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    return cfg

@pytest_asyncio.fixture(scope="session", autouse=True)
async def upgrade_database(alembic_config):
    """
    Applies migrations once per test session in a separate thread.
    """
    def run_upgrade():
        command.upgrade(alembic_config, "head")

    await asyncio.get_event_loop().run_in_executor(None, run_upgrade)
    yield

@pytest_asyncio.fixture
async def db_session():
    """Provides an isolated async session for each test with transaction rollback."""
    engine = create_async_engine(TEST_DATABASE_URL)
    
    async with engine.begin() as conn:
        # Start a transaction
        async with async_sessionmaker(
            bind=conn,
            expire_on_commit=False,
            class_=AsyncSession
        )() as session:
            # Begin a nested transaction
            await conn.begin_nested()
            
            yield session
            
            # Rollback everything after the test
            await session.rollback()
    
    await engine.dispose()
    
@pytest_asyncio.fixture
async def session_factory():
    """Provides a session factory for concurrent operations."""
    engine = create_async_engine(TEST_DATABASE_URL)
    
    factory = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
        class_=AsyncSession
    )
    
    yield factory
    
    await engine.dispose()

@pytest.fixture
def create_org(db_session):
    async def _create(name: str = "Test Org", valuation_method: str = "FIFO", currency: str = "USD"):
        org = Organization(
            name=name, 
            valuation_method=valuation_method, 
            currency=currency
        )
        db_session.add(org)
        await db_session.flush()
        # Don't commit here - let the session handle it
        return org
    return _create

@pytest.fixture
def txn_service(db_session):
    """Factory to create TransactionService instances."""
    def _create(org_id):
        return TransactionService(
            session=db_session,
            org_id=org_id,
            user_id=None
        )
    return _create
