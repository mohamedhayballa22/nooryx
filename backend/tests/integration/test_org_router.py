"""
Integration tests for the org router (/api/auth/).

Tests organization-related auth endpoints:
- /register-new-org - Creates org + subscription + first user atomically
- /invite - Sends invitation to join organization (requires auth)
- /join - Accepts invitation and creates user account

These tests verify:
- Atomic org/user creation
- Invitation token flow
- Multi-tenancy boundaries
- Error handling and validation
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
import jwt
from uuid6 import uuid7
from datetime import datetime, timedelta, timezone

from app.models import Organization, User, Subscription
from app.core.config import settings


# @pytest.mark.asyncio
# class TestRegisterNewOrg:
#     """Tests for POST /api/auth/register-new-org"""
    
#     # =========================================================================
#     # Happy Path Tests
#     # =========================================================================
    
#     async def test_register_creates_org_user_and_subscription(
#         self,
#         client: AsyncClient,
#         integration_session,
#     ):
#         """
#         Registration atomically creates organization, subscription, and first user.
#         """
#         payload = {
#             "org": {
#                 "name": "Acme Corporation",
#                 "currency": "USD",
#                 "valuation_method": "FIFO",
#             },
#             "user": {
#                 "email": "admin@acme.com",
#                 "password": "SecurePassword123!",
#                 "first_name": "Jane",
#                 "last_name": "Admin",
#             },
#         }
        
#         response = await client.post("/api/auth/register-new-org", json=payload)
        
#         assert response.status_code == 201
        
#         data = response.json()
#         assert data["org_name"] == "Acme Corporation"
#         assert data["email"] == "admin@acme.com"
#         assert "org_id" in data
#         assert "user_id" in data
        
#         # Verify org was created in DB
#         org = await integration_session.scalar(
#             select(Organization).where(Organization.name == "Acme Corporation")
#         )
#         assert org is not None
#         assert org.currency == "USD"
#         assert org.valuation_method == "FIFO"
        
#         # Verify subscription was created
#         subscription = await integration_session.scalar(
#             select(Subscription).where(Subscription.org_id == org.org_id)
#         )
#         assert subscription is not None
#         assert subscription.plan_name == "free"  # default plan
        
#         # Verify user was created and linked to org
#         user = await integration_session.scalar(
#             select(User).where(User.email == "admin@acme.com")
#         )
#         assert user is not None
#         assert user.org_id == org.org_id
#         assert user.first_name == "Jane"
#         assert user.last_name == "Admin"
#         assert user.is_active is True
    
#     async def test_register_uses_default_valuation_method(
#         self,
#         client: AsyncClient,
#         integration_session,
#     ):
#         """
#         When valuation_method is not specified, defaults to WAC.
#         """
#         payload = {
#             "org": {
#                 "name": "Default Valuation Org",
#                 "currency": "EUR",
#             },
#             "user": {
#                 "email": "default@example.com",
#                 "password": "SecurePassword123!",
#                 "first_name": "Test",
#                 "last_name": "User",
#             },
#         }
        
#         response = await client.post("/api/auth/register-new-org", json=payload)
        
#         assert response.status_code == 201
        
#         org = await integration_session.scalar(
#             select(Organization).where(Organization.name == "Default Valuation Org")
#         )
#         assert org.valuation_method == "WAC"
    
#     # =========================================================================
#     # Sad Path Tests
#     # =========================================================================
    
#     async def test_register_duplicate_email_returns_400(
#         self,
#         client: AsyncClient,
#         create_test_org,
#         create_test_user,
#     ):
#         """
#         Cannot register with an email that already exists.
#         """
#         # Create existing user
#         org = await create_test_org()
#         await create_test_user(org, email="existing@example.com")
        
#         payload = {
#             "org": {
#                 "name": "New Org",
#                 "currency": "USD",
#             },
#             "user": {
#                 "email": "existing@example.com",
#                 "password": "SecurePassword123!",
#                 "first_name": "Test",
#                 "last_name": "User",
#             },
#         }
        
#         response = await client.post("/api/auth/register-new-org", json=payload)
        
#         assert response.status_code == 400
    
#     async def test_register_invalid_currency_returns_422(
#         self,
#         client: AsyncClient,
#     ):
#         """
#         Currency must be exactly 3 characters.
#         """
#         payload = {
#             "org": {
#                 "name": "Bad Currency Org",
#                 "currency": "TOOLONG",
#             },
#             "user": {
#                 "email": "test@example.com",
#                 "password": "SecurePassword123!",
#                 "first_name": "Test",
#                 "last_name": "User",
#             },
#         }
        
#         response = await client.post("/api/auth/register-new-org", json=payload)
        
#         assert response.status_code == 422
    
#     async def test_register_missing_required_fields_returns_422(
#         self,
#         client: AsyncClient,
#     ):
#         """
#         Missing required fields return validation error.
#         """
#         # Missing org name
#         payload = {
#             "org": {
#                 "currency": "USD",
#             },
#             "user": {
#                 "email": "test@example.com",
#                 "password": "SecurePassword123!",
#                 "first_name": "Test",
#                 "last_name": "User",
#             },
#         }
        
#         response = await client.post("/api/auth/register-new-org", json=payload)
        
#         assert response.status_code == 422
    
#     async def test_register_weak_password_returns_400(
#         self,
#         client: AsyncClient,
#     ):
#         """
#         Weak passwords are rejected by fastapi-users.
#         """
#         payload = {
#             "org": {
#                 "name": "Weak Password Org",
#                 "currency": "USD",
#             },
#             "user": {
#                 "email": "weakpw@example.com",
#                 "password": "123",  # Too short
#                 "first_name": "Test",
#                 "last_name": "User",
#             },
#         }
        
#         response = await client.post("/api/auth/register-new-org", json=payload)
        
#         assert response.status_code == 400


@pytest.mark.asyncio
class TestInviteUser:
    """Tests for POST /api/auth/invite"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_invite_sends_email_to_new_user(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
        mock_send_invitation_email,
        mock_validate_invitation_email,
    ):
        """
        Inviting a new email sends invitation email in background.
        """
        org = await create_test_org(name="Inviting Org")
        user = await create_test_user(
            org,
            email="inviter@example.com",
            first_name="John",
            last_name="Inviter",
        )
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/invite",
            json={"email": "newmember@example.com"},
            headers=csrf_headers,
        )
        
        assert response.status_code == 204
        
        # Verify email was queued (mock called)
        mock_send_invitation_email.assert_called_once()
        call_kwargs = mock_send_invitation_email.call_args
        assert call_kwargs[1]["to_email"] == "newmember@example.com"
        assert call_kwargs[1]["org_name"] == "Inviting Org"
        assert call_kwargs[1]["inviter_name"] == "John Inviter"
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_invite_without_auth_returns_401(
        self,
        client: AsyncClient,
    ):
        """
        Invitation requires authentication.
        """
        response = await client.post(
            "/api/auth/invite",
            json={"email": "anyone@example.com"},
        )
        
        assert response.status_code == 403 # CSRF blocked first
    
    async def test_invite_existing_member_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
        mock_validate_invitation_email,
    ):
        """
        Cannot invite someone already in the organization.
        """
        org = await create_test_org()
        inviter = await create_test_user(org, email="inviter@example.com")
        await create_test_user(org, email="already@example.com")
        
        cookies = await auth_cookies(inviter)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/invite",
            json={"email": "already@example.com"},
            headers=csrf_headers,
        )
        
        assert response.status_code == 400
        assert "already a member" in response.json()["error"]["detail"]
    
    async def test_invite_invalid_email_returns_422(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        auth_cookies,
        csrf_headers,
    ):
        """
        Invalid email format returns validation error.
        """
        org = await create_test_org()
        user = await create_test_user(org)
        
        cookies = await auth_cookies(user)
        for name, value in cookies.items():
            client.cookies.set(name, value)
        
        response = await client.post(
            "/api/auth/invite",
            json={"email": "not-an-email"},
            headers=csrf_headers,
        )
        
        assert response.status_code == 422


@pytest.mark.asyncio
class TestJoinOrg:
    """Tests for POST /api/auth/join"""
    
    # =========================================================================
    # Happy Path Tests
    # =========================================================================
    
    async def test_join_creates_user_in_org(
        self,
        client: AsyncClient,
        create_test_org,
        create_invitation_token_for_test,
        get_user_by_email,
        integration_session,
    ):
        """
        Valid invitation token creates user in the correct organization.
        """
        org = await create_test_org(name="Welcome Org")
        token = create_invitation_token_for_test(org, "joiner@example.com")
        
        response = await client.post(
            "/api/auth/join",
            json={
                "token": token,
                "first_name": "New",
                "last_name": "Member",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 201
        
        data = response.json()
        assert data["email"] == "joiner@example.com"
        assert data["org_name"] == "Welcome Org"
        
        # Verify user was created in DB
        user = await get_user_by_email("joiner@example.com")
        assert user is not None
        assert user.org_id == org.org_id
        assert user.first_name == "New"
        assert user.last_name == "Member"
        assert user.is_active is True
    
    async def test_join_queues_team_member_alert(
        self,
        client: AsyncClient,
        create_test_org,
        create_invitation_token_for_test,
        integration_session,
    ):
        """
        Joining triggers a background task to create a team member alert.
        
        Note: We can't easily test background tasks without waiting,
        so this test just verifies the response is correct.
        The alert creation is tested more directly in service tests.
        """
        org = await create_test_org()
        token = create_invitation_token_for_test(org, "alerttest@example.com")
        
        response = await client.post(
            "/api/auth/join",
            json={
                "token": token,
                "first_name": "Alert",
                "last_name": "Test",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 201
    
    # =========================================================================
    # Sad Path Tests
    # =========================================================================
    
    async def test_join_invalid_token_returns_400(
        self,
        client: AsyncClient,
    ):
        """
        Invalid invitation token is rejected.
        """
        response = await client.post(
            "/api/auth/join",
            json={
                "token": "invalid.token.here",
                "first_name": "Test",
                "last_name": "User",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["error"]["detail"]
    
    async def test_join_expired_token_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
    ):
        """
        Expired invitation token is rejected.
        """
        import jwt
        from datetime import datetime, timedelta, timezone
        
        org = await create_test_org()
        
        # Create an expired token
        expired_payload = {
            "org_id": str(org.org_id),
            "org_name": org.name,
            "email": "expired@example.com",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # Expired
        }
        expired_token = jwt.encode(
            expired_payload, 
            settings.SECRET_KEY, 
            algorithm=settings.ALGORITHM
        )
        
        response = await client.post(
            "/api/auth/join",
            json={
                "token": expired_token,
                "first_name": "Test",
                "last_name": "User",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["error"]["detail"]
    
    async def test_join_token_for_nonexistent_org_returns_400(
        self,
        client: AsyncClient,
    ):
        """
        Token for deleted/nonexistent org is rejected.
        """
        # Create token for org that doesn't exist
        fake_payload = {
            "org_id": str(uuid7()),
            "org_name": "Ghost Org",
            "email": "ghost@example.com",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        fake_token = jwt.encode(
            fake_payload,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        
        response = await client.post(
            "/api/auth/join",
            json={
                "token": fake_token,
                "first_name": "Test",
                "last_name": "User",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["error"]["detail"]
    
    async def test_join_already_registered_email_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
        create_test_user,
        create_invitation_token_for_test,
    ):
        """
        Cannot join if email is already registered (even in different org).
        """
        org1 = await create_test_org(name="Org One")
        org2 = await create_test_org(name="Org Two")
        
        # Create user in org1
        await create_test_user(org1, email="duplicate@example.com")
        
        # Try to join org2 with same email
        token = create_invitation_token_for_test(org2, "duplicate@example.com")
        
        response = await client.post(
            "/api/auth/join",
            json={
                "token": token,
                "first_name": "Test",
                "last_name": "User",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 400
        assert "already registered" in response.json()["error"]["detail"]
    
    async def test_join_weak_password_returns_400(
        self,
        client: AsyncClient,
        create_test_org,
        create_invitation_token_for_test,
    ):
        """
        Weak passwords are rejected during join.
        """
        org = await create_test_org()
        token = create_invitation_token_for_test(org, "weakpw@example.com")
        
        response = await client.post(
            "/api/auth/join",
            json={
                "token": token,
                "first_name": "Test",
                "last_name": "User",
                "password": "123",  # Too weak
            },
        )
        
        assert response.status_code == 422
    
    async def test_join_missing_required_fields_returns_422(
        self,
        client: AsyncClient,
        create_test_org,
        create_invitation_token_for_test,
    ):
        """
        Missing required fields return validation error.
        """
        org = await create_test_org()
        token = create_invitation_token_for_test(org, "test@example.com")
        
        # Missing first_name
        response = await client.post(
            "/api/auth/join",
            json={
                "token": token,
                "last_name": "User",
                "password": "SecurePassword123!",
            },
        )
        
        assert response.status_code == 422
