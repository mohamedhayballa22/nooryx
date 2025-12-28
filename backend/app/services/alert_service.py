"""
Alert Management System
======================

A robust, maintainable alert service with intelligent message generation,
proper separation of concerns, and efficient database operations.

Features:
- Smart, context-aware alert messaging
- Daily aggregation of low stock alerts
- User-scoped read status tracking
"""

from typing import Optional, Literal
from datetime import date, datetime, timezone
from uuid import UUID
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, exists, and_
from sqlalchemy.orm.attributes import flag_modified

from app.models import Alert, AlertReadReceipt, UserSettings, User, SKU
from app.schemas.alerts import (
    LowStockItem,
    LowStockMetadata,
    TeamMemberJoinedMetadata,
    AlertResponse,
    LowStockItemDetail
)


class AlertType(str, Enum):
    """Alert type identifiers."""
    TEAM_MEMBER_JOINED = "team_member_joined"
    LOW_STOCK = "low_stock"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class StockStatus(str, Enum):
    """Stock availability states for intelligent messaging."""
    OUT_OF_STOCK = "out_of_stock"          # 0 units
    CRITICALLY_LOW = "critically_low"      # < 25% of reorder point
    BELOW_REORDER = "below_reorder"        # < reorder point but > 25%


# Critical severity threshold: less than 25% of reorder point
CRITICAL_STOCK_PERCENTAGE = 25


# ============================================================================
# Stock Analysis
# ============================================================================

class StockAnalyzer:
    """
    Analyzes inventory levels and provides intelligent categorization.
    
    Determines severity and status based on available quantity vs reorder point.
    """
    
    @staticmethod
    def analyze_item(available: int, reorder_point: int) -> StockStatus:
        """
        Determine stock status for a single item.
        
        Args:
            available: Current available quantity
            reorder_point: Configured reorder threshold
            
        Returns:
            Stock status classification
        """
        if available <= 0:
            return StockStatus.OUT_OF_STOCK
        
        if reorder_point > 0:
            percentage = (available / reorder_point) * 100
            if percentage < CRITICAL_STOCK_PERCENTAGE:
                return StockStatus.CRITICALLY_LOW
        
        return StockStatus.BELOW_REORDER
    
    @staticmethod
    def calculate_severity(items: list[LowStockItem]) -> AlertSeverity:
        """
        Calculate overall alert severity from multiple items.
        
        Critical if ANY item is out of stock or critically low.
        Otherwise warning.
        
        Args:
            items: List of low stock items
            
        Returns:
            Overall severity level
        """
        for item in items:
            status = StockAnalyzer.analyze_item(item.available, item.reorder_point)
            if status in (StockStatus.OUT_OF_STOCK, StockStatus.CRITICALLY_LOW):
                return AlertSeverity.CRITICAL
        
        return AlertSeverity.WARNING
    
    @staticmethod
    def categorize_items(items: list[LowStockItem]) -> dict[StockStatus, list[LowStockItem]]:
        """
        Group items by their stock status.
        
        Args:
            items: List of items to categorize
            
        Returns:
            Dictionary mapping status to items
        """
        categories: dict[StockStatus, list[LowStockItem]] = {
            StockStatus.OUT_OF_STOCK: [],
            StockStatus.CRITICALLY_LOW: [],
            StockStatus.BELOW_REORDER: []
        }
        
        for item in items:
            status = StockAnalyzer.analyze_item(item.available, item.reorder_point)
            categories[status].append(item)
        
        return categories


# ============================================================================
# Intelligent Message Generation
# ============================================================================

class AlertMessageGenerator:
    """
    Generates context-aware, intelligent alert messages.
    
    Messages adapt to:
    - Number of items affected
    - Severity of the situation
    - Type of update (new items, status changes)
    - Stock status distribution
    """
    
    @staticmethod
    def generate_low_stock_title(count: int) -> str:
        """
        Generate concise, scannable title.
        
        Args:
            count: Number of SKUs needing attention
            
        Returns:
            Human-readable title
        """
        if count == 1:
            return "1 SKU needs reordering"
        return f"{count} SKUs need reordering"
    
    @staticmethod
    def generate_low_stock_message(
        items: list[LowStockItem],
        new_count: int = 0,
        is_update: bool = False
    ) -> str:
        """
        Generate intelligent, context-aware message for low stock alerts.
        
        Message adapts to:
        - Single vs multiple items
        - New items added vs existing items updated
        - Stock status distribution (out of stock, critical, warning)
        
        Args:
            items: All items in the alert
            new_count: Number of newly added items (0 if creating new alert)
            is_update: Whether this is an update to existing alert
            
        Returns:
            Contextual message string
        """
        total = len(items)
        categories = StockAnalyzer.categorize_items(items)
        
        out_of_stock = len(categories[StockStatus.OUT_OF_STOCK])
        critically_low = len(categories[StockStatus.CRITICALLY_LOW])
        
        # Single item - use item name for clarity
        if total == 1:
            item = items[0]
            if item.available <= 0:
                return f"{item.sku_name} is out of stock"
            elif StockAnalyzer.analyze_item(item.available, item.reorder_point) == StockStatus.CRITICALLY_LOW:
                return f"{item.sku_name} is critically low ({int(item.available)} left)"
            else:
                return f"{item.sku_name} is below reorder point"
        
        # Multiple items - intelligent summary
        parts = []
        
        # If this is an update with new items
        if is_update and new_count > 0:
            if new_count == 1:
                parts.append(f"1 additional SKU")
            else:
                parts.append(f"{new_count} additional SKUs")
            parts.append(f"({total} total)")
        else:
            # New alert or update without new items
            parts.append(f"{total} SKUs")
        
        # Status indicators - prioritize most severe
        status_parts = []
        
        if out_of_stock > 0:
            if out_of_stock == 1:
                status_parts.append("1 out of stock")
            else:
                status_parts.append(f"{out_of_stock} out of stock")
        
        if critically_low > 0:
            if critically_low == 1:
                status_parts.append("1 critically low")
            else:
                status_parts.append(f"{critically_low} critically low")
        
        # If no critical issues, give general status
        if not status_parts:
            if total <= 3:
                status_parts.append("action needed soon")
            else:
                status_parts.append("need reordering")
        
        # Combine parts
        message = " ".join(parts)
        if status_parts:
            message += " • " + ", ".join(status_parts)
        
        return message
    
    @staticmethod
    def generate_team_member_title(first_name: str, last_name: str) -> str:
        """Generate title for team member join alert."""
        return f"{first_name} {last_name} joined the team"


# ============================================================================
# Database Operations
# ============================================================================

class AlertRepository:
    """
    Handles all database operations for alerts.
    
    Provides clean abstraction over SQLAlchemy queries.
    """
    
    def __init__(self, session: AsyncSession, org_id: UUID):
        self.session = session
        self.org_id = org_id
    
    async def get_alert_by_aggregation_key(self, key: str) -> Optional[Alert]:
        """Fetch alert by aggregation key with row lock."""
        result = await self.session.execute(
            select(Alert)
            .filter(
                Alert.org_id == self.org_id,
                Alert.aggregation_key == key
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()
    
    async def get_alerts_containing_sku(self, sku_code: str) -> list[Alert]:
        """
        Find all low stock alerts containing a specific SKU.
        
        Uses JSON containment check on sku_codes array.
        """
        result = await self.session.execute(
            select(Alert)
            .filter(
                Alert.org_id == self.org_id,
                Alert.alert_type == AlertType.LOW_STOCK.value,
                Alert.alert_metadata["sku_codes"].astext.contains(f'"{sku_code}"')
            )
            .with_for_update()
        )
        return list(result.scalars().all())
    
    async def get_sku_config(self, sku_code: str) -> Optional[tuple[int, bool, str]]:
        """
        Fetch SKU configuration.
        
        Returns:
            Tuple of (reorder_point, alerts_enabled, sku_name) or None
        """
        result = await self.session.execute(
            select(SKU.reorder_point, SKU.alerts, SKU.name)
            .filter(
                SKU.code == sku_code,
                SKU.org_id == self.org_id
            )
        )
        return result.one_or_none()
    
    async def count_users_with_alerts_enabled(self) -> tuple[int, int]:
        """
        Count total users and users with alerts disabled.
        
        Returns:
            Tuple of (total_users, users_with_alerts_disabled)
        """
        # Total users in org
        total_result = await self.session.execute(
            select(func.count(User.id))
            .filter(User.org_id == self.org_id)
        )
        total = total_result.scalar()
        
        # Users who explicitly disabled alerts
        disabled_result = await self.session.execute(
            select(func.count(UserSettings.user_id))
            .select_from(UserSettings)
            .join(User, User.id == UserSettings.user_id)
            .filter(
                User.org_id == self.org_id,
                UserSettings.alerts == False
            )
        )
        disabled = disabled_result.scalar()
        
        return total, disabled
    
    async def delete_read_receipts(self, alert_id: UUID) -> None:
        """Delete all read receipts for an alert."""
        await self.session.execute(
            delete(AlertReadReceipt)
            .filter(AlertReadReceipt.alert_id == alert_id)
        )
    
    async def create_alert(self, alert: Alert) -> Alert:
        """Add alert to session and flush."""
        self.session.add(alert)
        await self.session.flush()
        return alert
    
    async def delete_alert(self, alert: Alert) -> None:
        """Delete an alert."""
        await self.session.delete(alert)
    
    async def get_read_alert_ids(self, alert_ids: list[UUID], user_id: UUID) -> set[UUID]:
        """Get set of alert IDs that user has read."""
        if not alert_ids:
            return set()
        
        result = await self.session.execute(
            select(AlertReadReceipt.alert_id)
            .filter(
                AlertReadReceipt.alert_id.in_(alert_ids),
                AlertReadReceipt.user_id == user_id
            )
        )
        return set(result.scalars().all())
    
    async def verify_alert_exists(self, alert_id: UUID) -> bool:
        """Check if alert exists in this org."""
        result = await self.session.execute(
            select(Alert.id)
            .filter(
                Alert.id == alert_id,
                Alert.org_id == self.org_id
            )
        )
        return result.scalar_one_or_none() is not None
    
    async def get_read_receipt(self, alert_id: UUID, user_id: UUID) -> Optional[AlertReadReceipt]:
        """Get existing read receipt."""
        result = await self.session.execute(
            select(AlertReadReceipt)
            .filter(
                AlertReadReceipt.alert_id == alert_id,
                AlertReadReceipt.user_id == user_id
            )
        )
        return result.scalar_one_or_none()
    
    async def create_read_receipt(self, alert_id: UUID, user_id: UUID) -> AlertReadReceipt:
        """Create and flush read receipt."""
        receipt = AlertReadReceipt(alert_id=alert_id, user_id=user_id)
        self.session.add(receipt)
        await self.session.flush()
        return receipt
    
    async def get_unread_alert_ids(self, user: User) -> list[UUID]:
        """Get all unread alert IDs for user."""
        result = await self.session.execute(
            select(Alert.id)
            .filter(
                Alert.org_id == self.org_id,
                Alert.created_at >= user.created_at,
                ~self._build_user_joined_filter(user.id),
                ~self._build_has_read_receipt_filter(user.id)
            )
        )
        return list(result.scalars().all())
    
    async def bulk_create_read_receipts(self, alert_ids: list[UUID], user_id: UUID) -> int:
        """Bulk insert read receipts."""
        receipts = [
            AlertReadReceipt(alert_id=alert_id, user_id=user_id)
            for alert_id in alert_ids
        ]
        self.session.add_all(receipts)
        await self.session.flush()
        return len(receipts)
    
    def _build_user_joined_filter(self, user_id: UUID):
        """Build filter to exclude user's own join alerts."""
        return and_(
            Alert.alert_type == AlertType.TEAM_MEMBER_JOINED.value,
            Alert.alert_metadata["user_id"].astext == str(user_id)
        )
    
    def _build_has_read_receipt_filter(self, user_id: UUID):
        """Build exists subquery for read receipts."""
        return exists(
            select(1)
            .select_from(AlertReadReceipt)
            .filter(
                AlertReadReceipt.alert_id == Alert.id,
                AlertReadReceipt.user_id == user_id
            )
        )
    
    async def build_alerts_query(
        self,
        user: User,
        read_filter: Optional[Literal["read", "unread"]] = None,
        alert_type: Optional[Literal["team_member_joined", "low_stock"]] = None,
    ):
        """
        Build paginated alerts query with filters.
        
        Automatically excludes:
        - Alerts created before user joined
        - User's own "team_member_joined" alert
        """
        query = (
            select(Alert)
            .filter(
                Alert.org_id == self.org_id,
                Alert.created_at >= user.created_at,
                ~self._build_user_joined_filter(user.id)
            )
        )
        
        # Type filter
        if alert_type:
            query = query.filter(Alert.alert_type == alert_type)
        
        # Read status filter
        if read_filter == "read":
            query = query.filter(self._build_has_read_receipt_filter(user.id))
        elif read_filter == "unread":
            query = query.filter(~self._build_has_read_receipt_filter(user.id))
        
        return query.order_by(Alert.created_at.desc())
    
    async def get_unread_count(self, user: User) -> int:
        """Get count of unread alerts for user."""
        result = await self.session.execute(
            select(func.count())
            .select_from(Alert)
            .filter(
                Alert.org_id == self.org_id,
                Alert.created_at >= user.created_at,
                ~self._build_user_joined_filter(user.id),
                ~self._build_has_read_receipt_filter(user.id)
            )
        )
        return result.scalar_one()


# ============================================================================
# Low Stock Alert Manager
# ============================================================================

class LowStockAlertManager:
    """
    Manages low stock alert lifecycle: creation, updates, and resolution.
    
    Handles daily aggregation and intelligent message generation.
    """
    
    def __init__(self, repo: AlertRepository):
        self.repo = repo
        self.analyzer = StockAnalyzer()
        self.messages = AlertMessageGenerator()
    
    async def create_or_update(self, items: list[LowStockItem]) -> Alert:
        """
        Create new or update existing daily low stock alert.
        
        Intelligence:
        - Aggregates all low stock items into single daily alert
        - Merges new items or updates existing ones
        - Recalculates severity dynamically
        - Generates context-aware messages
        - Marks as unread for all users when updated
        
        Args:
            items: SKUs that need attention
            
        Returns:
            Created or updated alert
            
        Raises:
            ValueError: If items list is empty
        """
        if not items:
            raise ValueError("Cannot create alert without items")
        
        aggregation_key = self._build_aggregation_key()
        existing = await self.repo.get_alert_by_aggregation_key(aggregation_key)
        
        if existing:
            return await self._update_existing_alert(existing, items)
        else:
            return await self._create_new_alert(items, aggregation_key)
    
    async def resolve_sku(
        self,
        sku_code: str,
        qty_before: int,
        qty_after: int
    ) -> list[Alert]:
        """
        Remove SKU from alerts if it crossed back above reorder point.
        
        Deletes entire alert if only one SKU, otherwise removes just this SKU.
        
        Args:
            sku_code: SKU that was restocked
            qty_before: Quantity before transaction
            qty_after: Quantity after transaction
            
        Returns:
            List of modified/deleted alerts
        """
        sku_config = await self.repo.get_sku_config(sku_code)
        if not sku_config:
            return []
        
        reorder_point, _, _ = sku_config
        
        # Check if crossed upward
        if not (qty_before < reorder_point <= qty_after):
            return []
        
        alerts = await self.repo.get_alerts_containing_sku(sku_code)
        if not alerts:
            return []
        
        modified = []
        
        for alert in alerts:
            sku_codes = alert.alert_metadata.get('sku_codes', [])
            
            # Verify SKU is actually in alert (avoid false positives)
            if sku_code not in sku_codes:
                continue
            
            # Single SKU alert - delete entirely
            if len(sku_codes) == 1:
                await self.repo.delete_alert(alert)
                modified.append(alert)
                continue
            
            # Multi-SKU alert - remove this SKU
            self._remove_sku_from_alert(alert, sku_code)
            modified.append(alert)
        
        await self.repo.session.flush()
        return modified
    
    async def check_threshold_crossed(
        self,
        sku_code: str,
        qty_before: int,
        qty_after: int
    ) -> Optional[Alert]:
        """
        Check if SKU crossed below reorder point and create/update alert.
        
        Only creates alert if:
        1. SKU has alerts enabled
        2. At least one user has alerts enabled
        3. Quantity crossed downward below reorder point OR went out of stock
        
        Args:
            sku_code: SKU to check
            qty_before: Quantity before transaction
            qty_after: Quantity after transaction
            
        Returns:
            Alert if created/updated, None otherwise
        """
        sku_config = await self.repo.get_sku_config(sku_code)
        if not sku_config:
            return None
        
        reorder_point, alerts_enabled, sku_name = sku_config
        
        # Check prerequisites
        if not alerts_enabled:
            return None
        
        if not await self._any_user_has_alerts_enabled():
            return None
        
        # Check if threshold crossed or went out of stock
        crossed_downward = (qty_before >= reorder_point > qty_after)
        went_out_of_stock = (qty_before > 0 and qty_after == 0)
        
        if not (crossed_downward or went_out_of_stock):
            return None
        
        # Create alert item
        item = LowStockItem(
            sku_code=sku_code,
            sku_name=sku_name,
            available=qty_after,
            reorder_point=reorder_point
        )
        
        return await self.create_or_update([item])
    
    # Private methods
    
    def _build_aggregation_key(self) -> str:
        """Build today's aggregation key."""
        return f"low_stock_{date.today().isoformat()}"
    
    async def _any_user_has_alerts_enabled(self) -> bool:
        """Check if at least one user has alerts enabled."""
        total, disabled = await self.repo.count_users_with_alerts_enabled()
        return disabled < total
    
    async def _create_new_alert(self, items: list[LowStockItem], key: str) -> Alert:
        """Create new daily alert."""
        severity = self.analyzer.calculate_severity(items)
        
        metadata = LowStockMetadata(
            sku_codes=[item.sku_code for item in items],
            details=[
                LowStockItemDetail(
                    sku_code=item.sku_code,
                    sku_name=item.sku_name,
                    available=item.available,
                    reorder_point=item.reorder_point
                )
                for item in items
            ],
            check_timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        alert = Alert(
            org_id=self.repo.org_id,
            alert_type=AlertType.LOW_STOCK.value,
            severity=severity.value,
            title=self.messages.generate_low_stock_title(len(items)),
            message=self.messages.generate_low_stock_message(items),
            aggregation_key=key,
            alert_metadata=metadata.model_dump(mode='json')
        )
        
        return await self.repo.create_alert(alert)
    
    async def _update_existing_alert(
        self,
        alert: Alert,
        new_items: list[LowStockItem]
    ) -> Alert:
        """Update existing alert with new or updated items."""
        existing_codes = set(alert.alert_metadata.get('sku_codes', []))
        
        # Categorize items
        items_to_add = [item for item in new_items if item.sku_code not in existing_codes]
        items_to_update = [item for item in new_items if item.sku_code in existing_codes]
        
        needs_update = bool(items_to_add or items_to_update)
        
        if not needs_update:
            return alert
        
        # Add new SKUs
        if items_to_add:
            alert.alert_metadata['sku_codes'].extend([item.sku_code for item in items_to_add])
            alert.alert_metadata['details'].extend([
                LowStockItemDetail(
                    sku_code=item.sku_code,
                    sku_name=item.sku_name,
                    available=item.available,
                    reorder_point=item.reorder_point
                ).model_dump(mode='json')
                for item in items_to_add
            ])
        
        # Update existing SKUs
        if items_to_update:
            for item in items_to_update:
                for detail in alert.alert_metadata['details']:
                    if detail['sku_code'] == item.sku_code:
                        detail['available'] = item.available
                        detail['reorder_point'] = item.reorder_point
                        break
        
        # Reconstruct all items for analysis
        all_items = [
            LowStockItem(
                sku_code=d['sku_code'],
                sku_name=d['sku_name'],
                available=d['available'],
                reorder_point=d['reorder_point']
            )
            for d in alert.alert_metadata['details']
        ]
        
        # Recalculate severity and generate message
        alert.severity = self.analyzer.calculate_severity(all_items).value
        alert.title = self.messages.generate_low_stock_title(len(all_items))
        alert.message = self.messages.generate_low_stock_message(
            all_items,
            new_count=len(items_to_add),
            is_update=True
        )
        alert.alert_metadata['check_timestamp'] = datetime.now(timezone.utc).isoformat()
        
        # Mark as modified for SQLAlchemy
        flag_modified(alert, "alert_metadata")
        
        # Reset read status - everyone needs to see the update
        await self.repo.delete_read_receipts(alert.id)
        
        return alert
    
    def _remove_sku_from_alert(self, alert: Alert, sku_code: str) -> None:
        """Remove SKU from multi-item alert and recalculate."""
        # Remove from codes list
        alert.alert_metadata['sku_codes'].remove(sku_code)
        
        # Remove from details
        alert.alert_metadata['details'] = [
            d for d in alert.alert_metadata['details']
            if d['sku_code'] != sku_code
        ]
        
        # Rebuild items and recalculate
        remaining_items = [
            LowStockItem(
                sku_code=d['sku_code'],
                sku_name=d['sku_name'],
                available=d['available'],
                reorder_point=d['reorder_point']
            )
            for d in alert.alert_metadata['details']
        ]
        
        alert.severity = self.analyzer.calculate_severity(remaining_items).value
        alert.title = self.messages.generate_low_stock_title(len(remaining_items))
        alert.message = self.messages.generate_low_stock_message(remaining_items)
        alert.alert_metadata['check_timestamp'] = datetime.now(timezone.utc).isoformat()
        
        flag_modified(alert, "alert_metadata")


# ============================================================================
# Read Status Manager
# ============================================================================

class ReadStatusManager:
    """
    Manages alert read/unread status per user.
    
    Provides efficient bulk operations and status tracking.
    """
    
    def __init__(self, repo: AlertRepository):
        self.repo = repo
    
    async def mark_read(self, alert_id: UUID, user_id: UUID) -> bool:
        """
        Mark alert as read for user.
        
        Args:
            alert_id: Alert to mark
            user_id: User marking the alert
            
        Returns:
            True if newly marked, False if already read
            
        Raises:
            ValueError: If alert doesn't exist
        """
        if not await self.repo.verify_alert_exists(alert_id):
            raise ValueError(f"Alert {alert_id} not found in organization")
        
        existing = await self.repo.get_read_receipt(alert_id, user_id)
        if existing:
            return False
        
        await self.repo.create_read_receipt(alert_id, user_id)
        return True
    
    async def mark_all_read(self, user: User) -> int:
        """
        Mark all alerts as read for user.
        
        Returns:
            Number of alerts marked
        """
        unread_ids = await self.repo.get_unread_alert_ids(user)
        if not unread_ids:
            return 0
        
        return await self.repo.bulk_create_read_receipts(unread_ids, user.id)
    
    async def get_read_status_map(self, alert_ids: list[UUID], user_id: UUID) -> set[UUID]:
        """
        Get set of read alert IDs.
        
        Used for batch status checking in pagination.
        """
        return await self.repo.get_read_alert_ids(alert_ids, user_id)


# ============================================================================
# Main Service
# ============================================================================

class AlertService:
    """
    Main alert service.
    
    Orchestrates repository, managers, and message generation.
    """
    
    def __init__(self, session: AsyncSession, org_id: UUID):
        self.session = session
        self.org_id = org_id
        
        # Initialize components
        self.repo = AlertRepository(session, org_id)
        self.low_stock = LowStockAlertManager(self.repo)
        self.read_status = ReadStatusManager(self.repo)
        self.messages = AlertMessageGenerator()
    
    # ========================================================================
    # Public API (for other services)
    # ========================================================================
    
    async def create_team_member_alert(
        self,
        user_id: UUID,
        first_name: str,
        last_name: str,
        email: str,
        role: str
    ) -> Alert:
        """
        Create alert for new team member.
        """
        metadata = TeamMemberJoinedMetadata(
            user_id=user_id,
            user_name=f"{first_name} {last_name}",
            user_email=email,
            role=role
        )
        
        alert = Alert(
            org_id=self.org_id,
            alert_type=AlertType.TEAM_MEMBER_JOINED.value,
            severity=AlertSeverity.INFO.value,
            title=self.messages.generate_team_member_title(first_name, last_name),
            message=None,
            aggregation_key=None,
            alert_metadata=metadata.model_dump(mode='json')
        )
        
        return await self.repo.create_alert(alert)
    
    async def check_sku_crossed_threshold(
        self,
        sku_code: str,
        qty_before: int,
        qty_after: int
    ) -> Optional[Alert]:
        """
        Check if SKU crossed threshold and create/update alert if needed.
        """
        return await self.low_stock.check_threshold_crossed(
            sku_code,
            qty_before,
            qty_after
        )
    
    async def resolve_sku_threshold(
        self,
        sku_code: str,
        qty_before: int,
        qty_after: int
    ) -> list[Alert]:
        """Resolve alerts if SKU crossed back above reorder point."""
        return await self.low_stock.resolve_sku(
            sku_code,
            qty_before,
            qty_after
        )

    # ========================================================================
    # Router API Methods
    # ========================================================================

    async def build_alerts_query(
        self,
        user: User,
        read_filter: Optional[Literal["read", "unread"]] = None,
        alert_type: Optional[Literal["team_member_joined", "low_stock"]] = None,
    ):
        """Build query for paginated alerts listing."""
        return await self.repo.build_alerts_query(user, read_filter, alert_type)

    async def get_read_status_map(self, alert_ids: list[UUID], user_id: UUID) -> set[UUID]:
        """Get set of read alert IDs for batch status checking."""
        return await self.read_status.get_read_status_map(alert_ids, user_id)

    def to_response(self, alert: Alert, is_read: bool) -> AlertResponse:
        """Convert Alert model to API response."""
        return AlertResponse(
            id=alert.id,
            alert_type=alert.alert_type,
            severity=alert.severity,
            title=alert.title,
            message=alert.message,
            aggregation_key=alert.aggregation_key,
            alert_metadata=alert.alert_metadata,
            is_read=is_read
        )

    async def get_unread_count(self, user: User) -> int:
        """Get unread alert count for sidebar badge."""
        return await self.repo.get_unread_count(user)

    async def mark_as_read(self, alert_id: UUID, user_id: UUID) -> bool:
        """Mark single alert as read."""
        return await self.read_status.mark_read(alert_id, user_id)

    async def mark_all_as_read(self, user: User) -> int:
        """Mark all alerts as read."""
        return await self.read_status.mark_all_read(user)
    

# ============================================================================
# Transformer
# ============================================================================
class AlertTransformer:
    """
    Pagination transformer that enriches alerts with read status.
    
    """

    def __init__(self, alert_service: AlertService, user_id: UUID):
        self.alert_service = alert_service
        self.user_id = user_id

    async def __call__(self, alerts: list[Alert]) -> list[AlertResponse]:
        """Transform alerts to responses with read status."""
        if not alerts:
            return []
        
        # Batch fetch read status
        alert_ids = [alert.id for alert in alerts]
        read_ids = await self.alert_service.get_read_status_map(alert_ids, self.user_id)
        
        return [
            self.alert_service.to_response(alert, alert.id in read_ids)
            for alert in alerts
        ]
        