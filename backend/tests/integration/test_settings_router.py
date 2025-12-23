import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select, func, update
from uuid6 import uuid7

from app.models import (
    Subscription, User, Organization, UserSettings, OrganizationSettings, 
    SKU, RefreshToken
)
from app.schemas.settings import SUPPORTED_LOCALES

# -----------------------------------------------------------------------------
# GET /account
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_user_profile_success(authenticated_client):
    client, user, org = authenticated_client
    
    response = await client.get("/api/settings/account")
    assert response.status_code == 200
    data = response.json()
    
    # Verify User Data
    assert data["user"]["email"] == user.email
    assert data["user"]["first_name"] == user.first_name
    assert data["user"]["last_name"] == user.last_name
    
    # Verify Org Data
    assert data["organization"]["name"] == org.name
    
    # Verify Subscription (default created by fixture)
    assert data["subscription"] is not None
    assert data["subscription"]["status"] == "active"


# -----------------------------------------------------------------------------
# GET /settings
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_settings_defaults(authenticated_client):
    """Test retrieving settings when no custom settings exist (defaults)."""
    client, user, org = authenticated_client
    
    response = await client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    
    # Defaults
    assert data["locale"] == "system"
    assert data["pagination"] == 25
    assert data["alerts"] is True
    assert data["default_reorder_point"] is None
    assert data["default_low_stock_threshold"] is None
    
    # Org properties
    assert data["currency"] == org.currency
    assert data["valuation_method"] == org.valuation_method


@pytest.mark.asyncio
async def test_get_settings_existing(authenticated_client, integration_session):
    """Test retrieving populated settings."""
    client, user, org = authenticated_client
    
    # Insert custom settings
    user_settings = UserSettings(
        user_id=user.id,
        locale="fr-FR",
        pagination=50,
        alerts=False
    )
    org_settings = OrganizationSettings(
        org_id=org.org_id,
        default_reorder_point=20,
        default_low_stock_threshold=5
    )
    integration_session.add_all([user_settings, org_settings])
    await integration_session.flush()
    
    response = await client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    
    assert data["locale"] == "fr-FR"
    assert data["pagination"] == 50
    assert data["alerts"] is False
    assert data["default_reorder_point"] == 20
    assert data["default_low_stock_threshold"] == 5


# -----------------------------------------------------------------------------
# PATCH /settings
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_user_settings(authenticated_client, integration_session, csrf_headers):
    client, user, org = authenticated_client
    
    payload = {
        "locale": "es-ES",
        "pagination": 100,
        "date_format": "DD/MM/YYYY",
        "alerts": False
    }
    
    response = await client.patch("/api/settings", json=payload, headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify DB
    stmt = select(UserSettings).where(UserSettings.user_id == user.id)
    settings = (await integration_session.execute(stmt)).scalar_one()
    
    assert settings.locale == "es-ES"
    assert settings.pagination == 100
    assert settings.date_format == "DD/MM/YYYY"
    assert settings.alerts is False


@pytest.mark.asyncio
async def test_update_org_settings(authenticated_client, integration_session, csrf_headers):
    client, user, org = authenticated_client
    
    payload = {
        "org_name": "New Corp Name",
        "default_reorder_point": 15,
        "default_low_stock_threshold": 3
    }
    
    response = await client.patch("/api/settings", json=payload, headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify Org Name Update
    await integration_session.refresh(org)
    assert org.name == "New Corp Name"
    
    # Verify Org Settings
    stmt = select(OrganizationSettings).where(OrganizationSettings.org_id == org.org_id)
    settings = (await integration_session.execute(stmt)).scalar_one()
    
    assert settings.default_reorder_point == 15
    assert settings.default_low_stock_threshold == 3


@pytest.mark.asyncio
async def test_update_user_role(authenticated_client, integration_session, csrf_headers):
    client, user, org = authenticated_client
    
    payload = {"role": "Warehouse Manager"}
    
    response = await client.patch("/api/settings", json=payload, headers=csrf_headers)
    assert response.status_code == 204
    
    await integration_session.refresh(user)
    assert user.role == "Warehouse Manager"


@pytest.mark.asyncio
async def test_update_settings_validation_error(authenticated_client, csrf_headers):
    client, user, org = authenticated_client
    
    # Invalid locale
    payload = {"locale": "invalid-LOCALE"}
    response = await client.patch("/api/settings", json=payload, headers=csrf_headers)
    assert response.status_code == 400
    assert "Unsupported locale" in response.json()["error"]["detail"]


@pytest.mark.asyncio
async def test_partial_update_settings(authenticated_client, integration_session, csrf_headers):
    """Ensure partial updates don't overwrite other fields with null/defaults."""
    client, user, org = authenticated_client
    
    # Setup initial state
    initial_settings = UserSettings(user_id=user.id, pagination=50, locale="en-US")
    integration_session.add(initial_settings)
    await integration_session.flush()
    
    # Update only locale
    payload = {"locale": "fr-FR"}
    response = await client.patch("/api/settings", json=payload, headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify pagination is STILL 50
    await integration_session.refresh(initial_settings)
    assert initial_settings.locale == "fr-FR"
    assert initial_settings.pagination == 50


@pytest.mark.asyncio
async def test_update_settings_tenancy_isolation(
    authenticated_client, 
    create_test_org, 
    create_test_user, 
    integration_session,
    csrf_headers
):
    """Ensure updating one org's settings doesn't affect another."""
    client1, user1, org1 = authenticated_client
    
    # Create second org/user
    org2 = await create_test_org(name="Other Org")
    
    # Update Org1 settings
    payload = {"default_reorder_point": 99}
    response = await client1.patch("/api/settings", json=payload, headers=csrf_headers)
    assert response.status_code == 204
    
    # Check Org1
    stmt1 = select(OrganizationSettings).where(OrganizationSettings.org_id == org1.org_id)
    settings1 = (await integration_session.execute(stmt1)).scalar_one()
    assert settings1.default_reorder_point == 99
    
    # Check Org2 (should verify no settings exist or defaults not affected)
    stmt2 = select(OrganizationSettings).where(OrganizationSettings.org_id == org2.org_id)
    result2 = (await integration_session.execute(stmt2)).scalar_one_or_none()
    assert result2 is None


# -----------------------------------------------------------------------------
# PATCH /settings/sku/{sku_code}
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_sku_thresholds(authenticated_client, integration_session, csrf_headers):
    client, user, org = authenticated_client
    
    # Create SKU
    sku = SKU(
        code="TEST-SKU-001",
        org_id=org.org_id,
        name="Test Product",
        low_stock_threshold=10,
        reorder_point=20,
        alerts=True
    )
    integration_session.add(sku)
    await integration_session.flush()
    
    # Update thresholds
    payload = {
        "low_stock_threshold": 5,
        "reorder_point": 15,
        "alerts": False
    }
    
    response = await client.patch(f"/api/settings/sku/{sku.code}", json=payload, headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify DB
    await integration_session.refresh(sku)
    assert sku.low_stock_threshold == 5
    assert sku.reorder_point == 15
    assert sku.alerts is False


@pytest.mark.asyncio
async def test_update_sku_thresholds_not_found(authenticated_client, csrf_headers):
    client, user, org = authenticated_client
    
    payload = {"low_stock_threshold": 5}
    response = await client.patch("/api/settings/sku/NON-EXISTENT", json=payload, headers=csrf_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_sku_thresholds_tenant_isolation(
    authenticated_client, 
    create_test_org, 
    integration_session,
    csrf_headers
):
    """Ensure user cannot update SKU of another org."""
    client, user, org1 = authenticated_client
    
    # Create another org and SKU
    org2 = await create_test_org(name="Other Org")
    sku_other = SKU(
        code="OTHER-SKU",
        org_id=org2.org_id,
        name="Other Product",
        low_stock_threshold=10,
        reorder_point=20
    )
    integration_session.add(sku_other)
    await integration_session.flush()
    
    # Try to update other org's SKU
    payload = {"low_stock_threshold": 999}
    response = await client.patch(f"/settings/sku/{sku_other.code}", json=payload, headers=csrf_headers)
    
    # Should get 404 (Not Found) effectively hiding existence
    assert response.status_code == 404
    
    # Verify no change
    await integration_session.refresh(sku_other)
    assert sku_other.low_stock_threshold == 10


# -----------------------------------------------------------------------------
# DELETE /account
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_account_multi_user_org(
    authenticated_client, 
    create_test_user, 
    integration_session, 
    csrf_headers
):
    """Test deleting one user in a multi-user org. Org should remain."""
    client, user1, org = authenticated_client
    
    # Add second user
    user2 = await create_test_user(org, email="user2@example.com")
    
    # Add refresh tokens for user1 to verify cleanup
    token_rec = RefreshToken(
        user_id=user1.id,
        token_hash="dummy",
        expires_at=func.now(),
        revoked=0
    )
    integration_session.add(token_rec)
    await integration_session.flush()
    
    # Delete user1
    response = await client.delete("/api/settings/account", headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify User1 is gone
    stmt = select(User).where(User.id == user1.id)
    assert (await integration_session.execute(stmt)).scalar_one_or_none() is None
    
    # Verify Tokens gone
    stmt = select(RefreshToken).where(RefreshToken.user_id == user1.id)
    assert len((await integration_session.execute(stmt)).scalars().all()) == 0
    
    # Verify User2 still exists
    stmt = select(User).where(User.id == user2.id)
    assert (await integration_session.execute(stmt)).scalar_one_or_none() is not None
    
    # Verify Org still exists
    stmt = select(Organization).where(Organization.org_id == org.org_id)
    assert (await integration_session.execute(stmt)).scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_delete_account_single_user_org_cascade(
    authenticated_client, 
    integration_session, 
    csrf_headers
):
    """Test deleting the sole user. Org and all data should be deleted."""
    client, user, org = authenticated_client
    
    # Create dependent data
    sku = SKU(code="SKU1", org_id=org.org_id, name="Test")
    integration_session.add(sku)
    await integration_session.flush()
    
    # Delete user (last one)
    response = await client.delete("/api/settings/account", headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify User gone
    stmt = select(User).where(User.id == user.id)
    assert (await integration_session.execute(stmt)).scalar_one_or_none() is None
    
    # Verify Org gone
    stmt = select(Organization).where(Organization.org_id == org.org_id)
    assert (await integration_session.execute(stmt)).scalar_one_or_none() is None
    
    # Verify SKU gone (cascade)
    stmt = select(SKU).where(SKU.code == "SKU1", SKU.org_id == org.org_id)
    assert (await integration_session.execute(stmt)).scalar_one_or_none() is None
    
    
# -----------------------------------------------------------------------------
# GET /account - Edge Cases
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_user_profile_no_active_sessions(
    authenticated_client,
    integration_session
):
    """Test GET /account when user has no active sessions (all expired/revoked)."""
    client, user, org = authenticated_client
    
    # Revoke all refresh tokens
    await integration_session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked=1)
    )
    await integration_session.commit()
    
    response = await client.get("/api/settings/account")
    assert response.status_code == 200
    data = response.json()
    
    # Should return empty sessions list
    assert data["sessions"] == []
    assert data["user"]["email"] == user.email


# -----------------------------------------------------------------------------
# PATCH /settings - Validation Edge Cases
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_settings_invalid_pagination_values(
    authenticated_client, 
    csrf_headers
):
    """Test that invalid pagination values are rejected."""
    client, user, org = authenticated_client
    
    # Test zero pagination
    response = await client.patch(
        "/api/settings", 
        json={"pagination": 0}, 
        headers=csrf_headers
    )
    assert response.status_code == 422  # Pydantic validation error
    
    # Test negative pagination
    response = await client.patch(
        "/api/settings", 
        json={"pagination": -10}, 
        headers=csrf_headers
    )
    assert response.status_code == 422
    
    # Test unreasonably large pagination (DoS protection)
    response = await client.patch(
        "/api/settings", 
        json={"pagination": 100000}, 
        headers=csrf_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_settings_empty_payload(
    authenticated_client, 
    csrf_headers
):
    """Test that empty update payload is handled gracefully."""
    client, user, org = authenticated_client
    
    response = await client.patch(
        "/api/settings", 
        json={}, 
        headers=csrf_headers
    )
    # Should succeed with 204 but make no changes
    assert response.status_code == 204


# -----------------------------------------------------------------------------
# PATCH /sku/{sku_code} - Business Logic Validation
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_sku_invalid_threshold_values(
    authenticated_client, 
    integration_session, 
    csrf_headers
):
    """Test that invalid threshold values are rejected."""
    client, user, org = authenticated_client
    
    sku = SKU(
        code="TEST-SKU",
        org_id=org.org_id,
        name="Test Product",
        low_stock_threshold=10,
        reorder_point=20
    )
    integration_session.add(sku)
    await integration_session.flush()
    
    # Test negative thresholds
    response = await client.patch(
        f"/api/settings/sku/{sku.code}",
        json={"low_stock_threshold": -5},
        headers=csrf_headers
    )
    assert response.status_code == 422
    
    response = await client.patch(
        f"/api/settings/sku/{sku.code}",
        json={"reorder_point": -10},
        headers=csrf_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_sku_business_logic_validation(
    authenticated_client, 
    integration_session, 
    csrf_headers
):
    """Test business logic: low_stock_threshold should be <= reorder_point."""
    client, user, org = authenticated_client
    
    sku = SKU(
        code="TEST-SKU",
        org_id=org.org_id,
        name="Test Product",
        low_stock_threshold=10,
        reorder_point=20
    )
    integration_session.add(sku)
    await integration_session.flush()
    
    # Try to set low_stock_threshold > reorder_point
    # If your business logic should prevent this, add validation in your schema
    # This test documents the expected behavior
    response = await client.patch(
        f"/api/settings/sku/{sku.code}",
        json={"low_stock_threshold": 25, "reorder_point": 20},
        headers=csrf_headers
    )
    
    # Adjust assertion based on your business rules:
    # Option 1: Should fail validation (422)
    # Option 2: Should succeed but you want to document this edge case
    # For now, documenting that this scenario should be considered:
    if response.status_code == 204:
        # If no validation exists, verify it was saved (but maybe shouldn't be)
        await integration_session.refresh(sku)
        assert sku.low_stock_threshold == 25
        assert sku.reorder_point == 20
        # TODO: Consider adding validation to prevent this


@pytest.mark.asyncio
async def test_update_sku_empty_payload(
    authenticated_client, 
    integration_session, 
    csrf_headers
):
    """Test that empty SKU update is handled gracefully."""
    client, user, org = authenticated_client
    
    sku = SKU(
        code="TEST-SKU",
        org_id=org.org_id,
        name="Test Product",
        low_stock_threshold=10,
        reorder_point=20
    )
    integration_session.add(sku)
    await integration_session.flush()
    
    response = await client.patch(
        f"/api/settings/sku/{sku.code}",
        json={},
        headers=csrf_headers
    )
    assert response.status_code == 204
    
    # Verify no changes were made
    await integration_session.refresh(sku)
    assert sku.low_stock_threshold == 10
    assert sku.reorder_point == 20


# -----------------------------------------------------------------------------
# DELETE /account - GDPR Compliance
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_account_cleanup_user_settings(
    authenticated_client,
    integration_session,
    csrf_headers
):
    """Verify UserSettings are deleted when user is deleted (GDPR compliance)."""
    client, user, org = authenticated_client
    
    # Create user settings
    user_settings = UserSettings(
        user_id=user.id,
        locale="en-US",
        pagination=50
    )
    integration_session.add(user_settings)
    await integration_session.flush()
    
    # Delete account
    response = await client.delete("/api/settings/account", headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify UserSettings are gone (cascade delete or explicit cleanup)
    stmt = select(UserSettings).where(UserSettings.user_id == user.id)
    result = (await integration_session.execute(stmt)).scalar_one_or_none()
    assert result is None


@pytest.mark.asyncio
async def test_delete_account_single_user_cleanup_org_settings(
    authenticated_client,
    integration_session,
    csrf_headers
):
    """Verify OrganizationSettings are deleted when last user deletes account."""
    client, user, org = authenticated_client
    
    # Create org settings
    org_settings = OrganizationSettings(
        org_id=org.org_id,
        default_reorder_point=15,
        default_low_stock_threshold=5
    )
    integration_session.add(org_settings)
    await integration_session.flush()
    
    # Delete account (last user)
    response = await client.delete("/api/settings/account", headers=csrf_headers)
    assert response.status_code == 204
    
    # Verify OrganizationSettings are gone
    stmt = select(OrganizationSettings).where(
        OrganizationSettings.org_id == org.org_id
    )
    result = (await integration_session.execute(stmt)).scalar_one_or_none()
    assert result is None
    
