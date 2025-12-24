"""
Conftest for rate limiter middleware tests.

Goals:
- Exercise real middleware stack
- Allow full control over rate limiter behavior
- Avoid DB, auth, background tasks, and global autouse mocks
"""

import pytest
import pytest_asyncio
import time
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch

from app.main import app


# ---------------------------------------------------------------------------
# HTTP client (real ASGI app, no DB/session overrides)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    """
    Minimal async client for middleware testing.

    - Uses real FastAPI app + middleware
    - Persists headers/cookies
    - No database or dependency overrides
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        follow_redirects=True,
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Rate limiter control fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_limiter_block():
    """
    Convenience fixture for blocked requests.
    """
    with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock:
        mock.return_value = (
            False,
            {
                "remaining": 0,
                "reset_time": time.time() + 60,
            },
        )
        yield mock
        