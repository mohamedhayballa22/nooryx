import pytest
from uuid6 import uuid7
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.services.alert_service import (
    AlertService,
    AlertTransformer,
    StockAnalyzer,
    AlertMessageGenerator,
    AlertRepository,
    LowStockAlertManager,
    ReadStatusManager,
    StockStatus,
    AlertSeverity,
    AlertType,
)
from app.schemas.alerts import LowStockItem
from app.models import Alert, User


# ============================================================================
# Stock Analyzer Tests
# ============================================================================

class TestStockAnalyzer:
    """Tests the StockAnalyzer for stock status classification."""

    @pytest.fixture
    def analyzer(self):
        return StockAnalyzer()

    # Analyze Item Tests

    @pytest.mark.parametrize("available, reorder_point, expected_status", [
        # Out of stock
        (0, 10, StockStatus.OUT_OF_STOCK),
        (-5, 10, StockStatus.OUT_OF_STOCK),
        
        # Critically low (< 25% of reorder point)
        (1, 10, StockStatus.CRITICALLY_LOW),
        (2, 10, StockStatus.CRITICALLY_LOW),
        (2.4, 10, StockStatus.CRITICALLY_LOW),
        (24, 100, StockStatus.CRITICALLY_LOW),
        
        # Below reorder but not critical
        (2.6, 10, StockStatus.BELOW_REORDER),
        (3, 10, StockStatus.BELOW_REORDER),
        (5, 10, StockStatus.BELOW_REORDER),
        (30, 100, StockStatus.BELOW_REORDER),
        
        # Edge case: reorder point is 0
        (10, 0, StockStatus.BELOW_REORDER),
        (0, 0, StockStatus.OUT_OF_STOCK),
    ])
    def test_analyze_item(self, analyzer, available, reorder_point, expected_status):
        """Test stock status classification for individual items."""
        assert analyzer.analyze_item(available, reorder_point) == expected_status

    # Calculate Severity Tests

    @pytest.mark.parametrize("items, expected_severity", [
        # Critical: one item is out of stock
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=0, reorder_point=10)], 
         AlertSeverity.CRITICAL),
        
        # Critical: one item is below 25% of reorder point
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=2, reorder_point=10)], 
         AlertSeverity.CRITICAL),
        
        # Warning: just above 25% threshold
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=2.6, reorder_point=10)], 
         AlertSeverity.WARNING),
        
        # Critical: multiple items, one is critical
        ([
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=5, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=1, reorder_point=10)
        ], AlertSeverity.CRITICAL),
        
        # Warning: multiple items, none critical
        ([
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=5, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=8, reorder_point=20)
        ], AlertSeverity.WARNING),
        
        # Edge case: reorder point is 0
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=10, reorder_point=0)], 
         AlertSeverity.WARNING),
        
        # Critical: negative available
        ([LowStockItem(sku_code="S1", sku_name="SKU 1", available=-5, reorder_point=10)], 
         AlertSeverity.CRITICAL),
    ])
    def test_calculate_severity(self, analyzer, items, expected_severity):
        """Test severity calculation for various scenarios."""
        assert analyzer.calculate_severity(items) == expected_severity

    def test_calculate_severity_short_circuits(self, analyzer):
        """Ensure severity returns critical immediately when found."""
        items = [
            LowStockItem(sku_code="S1", sku_name="SKU 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="SKU 2", available=5, reorder_point=10),
        ]
        assert analyzer.calculate_severity(items) == AlertSeverity.CRITICAL

    # Categorize Items Tests

    def test_categorize_items_all_categories(self, analyzer):
        """Test categorization of items into all three categories."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Out", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Critical", available=2, reorder_point=10),
            LowStockItem(sku_code="S3", sku_name="Below", available=5, reorder_point=10),
        ]
        
        categories = analyzer.categorize_items(items)
        
        assert len(categories[StockStatus.OUT_OF_STOCK]) == 1
        assert len(categories[StockStatus.CRITICALLY_LOW]) == 1
        assert len(categories[StockStatus.BELOW_REORDER]) == 1
        assert categories[StockStatus.OUT_OF_STOCK][0].sku_code == "S1"
        assert categories[StockStatus.CRITICALLY_LOW][0].sku_code == "S2"
        assert categories[StockStatus.BELOW_REORDER][0].sku_code == "S3"

    def test_categorize_items_empty_list(self, analyzer):
        """Test categorization with empty items list."""
        categories = analyzer.categorize_items([])
        
        assert len(categories[StockStatus.OUT_OF_STOCK]) == 0
        assert len(categories[StockStatus.CRITICALLY_LOW]) == 0
        assert len(categories[StockStatus.BELOW_REORDER]) == 0


# ============================================================================
# Message Generator Tests
# ============================================================================

class TestAlertMessageGenerator:
    """Tests intelligent message generation."""

    @pytest.fixture
    def generator(self):
        return AlertMessageGenerator()

    # Title Generation Tests

    @pytest.mark.parametrize("count, expected_title", [
        (1, "1 SKU needs reordering"),
        (2, "2 SKUs need reordering"),
        (5, "5 SKUs need reordering"),
        (100, "100 SKUs need reordering"),
    ])
    def test_generate_low_stock_title(self, generator, count, expected_title):
        """Test title generation with correct singular/plural."""
        assert generator.generate_low_stock_title(count) == expected_title

    # Message Generation Tests

    def test_single_item_out_of_stock(self, generator):
        """Test message for single out of stock item."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Camera Lens", available=0, reorder_point=10)
        ]
        
        message = generator.generate_low_stock_message(items)
        assert message == "Camera Lens is out of stock"

    def test_single_item_critically_low(self, generator):
        """Test message for single critically low item."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Camera Lens", available=2, reorder_point=10)
        ]
        
        message = generator.generate_low_stock_message(items)
        assert message == "Camera Lens is critically low (2 left)"

    def test_single_item_below_reorder(self, generator):
        """Test message for single item below reorder point."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Camera Lens", available=5, reorder_point=10)
        ]
        
        message = generator.generate_low_stock_message(items)
        assert message == "Camera Lens is below reorder point"

    def test_multiple_items_new_alert(self, generator):
        """Test message for new alert with multiple items."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=2, reorder_point=10),
            LowStockItem(sku_code="S3", sku_name="Item 3", available=5, reorder_point=10),
        ]
        
        message = generator.generate_low_stock_message(items)
        
        assert "3 SKUs" in message
        assert "1 out of stock" in message
        assert "1 critically low" in message

    def test_multiple_items_with_update(self, generator):
        """Test message for updated alert with new items added."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=2, reorder_point=10),
            LowStockItem(sku_code="S3", sku_name="Item 3", available=5, reorder_point=10),
        ]
        
        message = generator.generate_low_stock_message(items, new_count=1, is_update=True)
        
        assert "1 additional SKU" in message
        assert "(3 total)" in message
        assert "1 out of stock" in message

    def test_multiple_new_items_added(self, generator):
        """Test message when multiple new items added to existing alert."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=5, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=5, reorder_point=10),
            LowStockItem(sku_code="S3", sku_name="Item 3", available=5, reorder_point=10),
            LowStockItem(sku_code="S4", sku_name="Item 4", available=5, reorder_point=10),
            LowStockItem(sku_code="S5", sku_name="Item 5", available=5, reorder_point=10),
        ]
        
        message = generator.generate_low_stock_message(items, new_count=3, is_update=True)
        
        assert "3 additional SKUs" in message
        assert "(5 total)" in message

    def test_message_with_only_out_of_stock(self, generator):
        """Test message when all items are out of stock."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=0, reorder_point=10),
        ]
        
        message = generator.generate_low_stock_message(items)
        
        assert "2 SKUs" in message
        assert "2 out of stock" in message
        assert "critically low" not in message

    def test_message_with_only_critically_low(self, generator):
        """Test message when all items are critically low."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=2, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=1, reorder_point=10),
        ]
        
        message = generator.generate_low_stock_message(items)
        
        assert "2 SKUs" in message
        assert "2 critically low" in message
        assert "out of stock" not in message

    def test_message_with_no_critical_issues(self, generator):
        """Test message when items are below reorder but not critical."""
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=5, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=7, reorder_point=10),
        ]
        
        message = generator.generate_low_stock_message(items)
        
        assert "2 SKUs" in message
        assert "action needed soon" in message

    def test_message_with_many_items_no_critical(self, generator):
        """Test message changes for large count with no critical issues."""
        items = [
            LowStockItem(sku_code=f"S{i}", sku_name=f"Item {i}", available=5, reorder_point=10)
            for i in range(10)
        ]
        
        message = generator.generate_low_stock_message(items)
        
        assert "10 SKUs" in message
        assert "need reordering" in message

    def test_team_member_title(self, generator):
        """Test team member join title generation."""
        title = generator.generate_team_member_title("John", "Doe")
        assert title == "John Doe joined the team"


# ============================================================================
# Threshold Crossing Logic Tests
# ============================================================================

class TestThresholdCrossingLogic:
    """Tests threshold detection logic without database."""

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
        
        # Edge case: exactly at threshold
        (9, 8, 9, True),
        
        # Edge case: went to zero
        (10, 0, 9, True),
        
        # Went out of stock from below threshold
        (5, 0, 9, True),
    ])
    def test_should_trigger_alert_logic(
        self, 
        qty_before, 
        qty_after, 
        reorder_point, 
        should_trigger
    ):
        """Test when alerts should be triggered."""
        crossed_threshold = (qty_before >= reorder_point and qty_after < reorder_point)
        went_out_of_stock = (qty_before > 0 and qty_after == 0)
        
        result = crossed_threshold or went_out_of_stock
        assert result == should_trigger

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
        
        # Edge case: exactly at threshold
        (8, 9, 9, True),
        
        # Large jump
        (5, 100, 9, True),
    ])
    def test_should_resolve_alert_logic(
        self, 
        qty_before, 
        qty_after, 
        reorder_point, 
        should_resolve
    ):
        """Test when alerts should be resolved."""
        crossed_upward = (qty_before < reorder_point and qty_after >= reorder_point)
        assert crossed_upward == should_resolve


# ============================================================================
# Low Stock Alert Manager Tests
# ============================================================================

class TestLowStockAlertManager:
    """Tests the LowStockAlertManager business logic."""

    @pytest.fixture
    def mock_repo(self):
        repo = AsyncMock(spec=AlertRepository)
        repo.org_id = uuid7()
        repo.session = AsyncMock()
        return repo

    @pytest.fixture
    def manager(self, mock_repo):
        return LowStockAlertManager(mock_repo)

    @pytest.mark.asyncio
    async def test_create_or_update_empty_items_raises_error(self, manager):
        """Test that empty items list raises ValueError."""
        with pytest.raises(ValueError, match="without items"):
            await manager.create_or_update([])

    @pytest.mark.asyncio
    async def test_create_new_alert_single_item(self, manager, mock_repo):
        """Test creating new alert with single item."""
        mock_repo.get_alert_by_aggregation_key.return_value = None
        mock_repo.create_alert.return_value = MagicMock(spec=Alert)
        
        item = LowStockItem(
            sku_code="TEST-001",
            sku_name="Test Product",
            available=5,
            reorder_point=10
        )
        
        alert = await manager.create_or_update([item])
        
        mock_repo.create_alert.assert_called_once()
        created_alert = mock_repo.create_alert.call_args[0][0]
        assert created_alert.alert_type == AlertType.LOW_STOCK.value
        assert created_alert.severity in [AlertSeverity.WARNING.value, AlertSeverity.CRITICAL.value]
        assert "Test Product" in created_alert.message

    @pytest.mark.asyncio
    async def test_create_new_alert_multiple_items(self, manager, mock_repo):
        """Test creating new alert with multiple items."""
        mock_repo.get_alert_by_aggregation_key.return_value = None
        mock_repo.create_alert.return_value = MagicMock(spec=Alert)
        
        items = [
            LowStockItem(sku_code="S1", sku_name="Item 1", available=0, reorder_point=10),
            LowStockItem(sku_code="S2", sku_name="Item 2", available=5, reorder_point=10),
        ]
        
        alert = await manager.create_or_update(items)
        
        created_alert = mock_repo.create_alert.call_args[0][0]
        assert created_alert.severity == AlertSeverity.CRITICAL.value
        assert len(created_alert.alert_metadata['sku_codes']) == 2
        assert "2 SKUs" in created_alert.title

    @pytest.mark.asyncio
    async def test_update_existing_alert_adds_new_items(self, manager, mock_repo):
        """Test updating existing alert by adding new items."""
        existing_alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type=AlertType.LOW_STOCK.value,
            severity=AlertSeverity.WARNING.value,
            title="1 SKU needs reordering",
            message="Item 1 is below reorder point",
            aggregation_key=f"low_stock_{date.today().isoformat()}",
            alert_metadata={
                'sku_codes': ['S1'],
                'details': [{
                    'sku_code': 'S1',
                    'sku_name': 'Item 1',
                    'available': 5,
                    'reorder_point': 10
                }],
                'check_timestamp': datetime.now(timezone.utc).isoformat()
            }
        )
        
        mock_repo.get_alert_by_aggregation_key.return_value = existing_alert
        mock_repo.delete_read_receipts = AsyncMock()
        
        new_item = LowStockItem(sku_code="S2", sku_name="Item 2", available=0, reorder_point=10)
        
        alert = await manager.create_or_update([new_item])
        
        assert len(alert.alert_metadata['sku_codes']) == 2
        assert 'S2' in alert.alert_metadata['sku_codes']
        assert alert.severity == AlertSeverity.CRITICAL.value  # One item is out of stock
        assert "1 additional SKU" in alert.message
        assert "(2 total)" in alert.message
        mock_repo.delete_read_receipts.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_existing_alert_updates_quantities(self, manager, mock_repo):
        """Test updating existing alert when item quantities change."""
        existing_alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type=AlertType.LOW_STOCK.value,
            severity=AlertSeverity.WARNING.value,
            title="1 SKU needs reordering",
            message="Item 1 is below reorder point",
            aggregation_key=f"low_stock_{date.today().isoformat()}",
            alert_metadata={
                'sku_codes': ['S1'],
                'details': [{
                    'sku_code': 'S1',
                    'sku_name': 'Item 1',
                    'available': 5,
                    'reorder_point': 10
                }],
                'check_timestamp': datetime.now(timezone.utc).isoformat()
            }
        )
        
        mock_repo.get_alert_by_aggregation_key.return_value = existing_alert
        mock_repo.delete_read_receipts = AsyncMock()
        
        # Same SKU but now out of stock
        updated_item = LowStockItem(sku_code="S1", sku_name="Item 1", available=0, reorder_point=10)
        
        alert = await manager.create_or_update([updated_item])
        
        assert len(alert.alert_metadata['sku_codes']) == 1
        assert alert.alert_metadata['details'][0]['available'] == 0
        assert alert.severity == AlertSeverity.CRITICAL.value
        mock_repo.delete_read_receipts.assert_called_once()

    @pytest.mark.asyncio
    async def test_resolve_sku_not_crossed_upward(self, manager, mock_repo):
        """Test that resolve does nothing when threshold not crossed upward."""
        mock_repo.get_sku_config.return_value = (10, True, "Test")
        
        # Still below threshold
        result = await manager.resolve_sku("S1", qty_before=8, qty_after=9)
        
        assert result == []
        mock_repo.get_alerts_containing_sku.assert_not_called()

    @pytest.mark.asyncio
    async def test_resolve_sku_deletes_single_item_alert(self, manager, mock_repo):
        """Test resolving single-item alert deletes it entirely."""
        mock_repo.get_sku_config.return_value = (10, True, "Test")
        
        alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type=AlertType.LOW_STOCK.value,
            severity=AlertSeverity.WARNING.value,
            title="1 SKU needs reordering",
            message="Test is below reorder point",
            aggregation_key=f"low_stock_{date.today().isoformat()}",
            alert_metadata={
                'sku_codes': ['S1'],
                'details': [{
                    'sku_code': 'S1',
                    'sku_name': 'Test',
                    'available': 8,
                    'reorder_point': 10
                }]
            }
        )
        
        mock_repo.get_alerts_containing_sku.return_value = [alert]
        mock_repo.delete_alert = AsyncMock()
        mock_repo.session.flush = AsyncMock()
        
        result = await manager.resolve_sku("S1", qty_before=8, qty_after=10)
        
        assert len(result) == 1
        mock_repo.delete_alert.assert_called_once_with(alert)

    @pytest.mark.asyncio
    async def test_resolve_sku_removes_from_multi_item_alert(self, manager, mock_repo):
        """Test resolving removes SKU from multi-item alert."""
        mock_repo.get_sku_config.return_value = (10, True, "Test")
        
        alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type=AlertType.LOW_STOCK.value,
            severity=AlertSeverity.CRITICAL.value,
            title="2 SKUs need reordering",
            message="2 SKUs • 1 out of stock",
            aggregation_key=f"low_stock_{date.today().isoformat()}",
            alert_metadata={
                'sku_codes': ['S1', 'S2'],
                'details': [
                    {'sku_code': 'S1', 'sku_name': 'Item 1', 'available': 8, 'reorder_point': 10},
                    {'sku_code': 'S2', 'sku_name': 'Item 2', 'available': 0, 'reorder_point': 10}
                ]
            }
        )
        
        mock_repo.get_alerts_containing_sku.return_value = [alert]
        mock_repo.session.flush = AsyncMock()
        
        result = await manager.resolve_sku("S1", qty_before=8, qty_after=10)
        
        assert len(result) == 1
        assert len(alert.alert_metadata['sku_codes']) == 1
        assert 'S2' in alert.alert_metadata['sku_codes']
        assert 'S1' not in alert.alert_metadata['sku_codes']
        assert len(alert.alert_metadata['details']) == 1

    @pytest.mark.asyncio
    async def test_check_threshold_sku_not_found(self, manager, mock_repo):
        """Test check threshold returns None when SKU doesn't exist."""
        mock_repo.get_sku_config.return_value = None
        
        result = await manager.check_threshold_crossed("UNKNOWN", 10, 5)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_check_threshold_alerts_disabled_for_sku(self, manager, mock_repo):
        """Test check threshold returns None when SKU has alerts disabled."""
        mock_repo.get_sku_config.return_value = (10, False, "Test")
        
        result = await manager.check_threshold_crossed("S1", 10, 5)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_check_threshold_all_users_disabled_alerts(self, manager, mock_repo):
        """Test check threshold returns None when all users disabled alerts."""
        mock_repo.get_sku_config.return_value = (10, True, "Test")
        mock_repo.count_users_with_alerts_enabled.return_value = (5, 5)  # All 5 users disabled
        
        result = await manager.check_threshold_crossed("S1", 10, 5)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_check_threshold_not_crossed(self, manager, mock_repo):
        """Test check threshold returns None when threshold not crossed."""
        mock_repo.get_sku_config.return_value = (10, True, "Test")
        mock_repo.count_users_with_alerts_enabled.return_value = (5, 2)
        
        # Still above threshold
        result = await manager.check_threshold_crossed("S1", 15, 12)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_check_threshold_crossed_creates_alert(self, manager, mock_repo):
        """Test check threshold creates alert when crossed."""
        mock_repo.get_sku_config.return_value = (10, True, "Test Product")
        mock_repo.count_users_with_alerts_enabled.return_value = (5, 2)
        mock_repo.get_alert_by_aggregation_key.return_value = None
        mock_repo.create_alert.return_value = MagicMock(spec=Alert)
        
        result = await manager.check_threshold_crossed("S1", 10, 8)
        
        assert result is not None
        mock_repo.create_alert.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_threshold_went_out_of_stock(self, manager, mock_repo):
        """Test check threshold detects when item went out of stock."""
        mock_repo.get_sku_config.return_value = (10, True, "Test Product")
        mock_repo.count_users_with_alerts_enabled.return_value = (5, 2)
        mock_repo.get_alert_by_aggregation_key.return_value = None
        mock_repo.create_alert.return_value = MagicMock(spec=Alert)
        
        # Was below threshold but went to zero
        result = await manager.check_threshold_crossed("S1", 5, 0)
        
        assert result is not None
        mock_repo.create_alert.assert_called_once()


# ============================================================================
# Read Status Manager Tests
# ============================================================================

class TestReadStatusManager:
    """Tests the ReadStatusManager."""

    @pytest.fixture
    def mock_repo(self):
        return AsyncMock(spec=AlertRepository)

    @pytest.fixture
    def manager(self, mock_repo):
        return ReadStatusManager(mock_repo)

    @pytest.mark.asyncio
    async def test_mark_read_nonexistent_alert_raises_error(self, manager, mock_repo):
        """Test marking non-existent alert raises ValueError."""
        mock_repo.verify_alert_exists.return_value = False
        
        with pytest.raises(ValueError, match="not found"):
            await manager.mark_read(uuid7(), uuid7())

    @pytest.mark.asyncio
    async def test_mark_read_already_read_returns_false(self, manager, mock_repo):
        """Test marking already-read alert returns False."""
        mock_repo.verify_alert_exists.return_value = True
        mock_repo.get_read_receipt.return_value = MagicMock()  # Exists
        
        result = await manager.mark_read(uuid7(), uuid7())
        
        assert result is False

    @pytest.mark.asyncio
    async def test_mark_read_creates_receipt_returns_true(self, manager, mock_repo):
        """Test marking unread alert creates receipt and returns True."""
        mock_repo.verify_alert_exists.return_value = True
        mock_repo.get_read_receipt.return_value = None  # Doesn't exist
        mock_repo.create_read_receipt = AsyncMock()
        
        result = await manager.mark_read(uuid7(), uuid7())
        
        assert result is True
        mock_repo.create_read_receipt.assert_called_once()
        
    @pytest.mark.asyncio
    async def test_mark_all_read_no_unread_alerts(self, manager, mock_repo):
        """Test mark all read returns 0 when no unread alerts."""
        user = MagicMock(spec=User)
        mock_repo.get_unread_alert_ids.return_value = []
        
        result = await manager.mark_all_read(user)
        
        assert result == 0
        mock_repo.bulk_create_read_receipts.assert_not_called()

    @pytest.mark.asyncio
    async def test_mark_all_read_creates_bulk_receipts(self, manager, mock_repo):
        """Test mark all read creates receipts for all unread alerts."""
        user = MagicMock(spec=User, id=uuid7())
        unread_ids = [uuid7(), uuid7(), uuid7()]
        mock_repo.get_unread_alert_ids.return_value = unread_ids
        mock_repo.bulk_create_read_receipts.return_value = 3
        
        result = await manager.mark_all_read(user)
        
        assert result == 3
        mock_repo.bulk_create_read_receipts.assert_called_once_with(unread_ids, user.id)
        
        
# ============================================================================
# Alert Service Integration Tests
# ============================================================================
class TestAlertService: 
    """Tests the main AlertService facade."""
    @pytest.fixture
    def alert_service(self):
        mock_session = AsyncMock()
        return AlertService(session=mock_session, org_id=uuid7())

    @pytest.mark.asyncio
    async def test_create_team_member_alert(self, alert_service):
        """Test creating team member join alert."""
        alert_service.repo.create_alert = AsyncMock(return_value=MagicMock(spec=Alert))
        
        alert = await alert_service.create_team_member_alert(
            user_id=uuid7(),
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            role="member"
        )
        
        alert_service.repo.create_alert.assert_called_once()
        created = alert_service.repo.create_alert.call_args[0][0]
        assert created.alert_type == AlertType.TEAM_MEMBER_JOINED.value
        assert created.severity == AlertSeverity.INFO.value
        assert "John Doe joined the team" in created.title

    @pytest.mark.asyncio
    async def test_check_sku_crossed_threshold(self, alert_service):
        """Test check SKU threshold delegates to manager."""
        alert_service.low_stock.check_threshold_crossed = AsyncMock(return_value=None)
        
        result = await alert_service.check_sku_crossed_threshold("S1", 10, 5)
        
        alert_service.low_stock.check_threshold_crossed.assert_called_once_with("S1", 10, 5)

    @pytest.mark.asyncio
    async def test_resolve_sku_threshold(self, alert_service):
        """Test resolve SKU threshold delegates to manager."""
        alert_service.low_stock.resolve_sku = AsyncMock(return_value=[])
        
        result = await alert_service.resolve_sku_threshold("S1", 5, 10)
        
        alert_service.low_stock.resolve_sku.assert_called_once_with("S1", 5, 10)

    @pytest.mark.asyncio
    async def test_build_alerts_query(self, alert_service):
        """Test building alerts query."""
        user = MagicMock(spec=User)
        alert_service.repo.build_alerts_query = AsyncMock(return_value=MagicMock())
        
        query = await alert_service.build_alerts_query(user, read_filter="unread")
        
        assert query is not None
        alert_service.repo.build_alerts_query.assert_called_once()

    def test_to_response(self, alert_service):
        """Test converting alert to response."""
        alert = Alert(
            id=uuid7(),
            org_id=uuid7(),
            alert_type=AlertType.LOW_STOCK.value,
            severity=AlertSeverity.WARNING.value,
            title="Test Alert",
            message="Test",
            aggregation_key="key",
            alert_metadata={}
        )
        
        response = alert_service.to_response(alert, is_read=True)
        
        assert response.id == alert.id
        assert response.is_read is True
        
        
# ============================================================================
# Alert Transformer Tests
# ============================================================================
class TestAlertTransformer:
    """Tests the AlertTransformer."""
    @pytest.fixture
    def mock_service(self):
        return AsyncMock(spec=AlertService)

    @pytest.fixture
    def sample_alerts(self):
        org_id = uuid7()
        return [
            Alert(
                id=uuid7(),
                org_id=org_id,
                alert_type=AlertType.LOW_STOCK.value,
                severity=AlertSeverity.CRITICAL.value,
                title="5 SKUs need reordering",
                message="5 SKUs • 2 out of stock",
                aggregation_key=f"low_stock_{date.today().isoformat()}",
                alert_metadata={'sku_codes': ['S1', 'S2']}
            ),
            Alert(
                id=uuid7(),
                org_id=org_id,
                alert_type=AlertType.TEAM_MEMBER_JOINED.value,
                severity=AlertSeverity.INFO.value,
                title="John Doe joined the team",
                message=None,
                aggregation_key=None,
                alert_metadata={}
            )
        ]

    @pytest.mark.asyncio
    async def test_transformer_empty_list(self, mock_service):
        """Test transformer with empty list."""
        transformer = AlertTransformer(mock_service, uuid7())
        
        result = await transformer([])
        
        assert result == []
        mock_service.get_read_status_map.assert_not_called()

    @pytest.mark.asyncio
    async def test_transformer_all_read(self, mock_service, sample_alerts):
        """Test transformer with all read alerts."""
        user_id = uuid7()
        alert_ids = {alert.id for alert in sample_alerts}
        
        mock_service.get_read_status_map.return_value = alert_ids
        mock_service.to_response.side_effect = lambda alert, is_read: MagicMock(
            id=alert.id, is_read=is_read
        )
        
        transformer = AlertTransformer(mock_service, user_id)
        results = await transformer(sample_alerts)
        
        assert len(results) == 2
        assert all(r.is_read for r in results)

    @pytest.mark.asyncio
    async def test_transformer_mixed_status(self, mock_service, sample_alerts):
        """Test transformer with mixed read status."""
        user_id = uuid7()
        read_id = sample_alerts[0].id
        
        mock_service.get_read_status_map.return_value = {read_id}
        mock_service.to_response.side_effect = lambda alert, is_read: MagicMock(
            id=alert.id, is_read=is_read
        )
        
        transformer = AlertTransformer(mock_service, user_id)
        results = await transformer(sample_alerts)
        
        assert results[0].is_read is True
        assert results[1].is_read is False
        
        
# ============================================================================
# Edge Cases and Boundary Tests
# ============================================================================
class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""
    def test_severity_with_zero_reorder_point(self):
        """Test zero reorder point doesn't cause errors."""
        analyzer = StockAnalyzer()
        items = [
            LowStockItem(sku_code="S1", sku_name="Item", available=0, reorder_point=0)
        ]
        
        # Out of stock is critical regardless
        assert analyzer.calculate_severity(items) == AlertSeverity.CRITICAL

    def test_severity_with_large_numbers(self):
        """Test with very large inventory numbers."""
        analyzer = StockAnalyzer()
        items = [
            LowStockItem(sku_code="S1", sku_name="Item", available=1_000_000, reorder_point=10_000_000)
        ]
        
        # 1M / 10M = 10% < 25% = critical
        assert analyzer.calculate_severity(items) == AlertSeverity.CRITICAL

    def test_severity_with_floating_point(self):
        """Test with decimal values."""
        analyzer = StockAnalyzer()
        items = [
            LowStockItem(sku_code="S1", sku_name="Item", available=2.49, reorder_point=10.0)
        ]
        
        # 2.49 / 10 = 24.9% < 25% = critical
        assert analyzer.calculate_severity(items) == AlertSeverity.CRITICAL

    def test_aggregation_key_format(self):
        """Test aggregation key format."""
        manager = LowStockAlertManager(AsyncMock())
        key = manager._build_aggregation_key()
        
        assert key.startswith("low_stock_")
        assert date.today().isoformat() in key
        