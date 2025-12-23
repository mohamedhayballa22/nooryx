"""
Integration test fixtures for API endpoint testing.

This module provides fixtures specifically for integration testing that hits 
actual HTTP endpoints. It complements the root conftest.py which focuses on 
service-layer testing.

Key differences from service-layer fixtures:
- Uses async HTTP client instead of direct session access
- Handles cookies, authentication headers, CSRF tokens
- Tests the full request/response cycle including middleware
"""
import time
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from unittest.mock import AsyncMock, patch
from typing import AsyncGenerator, Callable
from uuid import UUID
from uuid6 import uuid7

from app.main import app
from app.models import Organization, User, Subscription, RefreshToken
from app.core.db import get_session
from app.core.config import settings
from app.core.auth.tenant_dependencies import get_tenant_session
from app.core.auth.manager import UserManager
from app.core.auth.jwt import get_jwt_strategy
from app.core.auth.schemas import UserCreate
from app.core.auth.csrf_utils import create_csrf_token_with_timestamp
from app.core.auth.refresh_utils import generate_raw_refresh_token, hash_refresh_token, refresh_expiry
from datetime import datetime, timezone


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def integration_db_engine():
    """
    Creates a dedicated engine for integration tests.
    Each test gets isolated transactions via the session fixture.
    """
    engine = create_async_engine(settings.TEST_DATABASE_URL, echo=False)
    yield engine
    await engine.dispose()
    

@pytest.fixture(autouse=True)
def mock_background_alert_task():
    """Mock background task that creates alerts to avoid session conflicts warnings."""
    with patch(
        "app.routers.auth.org.create_team_member_alert_task",
        new_callable=AsyncMock
    ) as mock:
        yield mock


@pytest_asyncio.fixture
async def integration_session(integration_db_engine):
    """
    Provides an isolated async session with transaction rollback for integration tests.
    
    This allows test data to be visible to the API while still providing cleanup.
    We use a nested transaction (savepoint) pattern for isolation.
    """
    async with integration_db_engine.connect() as conn:
        trans = await conn.begin()
        
        session = AsyncSession(bind=conn, expire_on_commit=False)
        
        # Override the app's get_session dependency
        async def override_get_session():
            yield session
        
        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[get_tenant_session] = override_get_session
        
        yield session
        
        await session.close()
        await trans.rollback()
        
        # Clean up dependency override
        app.dependency_overrides.pop(get_session, None)


# =============================================================================
# HTTP Client Fixture
# =============================================================================

@pytest_asyncio.fixture
async def client(integration_session) -> AsyncGenerator[AsyncClient, None]:
    """
    Provides an async HTTP client for making requests to the test app.
    
    The client:
    - Uses the FastAPI app directly (no network overhead)
    - Persists cookies across requests within a test
    - Is isolated per test via the integration_session fixture
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        follow_redirects=True,
    ) as ac:
        yield ac
        

# =============================================================================
# Rate Limiting
# =============================================================================
        
@pytest.fixture(autouse=True)
def bypass_rate_limiting():
    """
    Automatically bypass rate limiting for all integration tests.
    
    Mocks the rate_limiter.is_allowed method to always return True,
    preventing any rate limit checks from blocking test requests.
    """
    with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
        # Configure mock to always allow requests
        mock_limiter.return_value = (
            True,  # allowed
            {
                "remaining": 999,
                "reset_time": time.time() + 3600,
            }
        )
        yield mock_limiter


# =============================================================================
# CSRF Helpers
# =============================================================================

@pytest.fixture
def csrf_token() -> str:
    """
    Generates a valid CSRF token for testing protected endpoints.
    
    Returns a properly signed token with current timestamp.
    """
    return create_csrf_token_with_timestamp()


@pytest.fixture
def csrf_headers(csrf_token: str) -> dict:
    """
    Returns headers dict with CSRF token for use in POST/PUT/PATCH/DELETE requests.
    """
    from app.core.config import settings
    return {settings.CSRF_HEADER_NAME: csrf_token}


# =============================================================================
# Test Organization Factory
# =============================================================================

@pytest_asyncio.fixture
async def create_test_org(integration_session) -> Callable:
    """
    Factory fixture to create test organizations with subscriptions.
    
    Returns an async function that creates orgs with sensible defaults.
    Organizations are automatically cleaned up via transaction rollback.
    """
    async def _create(
        name: str = "Test Organization",
        currency: str = "USD", 
        valuation_method: str = "FIFO",
    ) -> Organization:
        org = Organization(
            org_id=uuid7(),
            name=name,
            currency=currency,
            valuation_method=valuation_method,
        )
        integration_session.add(org)
        await integration_session.flush()
        
        # Create default subscription
        subscription = Subscription(org_id=org.org_id)
        integration_session.add(subscription)
        await integration_session.flush()
        
        return org
    
    return _create


# =============================================================================
# Test User Factory
# =============================================================================

@pytest_asyncio.fixture
async def create_test_user(integration_session) -> Callable:
    """
    Factory fixture to create test users.
    
    Uses the actual UserManager to ensure password hashing and other 
    user creation logic is consistent with production.
    
    Usage:
        user = await create_test_user(org, email="test@example.com")
        user = await create_test_user(org)  # Uses defaults
    """
    from fastapi_users.db import SQLAlchemyUserDatabase
    
    async def _create(
        org: Organization,
        email: str = None,
        password: str = "TestPassword123!",
        first_name: str = "Test",
        last_name: str = "User",
    ) -> User:
        # Generate unique email if not provided
        if email is None:
            email = f"test-{uuid7()}@example.com"
        
        user_db = SQLAlchemyUserDatabase(integration_session, User)
        user_manager = UserManager(user_db)
        
        user_create = UserCreate(
            email=email,
            password=password,
            org_id=org.org_id,
            first_name=first_name,
            last_name=last_name,
        )
        
        user = await user_manager.create(user_create, safe=True)
        await integration_session.flush()
        
        return user
    
    return _create


# =============================================================================
# Authentication Helpers
# =============================================================================

@pytest_asyncio.fixture
async def get_access_token() -> Callable:
    """
    Factory fixture to generate valid JWT access tokens for a user.
    
    This bypasses the login flow when you need to test authenticated 
    endpoints directly without testing login itself.
    """
    async def _get_token(user: User) -> str:
        jwt_strategy = get_jwt_strategy()
        return await jwt_strategy.write_token(user)
    
    return _get_token


@pytest_asyncio.fixture
async def auth_cookies(get_access_token, csrf_token) -> Callable:
    """
    Factory fixture to create cookie dict for authenticated requests.
    
    Returns cookies dict suitable for passing to client.cookies.update().
    """
    async def _get_cookies(user: User) -> dict:
        access_token = await get_access_token(user)
        from app.core.config import settings
        return {
            "access_token": access_token,
            settings.CSRF_COOKIE_NAME: csrf_token,
        }
    
    return _get_cookies


@pytest_asyncio.fixture
async def authenticated_client(
    client: AsyncClient,
    create_test_org,
    create_test_user,
    auth_cookies,
    csrf_token,
) -> AsyncGenerator[tuple[AsyncClient, User, Organization], None]:
    """
    Provides a pre-authenticated client with a test user and org.
    
    Useful for tests that need authentication but aren't testing auth itself.
    
    Returns:
        Tuple of (client, user, org) for use in tests
    """
    org = await create_test_org()
    user = await create_test_user(org)
    cookies = await auth_cookies(user)
    
    # Set cookies on client
    for name, value in cookies.items():
        client.cookies.set(name, value)
    
    yield client, user, org


# =============================================================================
# Refresh Token Helpers
# =============================================================================

@pytest_asyncio.fixture
async def create_refresh_token(integration_session) -> Callable:
    """
    Factory fixture to create refresh tokens in the database.
    
    Useful for testing refresh token rotation, revocation, and session management.
    """
    async def _create(
        user: User,
        revoked: bool = False,
        expired: bool = False,
        device_info: str = "Test Browser",
        ip_address: str = "127.0.0.1",
    ) -> tuple[str, RefreshToken]:
        """
        Creates a refresh token and returns both the raw token (for cookies)
        and the database record.
        """
        from datetime import timedelta
        
        raw_token = generate_raw_refresh_token()
        token_hash = hash_refresh_token(raw_token)
        now = datetime.now(timezone.utc)
        
        if expired:
            expires_at = now - timedelta(days=1)
        else:
            expires_at = refresh_expiry()
        
        db_token = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            created_at=now,
            last_used_at=now,
            expires_at=expires_at,
            revoked=1 if revoked else 0,
            device_info=device_info,
            ip_address=ip_address,
        )
        
        integration_session.add(db_token)
        await integration_session.flush()
        
        return raw_token, db_token
    
    return _create


# =============================================================================
# Email Mock Fixture
# =============================================================================

@pytest.fixture
def mock_send_invitation_email():
    """
    Mocks the invitation email sending function.
    
    Returns the mock so tests can verify it was called with correct arguments.
    """
    with patch(
        "app.routers.auth.org.send_invitation_email",
        new_callable=AsyncMock
    ) as mock:
        yield mock


@pytest.fixture  
def mock_validate_invitation_email():
    """
    Mocks invitation email validation to return the email unchanged.
    """
    with patch(
        "app.routers.auth.org.validate_invitation_email",
        side_effect=lambda email, inviter_email: email.lower()
    ) as mock:
        yield mock


# =============================================================================
# Invitation Token Helpers
# =============================================================================

@pytest.fixture
def create_invitation_token_for_test() -> Callable:
    """
    Factory fixture to create valid invitation tokens for testing.
    """
    from app.core.auth.invitations import create_invitation_token
    
    def _create(org: Organization, email: str) -> str:
        token, _ = create_invitation_token(org.org_id, org.name, email)
        return token
    
    return _create


# =============================================================================
# Database Query Helpers
# =============================================================================

@pytest_asyncio.fixture
async def get_user_by_email(integration_session) -> Callable:
    """
    Helper fixture to query users by email for verification in tests.
    """
    async def _get(email: str) -> User | None:
        result = await integration_session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    return _get


@pytest_asyncio.fixture
async def get_refresh_tokens_for_user(integration_session) -> Callable:
    """
    Helper fixture to query all refresh tokens for a user.
    """
    async def _get(user_id: UUID) -> list[RefreshToken]:
        result = await integration_session.execute(
            select(RefreshToken).where(RefreshToken.user_id == user_id)
        )
        return list(result.scalars().all())
    
    return _get
