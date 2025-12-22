import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from alembic.config import Config
from alembic import command
from app.models import Organization
from app.services.txn import TransactionService
from uuid6 import uuid7

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
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    # Create a connection
    async with engine.connect() as conn:
        # Start a transaction
        trans = await conn.begin()
        
        # Create session bound to the connection
        session = AsyncSession(bind=conn, expire_on_commit=False)
        
        yield session
        
        # Rollback the transaction (this removes all test data)
        await session.close()
        await trans.rollback()
    
    await engine.dispose()

@pytest_asyncio.fixture
async def session_factory():
    """
    Provides a session factory for concurrent operations.
    Automatically tracks and cleans up all organizations created during the test.
    """
    engine = create_async_engine(TEST_DATABASE_URL)
    
    factory = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
        class_=AsyncSession
    )
    
    # Track all org_ids created during this test
    created_org_ids = set()
    
    # Wrap the factory to track Organization inserts
    class TrackingSessionFactory:
        def __call__(self):
            return self._create_tracking_session()
        
        async def __aenter__(self):
            session = factory()
            return await self._wrap_session(session).__aenter__()
        
        async def __aexit__(self, *args):
            pass
        
        def _create_tracking_session(self):
            return self._wrap_session(factory())
        
        def _wrap_session(self, session):
            original_commit = session.commit
            
            async def tracking_commit():
                # Before commit, capture any new Organization instances
                for obj in session.new:
                    if isinstance(obj, Organization):
                        # Flush to get the ID if needed
                        await session.flush()
                        created_org_ids.add(obj.org_id)
                
                return await original_commit()
            
            session.commit = tracking_commit
            return session
    
    tracking_factory = TrackingSessionFactory()
    
    yield tracking_factory
    
    # Cleanup: Delete all tracked organizations (cascades to related data)
    if created_org_ids:
        async with engine.begin() as conn:
            from sqlalchemy import delete
            await conn.execute(
                delete(Organization).where(Organization.org_id.in_(created_org_ids))
            )
    
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
        return org
    return _create

@pytest_asyncio.fixture
async def create_sku(db_session, create_org):
    from app.models import SKU
    
    async def _create(
        org,
        code: str = "TEST-SKU",
        name: str = "Test SKU",
        reorder_point: int = 0,
        alerts: bool = False,
    ):
        if code is None:
            code = str(uuid7())
        new_sku = SKU(
            name=name,
            code=code,
            org_id=org.org_id,
            reorder_point=reorder_point,
            alerts=alerts,
        )
        db_session.add(new_sku)
        await db_session.flush()
        return new_sku
    return _create

@pytest_asyncio.fixture
async def create_location(db_session, create_org):
    from app.models import Location
    
    async def _create(org, name: str = "Test Location"):
        location = Location(
            name=name,
            org_id=org.org_id
        )
        db_session.add(location)
        await db_session.flush()
        return location
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
