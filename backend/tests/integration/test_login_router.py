"""
Integration tests for the login router (/api/auth/jwt).

Tests the login endpoint which authenticates users and issues:
- HTTP-only access token cookie
- CSRF token cookie (when enabled)

These tests verify the full authentication flow including:
- Credential validation
- Cookie setting behavior
- Response format
- Error handling
"""
import pytest
from httpx import AsyncClient

from app.models import User, Organization
from app.core.config import settings


@pytest.mark.asyncio
class TestLogin:
    """Tests for POST /api/auth/jwt/login"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_login_success_returns_user_info(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
    ):
        """
        Successful login returns user information in response body.
        """
        org = await create_test_org()
        user = await create_test_user(
            org,
            email="login@example.com",
            password="SecurePassword123!",
            first_name="John",
            last_name="Doe",
        )
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "login@example.com",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == "login@example.com"
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"
    
    async def test_login_sets_access_token_cookie(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
    ):
        """
        Successful login sets an HTTP-only access token cookie.
        """
        org = await create_test_org()
        await create_test_user(
            org, 
            email="cookie@example.com",
            password="SecurePassword123!",
        )
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "cookie@example.com",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 200
        
        # Verify access token cookie is set
        assert "access_token" in response.cookies
        access_token = response.cookies.get("access_token")
        assert access_token is not None
        assert len(access_token) > 50  # JWT tokens are typically > 100 chars
    
    async def test_login_sets_csrf_token_cookie_when_enabled(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        monkeypatch,
    ):
        """
        When CSRF is enabled, login sets a CSRF token cookie that is 
        readable by JavaScript (not HTTP-only).
        """
        # Ensure CSRF is enabled for this test
        monkeypatch.setattr(settings, "CSRF_ENABLED", True)
        
        org = await create_test_org()
        await create_test_user(
            org,
            email="csrf@example.com", 
            password="SecurePassword123!",
        )
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "csrf@example.com",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 200
        
        # Verify CSRF token cookie is set
        csrf_cookie = response.cookies.get(settings.CSRF_COOKIE_NAME)
        assert csrf_cookie is not None
        
        # CSRF token format: token:timestamp:signature
        parts = csrf_cookie.split(":")
        assert len(parts) == 3
    
    async def test_login_does_not_set_csrf_when_disabled(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        monkeypatch,
    ):
        """
        When CSRF is disabled, login does not set a CSRF token cookie.
        """
        monkeypatch.setattr(settings, "CSRF_ENABLED", False)
        
        org = await create_test_org()
        await create_test_user(
            org,
            email="nocsrf@example.com",
            password="SecurePassword123!",
        )
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "nocsrf@example.com",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 200
        
        # CSRF cookie should not be set
        csrf_cookie = response.cookies.get(settings.CSRF_COOKIE_NAME)
        assert csrf_cookie is None
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_login_wrong_password_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
    ):
        """
        Login with incorrect password returns 400 with appropriate error.
        """
        org = await create_test_org()
        await create_test_user(
            org,
            email="wrongpass@example.com",
            password="CorrectPassword123!",
        )
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "wrongpass@example.com",
                "password": "WrongPassword456!",
            },
        )
        
        assert response.status_code == 400
        assert response.json()["error"]["detail"] == "LOGIN_BAD_CREDENTIALS"
        
        # Should not set any auth cookies
        assert "access_token" not in response.cookies
    
    async def test_login_nonexistent_user_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
    ):
        """
        Login with email that doesn't exist returns 400.
        
        Uses same error message as wrong password to prevent enumeration.
        """
        await create_test_org()  # Ensure DB is set up
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "nonexistent@example.com",
                "password": "SomePassword123!",
            },
        )
        
        assert response.status_code == 400
        assert response.json()["error"]["detail"] == "LOGIN_BAD_CREDENTIALS"
    
    async def test_login_inactive_user_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        integration_session,
    ):
        """
        Inactive users cannot log in even with correct credentials.
        """
        from sqlalchemy import update
        
        org = await create_test_org()
        user = await create_test_user(
            org,
            email="inactive@example.com",
            password="SecurePassword123!",
        )
        
        # Deactivate the user
        await integration_session.execute(
            update(User).where(User.id == user.id).values(is_active=False)
        )
        await integration_session.flush()
        
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "inactive@example.com",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 400
        assert response.json()["error"]["detail"] == "LOGIN_BAD_CREDENTIALS"
    
    # =========================================================================
    # Edge Cases
    # =========================================================================
    
    async def test_login_email_is_case_insensitive(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
    ):
        """
        Email matching should be case-insensitive.
        """
        org = await create_test_org()
        await create_test_user(
            org,
            email="CaseTest@Example.com",
            password="SecurePassword123!",
        )
        
        # Try logging in with different case
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "casetest@example.com",  # lowercase
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 200
        assert response.json()["email"].lower() == "casetest@example.com"
    
    async def test_login_password_is_case_sensitive(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
    ):
        """
        Password matching must be case-sensitive.
        """
        org = await create_test_org()
        await create_test_user(
            org,
            email="pwcase@example.com",
            password="SecurePassword123!",
        )
        
        # Try with wrong case password
        response = await client.post(
            "/api/auth/jwt/login",
            data={
                "username": "pwcase@example.com",
                "password": "securepassword123!",  # wrong case
            },
        )
        
        assert response.status_code == 400
    
    async def test_login_missing_username_returns_422(
        self,
        client: AsyncClient,
    ):
        """
        Request missing username field returns validation error.
        """
        response = await client.post(
            "/api/auth/jwt/login",
            data={"password": "SomePassword123!"},
        )
        
        assert response.status_code == 422
    
    async def test_login_missing_password_returns_422(
        self,
        client: AsyncClient,
    ):
        """
        Request missing password field returns validation error.
        """
        response = await client.post(
            "/api/auth/jwt/login",
            data={"username": "test@example.com"},
        )
        
        assert response.status_code == 422
    
    async def test_login_empty_credentials_returns_422(
        self,
        client: AsyncClient,
    ):
        """
        Empty credentials return validation error.
        """
        response = await client.post(
            "/api/auth/jwt/login",
            data={"username": "", "password": ""},
        )
        
        # OAuth2PasswordRequestForm requires non-empty values
        assert response.status_code in (400, 422)
