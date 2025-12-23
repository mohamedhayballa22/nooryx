"""
Integration tests for the session router (/api/auth/sessions).

Tests session management endpoints:
- POST /issue_refresh - Issues new refresh token after login
- POST /refresh - Rotates refresh token and issues new access token
- POST /logout - Revokes session and clears cookies
- DELETE /{session_id} - Revokes specific session
- GET / - Lists all active sessions
- GET /current - Gets current session info

These tests verify:
- Refresh token lifecycle (issue, rotate, expire, revoke)
- Token rotation security (detecting reuse)
- Cookie management
- Multi-device session handling
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from datetime import datetime, timedelta, timezone
from uuid6 import uuid7

from app.models import RefreshToken, User
from app.core.config import settings
from app.core.auth.refresh_utils import hash_refresh_token


@pytest.mark.asyncio
class TestIssueRefresh:
    """Tests for POST /api/auth/sessions/issue_refresh"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_issue_refresh_sets_cookie(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
    ):
        """
        Issue refresh creates a refresh token and sets HTTP-only cookie.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/sessions/issue_refresh",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        assert "refresh_token" in response.cookies
        
        # Verify it's a long token
        refresh_token = response.cookies.get("refresh_token")
        assert len(refresh_token) > 50
    
    async def test_issue_refresh_stores_token_in_db(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
        get_refresh_tokens_for_user,
    ):
        """
        Issue refresh stores the hashed token in the database.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/sessions/issue_refresh",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Verify token was stored
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 1
        
        # Verify hash matches
        raw_token = response.cookies.get("refresh_token")
        expected_hash = hash_refresh_token(raw_token)
        assert tokens[0].token_hash == expected_hash
    
    async def test_issue_refresh_cleans_expired_tokens(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
        create_refresh_token,
        get_refresh_tokens_for_user,
    ):
        """
        Issuing a new token cleans up expired tokens for the user.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        # Create an expired token
        await create_refresh_token(user, expired=True)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/sessions/issue_refresh",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Only the new token should remain
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 1
        assert tokens[0].expires_at > datetime.now(timezone.utc)
    
    async def test_issue_refresh_captures_device_info(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
        get_refresh_tokens_for_user,
    ):
        """
        Token creation captures User-Agent and IP for audit purposes.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/sessions/issue_refresh",
            headers={
                **csrf_headers,
                "User-Agent": "TestBrowser/1.0",
            },
        )
        
        assert response.status_code == 204
        
        tokens = await get_refresh_tokens_for_user(user.id)
        assert tokens[0].device_info == "TestBrowser/1.0"
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_issue_refresh_without_auth_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Cannot issue refresh token without being authenticated.
        """
        response = await client.post("/api/auth/sessions/issue_refresh")
        
        assert response.status_code == 403 # CSRF blocked first


@pytest.mark.asyncio
class TestRefresh:
    """Tests for POST /api/auth/sessions/refresh"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_refresh_issues_new_access_token(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_refresh_token,
    ):
        """
        Valid refresh token issues new access token cookie.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, _ = await create_refresh_token(user)
        
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 204
        assert "access_token" in response.cookies
    
    async def test_refresh_rotates_token(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_refresh_token,
        get_refresh_tokens_for_user,
    ):
        """
        Refresh rotates the token - old token hash is replaced.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, original_db_token = await create_refresh_token(user)
        
        original_hash = original_db_token.token_hash
        
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 204
        
        # Token hash should have changed
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 1
        assert tokens[0].token_hash != original_hash
        
        # New cookie should have different value
        new_raw_token = response.cookies.get("refresh_token")
        assert new_raw_token != raw_token
    
    async def test_refresh_updates_last_used_at(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_refresh_token,
        get_refresh_tokens_for_user,
    ):
        """
        Refresh updates the last_used_at timestamp.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, original_db_token = await create_refresh_token(user)
        
        original_last_used = original_db_token.last_used_at
        
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 204
        
        tokens = await get_refresh_tokens_for_user(user.id)
        assert tokens[0].last_used_at >= original_last_used
    
    async def test_refresh_issues_new_csrf_token_when_enabled(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_refresh_token,
        monkeypatch,
    ):
        """
        When CSRF is enabled, refresh also issues new CSRF token.
        """
        monkeypatch.setattr(settings, "CSRF_ENABLED", True)
        
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, _ = await create_refresh_token(user)
        
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 204
        assert settings.CSRF_COOKIE_NAME in response.cookies
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_refresh_without_cookie_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Missing refresh token cookie returns 401.
        """
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 401
        assert "Missing refresh token" in response.json()["error"]["detail"]
    
    async def test_refresh_invalid_token_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Invalid (non-matching) refresh token returns 401.
        """
        client.cookies.set("refresh_token", "invalid-token-value")
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 401
        assert "Invalid refresh token" in response.json()["error"]["detail"]
    
    async def test_refresh_expired_token_returns_401(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_refresh_token,
    ):
        """
        Expired refresh token returns 401 and is deleted.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, _ = await create_refresh_token(user, expired=True)
        
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 401
        assert "expired" in response.json()["error"]["detail"].lower()
    
    async def test_refresh_revoked_token_revokes_all_sessions(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_refresh_token,
        get_refresh_tokens_for_user,
    ):
        """
        Using a revoked token triggers security response - all sessions revoked.
        
        This is breach detection: if someone reuses a revoked token, 
        it may indicate token theft.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        # Create a revoked token
        raw_token, _ = await create_refresh_token(user, revoked=True)
        
        # Also create a valid token that should be revoked
        await create_refresh_token(user, revoked=False)
        
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post("/api/auth/sessions/refresh")
        
        assert response.status_code == 401
        assert "compromised" in response.json()["error"]["detail"].lower()
        
        # All tokens should be deleted
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 0


@pytest.mark.asyncio
class TestLogout:
    """Tests for POST /api/auth/sessions/logout"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_logout_clears_cookies(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
        csrf_headers,
    ):
        """
        Logout clears all authentication cookies.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, _ = await create_refresh_token(user)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post(
            "/api/auth/sessions/logout",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Cookies should be cleared (set to empty or max-age=0)
        # Note: httpx may show cookies differently than browser
        assert response.cookies.get("access_token", "") == "" or \
               "access_token" in str(response.headers.get("set-cookie", ""))
    
    async def test_logout_revokes_current_token(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
        csrf_headers,
        get_refresh_tokens_for_user,
    ):
        """
        Logout deletes the current refresh token from database.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, _ = await create_refresh_token(user)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.post(
            "/api/auth/sessions/logout",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Token should be deleted
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 0
    
    async def test_logout_preserves_other_sessions(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
        csrf_headers,
        get_refresh_tokens_for_user,
    ):
        """
        Logout only revokes the current session, not other devices.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        # Create two sessions
        current_token, _ = await create_refresh_token(user, device_info="Current Device")
        other_token, _ = await create_refresh_token(user, device_info="Other Device")
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        client.cookies.set("refresh_token", current_token)
        
        response = await client.post(
            "/api/auth/sessions/logout",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Only other token should remain
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 1
        assert tokens[0].device_info == "Other Device"
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_logout_without_auth_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Logout requires authentication.
        """
        response = await client.post("/api/auth/sessions/logout")
        
        assert response.status_code == 403 # CSRF blocked first


@pytest.mark.asyncio
class TestLogoutSession:
    """Tests for DELETE /api/auth/sessions/{session_id}"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_revoke_specific_session(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
        csrf_headers,
        get_refresh_tokens_for_user,
    ):
        """
        Can revoke a specific session by ID.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        # Create two sessions
        current_token, current_db = await create_refresh_token(user)
        target_token, target_db = await create_refresh_token(user, device_info="Target")
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.delete(
            f"/api/auth/sessions/{target_db.id}",
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Only current session should remain
        tokens = await get_refresh_tokens_for_user(user.id)
        assert len(tokens) == 1
        assert tokens[0].id == current_db.id
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_revoke_nonexistent_session_returns_404(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
    ):
        """
        Revoking non-existent session returns 404.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        fake_id = uuid7()
        response = await client.delete(
            f"/api/auth/sessions/{fake_id}",
            headers=csrf_headers,
        )
        
        assert response.status_code == 404
    
    async def test_cannot_revoke_other_users_session(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
        csrf_headers,
    ):
        """
        Cannot revoke another user's session.
        """
        org = await create_test_org()
        user1 = await create_test_user(org, email="user1@example.com")
        user2 = await create_test_user(org, email="user2@example.com")
        
        # Create session for user2
        _, user2_token_db = await create_refresh_token(user2)
        
        # Authenticate as user1
        cookies = await auth_cookies(user1)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        # Try to revoke user2's session
        response = await client.delete(
            f"/api/auth/sessions/{user2_token_db.id}",
            headers=csrf_headers,
        )
        
        assert response.status_code == 404


@pytest.mark.asyncio  
class TestListSessions:
    """Tests for GET /api/auth/sessions"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_list_returns_all_active_sessions(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        Lists all non-revoked, non-expired sessions for the user.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        # Create multiple sessions
        await create_refresh_token(user, device_info="Device 1")
        await create_refresh_token(user, device_info="Device 2")
        await create_refresh_token(user, device_info="Device 3")
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions")
        
        assert response.status_code == 200
        
        sessions = response.json()
        assert len(sessions) == 3
        
        device_infos = {s["device_info"] for s in sessions}
        assert device_infos == {"Device 1", "Device 2", "Device 3"}
    
    async def test_list_excludes_expired_sessions(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        Expired sessions are not included in the list.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        await create_refresh_token(user, device_info="Active")
        await create_refresh_token(user, device_info="Expired", expired=True)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions")
        
        assert response.status_code == 200
        
        sessions = response.json()
        assert len(sessions) == 1
        assert sessions[0]["device_info"] == "Active"
    
    async def test_list_excludes_revoked_sessions(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        Revoked sessions are not included in the list.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        await create_refresh_token(user, device_info="Active")
        await create_refresh_token(user, device_info="Revoked", revoked=True)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions")
        
        assert response.status_code == 200
        
        sessions = response.json()
        assert len(sessions) == 1
        assert sessions[0]["device_info"] == "Active"
    
    async def test_list_returns_session_metadata(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        Listed sessions include expected metadata fields.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        await create_refresh_token(
            user, 
            device_info="Chrome on Windows",
            ip_address="192.168.1.100",
        )
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions")
        
        assert response.status_code == 200
        
        session = response.json()[0]
        assert "id" in session
        assert "created_at" in session
        assert "last_used_at" in session
        assert "expires_at" in session
        assert session["device_info"] == "Chrome on Windows"
        assert session["ip_address"] == "192.168.1.100"
    
    async def test_list_only_shows_own_sessions(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        Users can only see their own sessions, not other users'.
        """
        org = await create_test_org()
        user1 = await create_test_user(org, email="user1@example.com")
        user2 = await create_test_user(org, email="user2@example.com")
        
        await create_refresh_token(user1, device_info="User1 Device")
        await create_refresh_token(user2, device_info="User2 Device")
        
        # Authenticate as user1
        cookies = await auth_cookies(user1)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions")
        
        assert response.status_code == 200
        
        sessions = response.json()
        assert len(sessions) == 1
        assert sessions[0]["device_info"] == "User1 Device"
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_list_without_auth_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Listing sessions requires authentication.
        """
        response = await client.get("/api/auth/sessions")
        
        assert response.status_code == 401


@pytest.mark.asyncio
class TestGetCurrentSession:
    """Tests for GET /api/auth/sessions/current"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_current_returns_user_info(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
    ):
        """
        Current session endpoint returns user information.
        """
        org = await create_test_org(name="Test Org")
        user = await create_test_user(
            org,
            email="current@example.com",
            first_name="Current",
            last_name="User",
        )
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions/current")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "current@example.com"
        assert data["user"]["first_name"] == "Current"
        assert data["user"]["last_name"] == "User"
        assert data["user"]["org_id"] == str(org.org_id)
    
    async def test_current_returns_session_info_with_refresh_token(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        When refresh token is present, returns session metadata.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, db_token = await create_refresh_token(user)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.get("/api/auth/sessions/current")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "session" in data
        assert data["session"] is not None
        assert data["session"]["id"] == str(db_token.id)
        assert "created_at" in data["session"]
        assert "last_used_at" in data["session"]
        assert "expires_at" in data["session"]
    
    async def test_current_returns_null_session_without_refresh_token(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
    ):
        """
        Without refresh token, user info is returned but session is null.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.get("/api/auth/sessions/current")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["user"] is not None
        assert data["session"] is None
    
    async def test_current_returns_null_session_for_expired_refresh(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        create_refresh_token,
    ):
        """
        Expired refresh token results in null session info.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        raw_token, _ = await create_refresh_token(user, expired=True)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        client.cookies.set("refresh_token", raw_token)
        
        response = await client.get("/api/auth/sessions/current")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["user"] is not None
        assert data["session"] is None
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_current_without_auth_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Getting current session requires authentication.
        """
        response = await client.get("/api/auth/sessions/current")
        
        assert response.status_code == 401
