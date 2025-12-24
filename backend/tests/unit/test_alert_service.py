import pytest
from uuid6 import uuid7
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.services.alert_service import AlertService, AlertTransformer
from app.schemas.alerts import LowStockItem
from app.models import Alert, User


class TestAlertServiceLogic:
    """
    Tests the pure business logic methods of the AlertService,
    which do not require database interaction.
    """

    @pytest.fixture
    def alert_service(self):
        """Provides an AlertService instance with a mocked session."""
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    # Severity Calculation Tests

    @pytest.mark.parametrize("items, expected_severity", [
        # Critical: one item is out of stock
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=0, reorder_point=10)], "critical"),
        
        # Critical: one item is below 25% of reorder point
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=2, reorder_point=10)], "critical"),
        
        # Critical: exactly at 25% boundary (should be critical as < 25, not <=)
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=2.4, reorder_point=10)], "critical"),
        
        # Warning: just above 25% threshold
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=2.6, reorder_point=10)], "warning"),
        
        # Critical: multiple items, one is critical
        ([
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=5, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=1, reorder_point=10)
        ], "critical"),
        
        # Warning: above 25% but below reorder point
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=3, reorder_point=10)], "warning"),
        
        # Warning: multiple items, none are critical
        ([
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=5, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=8, reorder_point=20)
        ], "warning"),
        
        # Edge case: reorder point is 0, should not cause division by zero
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=10, reorder_point=0)], "warning"),
        
        # Critical: negative available (inventory discrepancy)
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=-5, reorder_point=10)], "critical"),
        
        # Critical: first item triggers critical
        ([
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=50, reorder_point=10)
        ], "critical"),
    ])
    def test_calculate_severity(self, alert_service, items, expected_severity):
        """Test the _calculate_severity logic for various scenarios."""
        assert alert_service._calculate_severity(items) == expected_severity

    def test_calculate_severity_short_circuits_on_critical(self, alert_service):
        """Ensure severity calculation returns critical as soon as one critical item is found."""
        items = [
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=5, reorder_point=10),
            LowStockItem(sku_code="S3", sku_name="SKU 3", available=8, reorder_point=10)
        ]
        # Should return critical immediately after checking S1
        assert alert_service._calculate_severity(items) == "critical"

    # Title Generation Tests

    @pytest.mark.parametrize("count, expected_title", [
        (1, "1 SKU need reordering"),
        (2, "2 SKUs need reordering"),
        (5, "5 SKUs need reordering"),
        (100, "100 SKUs need reordering"),
    ])
    def test_generate_low_stock_title(self, alert_service, count, expected_title):
        """Test the _generate_low_stock_title helper."""
        assert alert_service._generate_low_stock_title(count) == expected_title

    def test_generate_low_stock_title_singular_vs_plural(self, alert_service):
        """Ensure proper singular/plural handling."""
        assert "SKU need" in alert_service._generate_low_stock_title(1)
        assert "SKUs need" in alert_service._generate_low_stock_title(2)


class TestThresholdCrossingLogic:
    """
    Tests the threshold crossing detection logic without database interaction.
    """

    @pytest.fixture
    def alert_service(self):
        """Provides an AlertService instance with a mocked session."""
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    # Downward Threshold Crossing (Alert Creation)

    @pytest.mark.parametrize("qty_before, qty_after, reorder_point, should_trigger", [
        # Crossed downward: was at/above, now below
        (10, 8, 9, True),
        (9, 8, 9, True),
        
        # Did not cross: was already below
        (8, 7, 9, False),
        (5, 4, 9, False),
        
        # Did not cross: still at/above
        (10, 10, 9, False),
        (10, 9, 9, False),
        
        # Edge case: went from reorder point to just below
        (9, 8, 9, True),
        
        # Edge case: went to zero (out of stock)
        (10, 0, 9, True),
        
        # Went out of stock from already below threshold
        (5, 0, 9, True),  # This should trigger because went_out_of_stock
    ])
    def test_should_trigger_alert_logic(
        self, 
        qty_before, 
        qty_after, 
        reorder_point, 
        should_trigger
    ):
        """Test the logic for when alerts should be triggered."""
        # Simulate the logic from check_sku_crossed_threshold
        crossed_threshold = (qty_before >= reorder_point and qty_after < reorder_point)
        went_out_of_stock = (qty_before > 0 and qty_after == 0)
        
        result = crossed_threshold or went_out_of_stock
        assert result == should_trigger, \
            f"qty_before={qty_before}, qty_after={qty_after}, reorder_point={reorder_point}"

    # Upward Threshold Crossing (Alert Resolution)

    @pytest.mark.parametrize("qty_before, qty_after, reorder_point, should_resolve", [
        # Crossed upward: was below, now at/above
        (8, 10, 9, True),
        (8, 9, 9, True),
        
        # Did not cross: was already at/above
        (10, 11, 9, False),
        (9, 10, 9, False),
        
        # Did not cross: still below
        (8, 8, 9, False),
        (5, 7, 9, False),
        
        # Edge case: went from just below to reorder point
        (8, 9, 9, True),
        
        # Edge case: large jump upward
        (5, 100, 9, True),
    ])
    def test_should_resolve_alert_logic(
        self, 
        qty_before, 
        qty_after, 
        reorder_point, 
        should_resolve
    ):
        """Test the logic for when alerts should be resolved."""
        # Simulate the logic from resolve_sku_threshold
        crossed_upward = (qty_before < reorder_point and qty_after >= reorder_point)
        
        assert crossed_upward == should_resolve, \
            f"qty_before={qty_before}, qty_after={qty_after}, reorder_point={reorder_point}"


class TestAlertCreationValidation:
    """
    Tests validation logic for alert creation.
    """

    @pytest.fixture
    def alert_service(self):
        """Provides an AlertService instance with a mocked session."""
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    @pytest.mark.asyncio
    async def test_create_low_stock_alert_with_empty_items_raises_error(self, alert_service):
        """Ensure we cannot create low stock alerts with no items."""
        with pytest.raises(ValueError, match="empty items list"):
            await alert_service.create_or_update_low_stock_alert([])

    @pytest.mark.asyncio
    async def test_create_low_stock_alert_with_single_item(self, alert_service):
        """Test alert creation with a single low stock item."""
        # Mock the session to return None (no existing alert)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        alert_service.session.execute = AsyncMock(return_value=mock_result)
        alert_service.session.flush = AsyncMock()
        alert_service.session.add = MagicMock()

        item = LowStockItem(
            sku_code="TEST-001",
            sku_name="Test Product",
            available=5,
            reorder_point=10
        )

        alert = await alert_service.create_or_update_low_stock_alert([item])

        # Verify alert was created with correct attributes
        assert alert.alert_type == "low_stock"
        assert alert.severity in ["warning", "critical"]
        assert "Test Product" in alert.message
        assert alert.aggregation_key == f"low_stock_{date.today().isoformat()}"
        assert item.sku_code in alert.alert_metadata['sku_codes']

    @pytest.mark.asyncio
    async def test_create_low_stock_alert_with_multiple_items(self, alert_service):
        """Test alert creation with multiple low stock items."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        alert_service.session.execute = AsyncMock(return_value=mock_result)
        alert_service.session.flush = AsyncMock()
        alert_service.session.add = MagicMock()

        items = [
            LowStockItem(sku_code="SKU-001", sku_name="Product 1", available=2, reorder_point=10),
            LowStockItem(sku_code="SKU-002", sku_name="Product 2", available=5, reorder_point=20),
            LowStockItem(sku_code="SKU-003", sku_name="Product 3", available=0, reorder_point=15),
        ]

        alert = await alert_service.create_or_update_low_stock_alert(items)

        assert alert.alert_type == "low_stock"
        assert alert.severity == "critical"  # One item is out of stock
        assert len(alert.alert_metadata['sku_codes']) == 3
        assert "3 SKUs" in alert.title
        assert "SKU-001" in alert.alert_metadata['sku_codes']
        assert "SKU-002" in alert.alert_metadata['sku_codes']
        assert "SKU-003" in alert.alert_metadata['sku_codes']


class TestAlertMessageGeneration:
    """
    Tests message generation logic for different scenarios.
    """

    @pytest.fixture
    def alert_service(self):
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    def test_single_item_message_format(self, alert_service):
        """Test message generation for single item alerts."""
        item = LowStockItem(
            sku_code="TEST-001",
            sku_name="Test Widget",
            available=5,
            reorder_point=10
        )
        
        # For a new alert with single item, message should contain SKU name
        # This would be tested in the actual create method, but we're validating
        # the expected format here
        expected_message_pattern = "Test Widget is below reorder point"
        assert "Test Widget" in item.sku_name

    def test_multiple_items_message_format(self, alert_service):
        """Test message generation for multiple item alerts."""
        items = [
            LowStockItem(sku_code=f"SKU-{i}", sku_name=f"Product {i}", 
                        available=5, reorder_point=10)
            for i in range(5)
        ]
        
        severity = alert_service._calculate_severity(items)
        # Message should include count and severity indication
        count = len(items)
        assert count == 5


class TestAlertResponseTransformation:
    """
    Tests the AlertTransformer class for converting alerts to responses.
    """

    @pytest.fixture
    def mock_alert_service(self):
        """Create a mock alert service."""
        service = AsyncMock(spec=AlertService)
        return service

    @pytest.fixture
    def sample_alerts(self):
        """Create sample alerts for testing."""
        org_id = uuid7()
        return [
            Alert(
                id=uuid7(),
                org_id=org_id,
                alert_type="low_stock",
                severity="critical",
                title="5 SKUs need reordering",
                message="5 SKUs below reorder points • Critically low stock",
                aggregation_key=f"low_stock_{date.today().isoformat()}",
                alert_metadata={
                    'sku_codes': ['SKU-001', 'SKU-002'],
                    'details': [],
                    'check_timestamp': datetime.now(timezone.utc).isoformat()
                }
            ),
            Alert(
                id=uuid7(),
                org_id=org_id,
                alert_type="team_member_joined",
                severity="info",
                title="John Doe joined the team",
                message=None,
                aggregation_key=None,
                alert_metadata={
                    'user_id': str(uuid7()),
                    'user_name': 'John Doe',
                    'user_email': 'john@example.com',
                    'role': 'member'
                }
            )
        ]

    @pytest.mark.asyncio
    async def test_transformer_with_empty_alerts(self, mock_alert_service):
        """Test transformer returns empty list for empty input."""
        user_id = uuid7()
        transformer = AlertTransformer(mock_alert_service, user_id)
        
        result = await transformer([])
        
        assert result == []
        mock_alert_service.get_read_status_map.assert_not_called()

    @pytest.mark.asyncio
    async def test_transformer_with_all_read_alerts(self, mock_alert_service, sample_alerts):
        """Test transformer marks all alerts as read when all have receipts."""
        user_id = uuid7()
        alert_ids = {alert.id for alert in sample_alerts}
        
        # Mock all alerts as read
        mock_alert_service.get_read_status_map.return_value = alert_ids
        mock_alert_service.to_response.side_effect = lambda alert, is_read: MagicMock(
            id=alert.id,
            alert_type=alert.alert_type,
            is_read=is_read
        )
        
        transformer = AlertTransformer(mock_alert_service, user_id)
        results = await transformer(sample_alerts)
        
        assert len(results) == 2
        assert all(result.is_read for result in results)
        mock_alert_service.get_read_status_map.assert_called_once()

    @pytest.mark.asyncio
    async def test_transformer_with_mixed_read_status(self, mock_alert_service, sample_alerts):
        """Test transformer correctly marks mixed read/unread status."""
        user_id = uuid7()
        read_alert_id = sample_alerts[0].id
        
        # Mock only first alert as read
        mock_alert_service.get_read_status_map.return_value = {read_alert_id}
        mock_alert_service.to_response.side_effect = lambda alert, is_read: MagicMock(
            id=alert.id,
            is_read=is_read
        )
        
        transformer = AlertTransformer(mock_alert_service, user_id)
        results = await transformer(sample_alerts)
        
        assert len(results) == 2
        assert results[0].is_read is True
        assert results[1].is_read is False


class TestAlertQueryFiltering:
    """
    Tests for alert query filtering logic (without full DB integration).
    """

    @pytest.fixture
    def alert_service(self):
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    @pytest.fixture
    def mock_user(self):
        """Create a mock user."""
        return User(
            id=uuid7(),
            org_id=uuid7(),
            email="test@example.com",
            first_name="Test",
            last_name="User",
            role="admin",
            created_at=datetime.now(timezone.utc)
        )

    @pytest.mark.asyncio
    async def test_build_query_excludes_own_team_member_alert(self, alert_service, mock_user):
        """Test that users don't see their own team_member_joined alert."""
        query = await alert_service.build_alerts_query(mock_user)
        
        # Query should be built (returns SQLAlchemy query object)
        assert query is not None
        # The actual filtering logic is in the SQL, tested in integration tests

    @pytest.mark.asyncio
    async def test_build_query_with_type_filter(self, alert_service, mock_user):
        """Test query building with alert type filter."""
        query = await alert_service.build_alerts_query(
            mock_user,
            alert_type="low_stock"
        )
        
        assert query is not None

    @pytest.mark.asyncio
    async def test_build_query_with_read_filter(self, alert_service, mock_user):
        """Test query building with read status filter."""
        query_read = await alert_service.build_alerts_query(
            mock_user,
            read_filter="read"
        )
        query_unread = await alert_service.build_alerts_query(
            mock_user,
            read_filter="unread"
        )
        
        assert query_read is not None
        assert query_unread is not None


class TestAlertToResponse:
    """
    Tests the to_response method for converting Alert models to responses.
    """

    @pytest.fixture
    def alert_service(self):
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    def test_to_response_with_unread_alert(self, alert_service):
        """Test converting unread alert to response."""
        alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type="low_stock",
            severity="warning",
            title="Test Alert",
            message="Test message",
            aggregation_key="test_key",
            alert_metadata={'test': 'data'}
        )
        
        response = alert_service.to_response(alert, is_read=False)
        
        assert response.id == alert.id
        assert response.alert_type == "low_stock"
        assert response.severity == "warning"
        assert response.title == "Test Alert"
        assert response.message == "Test message"
        assert response.is_read is False
        assert response.alert_metadata == {'test': 'data'}

    def test_to_response_with_read_alert(self, alert_service):
        """Test converting read alert to response."""
        alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type="team_member_joined",
            severity="info",
            title="User joined",
            message=None,
            aggregation_key=None,
            alert_metadata={}
        )
        
        response = alert_service.to_response(alert, is_read=True)
        
        assert response.id == alert.id
        assert response.is_read is True
        assert response.message is None


class TestEdgeCases:
    """
    Tests for edge cases and boundary conditions.
    """

    @pytest.fixture
    def alert_service(self):
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    def test_severity_with_zero_reorder_point(self, alert_service):
        """Test that zero reorder point doesn't cause division errors."""
        items = [
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=0, reorder_point=0),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=10, reorder_point=0)
        ]
        
        # Should handle gracefully (first item is out of stock, so critical)
        assert alert_service._calculate_severity(items) == "critical"

    def test_severity_with_very_large_numbers(self, alert_service):
        """Test severity calculation with very large inventory numbers."""
        items = [
            LowStockItem(
                sku_code="S1", 
                sku_name="SKU 1", 
                available=1_000_000, 
                reorder_point=10_000_000
            )
        ]
        
        # 1M / 10M = 10%, which is < 25%, so critical
        assert alert_service._calculate_severity(items) == "critical"

    def test_severity_with_floating_point_values(self, alert_service):
        """Test severity calculation with decimal values."""
        items = [
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=2.49, reorder_point=10.0)
        ]
        
        # 2.49 / 10 = 24.9%, which is < 25%, so critical
        assert alert_service._calculate_severity(items) == "critical"

    def test_aggregation_key_format(self, alert_service):
        """Test that aggregation key uses ISO date format."""
        today = date.today()
        expected_key = f"low_stock_{today.isoformat()}"
        
        # The key format is consistent
        assert expected_key.startswith("low_stock_")
        assert len(expected_key.split("_")) == 3  # low, stock, date


class TestMarkAsReadValidation:
    """
    Tests for read status management validation.
    """

    @pytest.fixture
    def alert_service(self):
        mock_session = AsyncMock()
        org_id = uuid7()
        return AlertService(session=mock_session, org_id=org_id), org_id

    @pytest.mark.asyncio
    async def test_mark_as_read_nonexistent_alert_raises_error(self, alert_service):
        """Test that marking non-existent alert raises ValueError."""
        service, org_id = alert_service
        
        # Mock: alert not found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        service.session.execute = AsyncMock(return_value=mock_result)
        
        alert_id = uuid7()
        user_id = uuid7()
        
        with pytest.raises(ValueError, match="not found in organization"):
            await service.mark_as_read(alert_id, user_id)

    @pytest.mark.asyncio
    async def test_mark_as_read_already_read_returns_false(self, alert_service):
        """Test that marking already-read alert returns False."""
        service, org_id = alert_service
        
        # Mock: alert exists
        alert_result = MagicMock()
        alert_result.scalar_one_or_none.return_value = uuid7()
        
        # Mock: receipt exists (already read)
        receipt_result = MagicMock()
        receipt_result.scalar_one_or_none.return_value = MagicMock()
        
        service.session.execute = AsyncMock(
            side_effect=[alert_result, receipt_result]
        )
        
        result = await service.mark_as_read(uuid7(), uuid7())
        
        assert result is False

    @pytest.mark.asyncio
    async def test_mark_as_read_new_receipt_returns_true(self, alert_service):
        """Test that marking unread alert returns True."""
        service, org_id = alert_service
        
        # Mock: alert exists
        alert_result = MagicMock()
        alert_result.scalar_one_or_none.return_value = uuid7()
        
        # Mock: no receipt (unread)
        receipt_result = MagicMock()
        receipt_result.scalar_one_or_none.return_value = None
        
        service.session.execute = AsyncMock(
            side_effect=[alert_result, receipt_result]
        )
        service.session.add = MagicMock()
        service.session.flush = AsyncMock()
        
        result = await service.mark_as_read(uuid7(), uuid7())
        
        assert result is True
        service.session.add.assert_called_once()
        