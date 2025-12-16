from typing import Optional, Literal
from datetime import date, datetime, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, exists
from sqlalchemy.orm.attributes import flag_modified

from app.models import Alert, AlertReadReceipt, UserSettings, User, SKU
from app.schemas.alerts import (
    LowStockItem,
    LowStockMetadata,
    TeamMemberJoinedMetadata,
    AlertResponse,
    LowStockItemDetail
)


class AlertService:
    """
    Centralized alert creation and management service.
    
    Handles:
    - Team member join notifications
    - Low stock alerts with intelligent daily aggregation
    - User-scoped read status tracking
    - Efficient unread count queries
    """
    
    def __init__(self, session: AsyncSession, org_id: UUID):
        """
        Initialize alert service for a specific organization.
        
        Args:
            session: Async database session
            org_id: Organization ID (tenant isolation)
        """
        self.session = session
        self.org_id = org_id
    
    # ========================================================================
    # Alert Creation
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
        Create alert when a new team member joins the organization.
        
        Args:
            user_id: ID of the newly created user
            first_name: User's first name
            last_name: User's last name
            email: User's email
            role: User's role
            
        Returns:
            Created Alert instance
        """
        user_name = f"{first_name} {last_name}"
        
        metadata = TeamMemberJoinedMetadata(
            user_id=user_id,
            user_name=user_name,
            user_email=email,
            role=role
        )
        
        alert = Alert(
            org_id=self.org_id,
            alert_type="team_member_joined",
            severity="info",
            title=f"{user_name} joined the team",
            message=None,
            aggregation_key=None,
            alert_metadata=metadata.model_dump(mode='json')
        )
        
        self.session.add(alert)
        await self.session.flush()
        
        return alert
    
    async def create_or_update_low_stock_alert(
            self,
            low_stock_items: list[LowStockItem]
        ) -> Alert:
        """
        Create new low stock alert or update existing one for today.
        
        Intelligently aggregates all low stock SKUs into a single daily alert.
        If alert already exists for today, merges new items and marks as unread
        for all users by deleting existing read receipts.
        
        Args:
            low_stock_items: List of SKUs that have fallen below reorder point
            
        Returns:
            Created or updated Alert instance
            
        Raises:
            ValueError: If low_stock_items is empty
        """
        if not low_stock_items:
            raise ValueError("Cannot create low stock alert with empty items list")
        
        today = date.today()
        aggregation_key = f"low_stock_{today.isoformat()}"
        
        # Check for existing alert today
        result = await self.session.execute(
            select(Alert)
            .filter(
                Alert.org_id == self.org_id,
                Alert.aggregation_key == aggregation_key
            )
            .with_for_update()
        )
        existing_alert = result.scalar_one_or_none()
        
        if existing_alert:
            # UPDATE: Merge new items OR update existing items
            existing_codes = set(existing_alert.alert_metadata.get('sku_codes', []))
            new_items = [
                item for item in low_stock_items 
                if item.sku_code not in existing_codes
            ]
            updated_items = [
                item for item in low_stock_items
                if item.sku_code in existing_codes
            ]
            
            needs_update = False
            
            # Add completely new items
            if new_items:
                needs_update = True
                # Add new SKU codes
                existing_alert.alert_metadata['sku_codes'].extend(
                    [item.sku_code for item in new_items]
                )
                
                # Add new details
                existing_alert.alert_metadata['details'].extend([
                    LowStockItemDetail(
                        sku_code=item.sku_code,
                        sku_name=item.sku_name,
                        available=item.available,
                        reorder_point=item.reorder_point,
                    ).model_dump(mode='json')
                    for item in new_items
                ])
            
            # Update existing items (e.g., quantity changed, went out of stock)
            if updated_items:
                needs_update = True
                for item in updated_items:
                    # Find and update the detail
                    for detail in existing_alert.alert_metadata['details']:
                        if detail['sku_code'] == item.sku_code:
                            detail['available'] = item.available
                            detail['reorder_point'] = item.reorder_point
                            break
            
            if needs_update:
                # Recalculate severity for ALL items
                all_items = [
                    LowStockItem(
                        sku_code=detail['sku_code'],
                        sku_name=detail['sku_name'],
                        available=detail['available'],
                        reorder_point=detail['reorder_point']
                    )
                    for detail in existing_alert.alert_metadata['details']
                ]
                severity = self._calculate_severity(all_items)
                
                # Count out of stock items
                out_of_stock_count = sum(1 for item in all_items if item.available <= 0)
                
                # Update title and metadata
                total_count = len(existing_alert.alert_metadata['sku_codes'])
                existing_alert.title = self._generate_low_stock_title(total_count)
                existing_alert.alert_metadata['check_timestamp'] = datetime.now(timezone.utc).isoformat()
                existing_alert.severity = severity
                
                # Generate message based on update state
                new_count = len(new_items)
                
                # Use out of stock info if present, otherwise use severity label
                if out_of_stock_count > 0:
                    status_label = f"{out_of_stock_count} out of stock"
                else:
                    status_label = "Critically low" if severity == "critical" else "Action needed soon"
                
                if new_count == 1:
                    existing_alert.message = f"1 additional SKU below reorder point ({total_count} total) • {status_label}"
                elif new_count > 1:
                    existing_alert.message = f"{new_count} additional SKUs below reorder point ({total_count} total) • {status_label}"
                else:
                    # Only updates to existing items (e.g., went out of stock)
                    existing_alert.message = f"{total_count} SKU{'s' if total_count != 1 else ''} below reorder points • {status_label}"
                
                # Mark as modified for SQLAlchemy
                flag_modified(existing_alert, "alert_metadata")
                
                # Delete all read receipts to mark as unread for everyone
                await self.session.execute(
                    delete(AlertReadReceipt)
                    .filter(AlertReadReceipt.alert_id == existing_alert.id)
                )
            
            return existing_alert
        
        else:
            # CREATE: New alert for today
            severity = self._calculate_severity(low_stock_items)
            
            metadata = LowStockMetadata(
                sku_codes=[item.sku_code for item in low_stock_items],
                details=[
                    LowStockItemDetail(
                        sku_code=item.sku_code,
                        sku_name=item.sku_name,
                        available=item.available,
                        reorder_point=item.reorder_point,
                    )
                    for item in low_stock_items
                ],
                check_timestamp=datetime.now(timezone.utc).isoformat()
            )
            
            # Generate message for new alert
            item_count = len(low_stock_items)
            if item_count == 1:
                message = f"{low_stock_items[0].sku_name} is below reorder point"
            else:
                severity_label = "Critically low stock" if severity == "critical" else "Action needed soon"
                message = f"{item_count} SKUs below reorder points • {severity_label}"
            
            alert = Alert(
                org_id=self.org_id,
                alert_type="low_stock",
                severity=severity,
                title=self._generate_low_stock_title(len(low_stock_items)),
                message=message,
                aggregation_key=aggregation_key,
                alert_metadata=metadata.model_dump(mode='json')
            )
            
            self.session.add(alert)
            await self.session.flush()
            
            return alert

    def _calculate_severity(self, items: list[LowStockItem]) -> Literal["warning", "critical"]:
        """
        Calculate alert severity based on how far below reorder point items are.
        
        Critical if ANY item meets these conditions:
        - Completely out of stock (available <= 0)
        - Less than 25% of reorder point remains
        
        Otherwise warning.
        
        Args:
            items: List of low stock items to evaluate
            
        Returns:
            "critical" or "warning"
        """
        for item in items:
            # Out of stock is always critical
            if item.available <= 0:
                return "critical"
            
            # Avoid division by zero for edge case of reorder_point = 0
            if item.reorder_point > 0:
                percentage_remaining = (item.available / item.reorder_point) * 100
                
                # Less than 25% of reorder point is critical
                if percentage_remaining < 25:
                    return "critical"
        
        return "warning"
    
    # ========================================================================
    # Alert Resolution
    # ========================================================================
    
    async def resolve_sku_threshold(
        self, 
        sku_code: str,
        qty_before: int,
        qty_after: int
    ) -> list[Alert]:
        """
        Resolve a low stock alert if SKU just crossed back above its reorder point.
        
        Only resolves alert if:
        1. Available was < reorder_point before transaction
        2. Available is >= reorder_point after transaction
        
        Finds ALL low stock alerts containing this SKU and either:
        - Deletes the entire alert if it only contains this SKU
        - Removes this SKU from alerts containing multiple SKUs
        
        Args:
            sku_code: SKU to check
            qty_before: Available quantity across all locations before transaction
            qty_after: Available quantity across all locations after transaction
            
        Returns:
            List of updated/deleted Alerts that were affected
        """
        # Fetch SKU configuration
        result = await self.session.execute(
            select(SKU.reorder_point)
            .filter(
                SKU.code == sku_code,
                SKU.org_id == self.org_id
            )
        )
        reorder_point = result.scalar_one_or_none()
        
        if reorder_point is None:
            return []
        
        # Check if reorder point was crossed upward in this transaction
        crossed_upward = (qty_before < reorder_point and qty_after >= reorder_point)
        
        if not crossed_upward:
            return []
        
        # Find ALL low stock alerts containing this SKU
        result = await self.session.execute(
            select(Alert)
            .filter(
                Alert.org_id == self.org_id,
                Alert.alert_type == "low_stock",
                Alert.alert_metadata["sku_codes"].astext.contains(f'"{sku_code}"')
            )
            .with_for_update()
        )
        affected_alerts = result.scalars().all()
        
        if not affected_alerts:
            return []
        
        modified_alerts = []
        
        for alert in affected_alerts:
            sku_codes = alert.alert_metadata.get('sku_codes', [])
            
            # Skip if this SKU isn't actually in the alert (false positive from contains)
            if sku_code not in sku_codes:
                continue
            
            # If only one SKU in alert, delete entire alert
            if len(sku_codes) == 1:
                await self.session.delete(alert)
                modified_alerts.append(alert)
                continue
            
            # Remove this SKU from the alert
            alert.alert_metadata['sku_codes'].remove(sku_code)
            
            # Remove from details
            alert.alert_metadata['details'] = [
                detail for detail in alert.alert_metadata['details']
                if detail['sku_code'] != sku_code
            ]
            
            # Update title
            remaining_count = len(alert.alert_metadata['sku_codes'])
            alert.title = self._generate_low_stock_title(remaining_count)
            
            # Recalculate severity from remaining items
            remaining_items = [
                LowStockItem(
                    sku_code=detail['sku_code'],
                    sku_name=detail['sku_name'],
                    available=detail['available'],
                    reorder_point=detail['reorder_point']
                )
                for detail in alert.alert_metadata['details']
            ]
            alert.severity = self._calculate_severity(remaining_items)
            
            # Update timestamp
            alert.alert_metadata['check_timestamp'] = datetime.now(timezone.utc).isoformat()
            
            # Mark as modified for SQLAlchemy
            flag_modified(alert, "alert_metadata")
            
            modified_alerts.append(alert)
        
        await self.session.flush()
        
        return modified_alerts
    
    # ========================================================================
    # Alert Querying
    # ========================================================================
    
    async def build_alerts_query(
        self,
        user: User,
        read_filter: Optional[Literal["read", "unread"]] = None,
        alert_type: Optional[Literal["team_member_joined", "low_stock"]] = None,
    ):
        """
        Build SQLAlchemy query for alerts with filters applied.

        Args:
            user: User requesting the alerts
            read_filter: Filter by read status (None = all)
            alert_type: Filter by alert type (None = all)

        Returns:
            SQLAlchemy select query ready for pagination
        """
        query = (
            select(Alert)
            .filter(Alert.org_id == self.org_id)
            .filter(Alert.created_at >= user.created_at)
        )

        # Optional type filter
        if alert_type:
            query = query.filter(Alert.alert_type == alert_type)

        # Read/unread filter
        if read_filter == "read":
            query = query.filter(
                exists(
                    select(1)
                    .select_from(AlertReadReceipt)
                    .filter(
                        AlertReadReceipt.alert_id == Alert.id,
                        AlertReadReceipt.user_id == user.id
                    )
                )
            )
        elif read_filter == "unread":
            query = query.filter(
                ~exists(
                    select(1)
                    .select_from(AlertReadReceipt)
                    .filter(
                        AlertReadReceipt.alert_id == Alert.id,
                        AlertReadReceipt.user_id == user.id
                    )
                )
            )

        # Exclude "team_member_joined" alerts for the user *who* joined
        query = query.filter(
            ~(
                (Alert.alert_type == "team_member_joined") &
                (Alert.alert_metadata["user_id"].astext == str(user.id))
            )
        )

        return query.order_by(Alert.created_at.desc())


    async def get_read_status_map(
        self,
        alert_ids: list[UUID],
        user_id: UUID
    ) -> set[UUID]:
        """
        Get set of alert IDs that have been read by user.
        
        Args:
            alert_ids: List of alert IDs to check
            user_id: User to check read status for
            
        Returns:
            Set of alert IDs that are read
        """
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


    def to_response(self, alert: Alert, is_read: bool) -> AlertResponse:
        """
        Convert Alert model to AlertResponse.
        
        Args:
            alert: Alert model instance
            is_read: Whether this alert has been read by the user
            
        Returns:
            AlertResponse with read status
        """
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
        """
        Get count of unread alerts for sidebar badge.
        
        Args:
            user: User requesting the count
            
        Returns:
            Number of unread alerts
        """
        result = await self.session.execute(
            select(func.count())
            .select_from(Alert)
            .filter(
                # Only alerts for this org
                Alert.org_id == self.org_id,

                Alert.created_at >= user.created_at,

                # Exclude "team_member_joined" alerts for the user that joined
                ~(
                    (Alert.alert_type == "team_member_joined") &
                    (Alert.alert_metadata["user_id"].astext == str(user.id))
                ),

                # Unread = no read receipt exists for this user
                ~exists(
                    select(1)
                    .select_from(AlertReadReceipt)
                    .filter(
                        AlertReadReceipt.alert_id == Alert.id,
                        AlertReadReceipt.user_id == user.id
                    )
                )
            )
        )
        return result.scalar_one()
    
    # ========================================================================
    # Read Status Management
    # ========================================================================
    
    async def mark_as_read(
        self,
        alert_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Mark a single alert as read for the user.
        
        Args:
            alert_id: Alert to mark as read
            user_id: User marking the alert
            
        Returns:
            True if marked (was unread), False if already read
            
        Raises:
            ValueError: If alert doesn't exist or doesn't belong to user's org
        """
        # Verify alert exists and belongs to user's org
        alert_result = await self.session.execute(
            select(Alert.id)
            .filter(
                Alert.id == alert_id,
                Alert.org_id == self.org_id
            )
        )
        if not alert_result.scalar_one_or_none():
            raise ValueError(f"Alert {alert_id} not found in organization")
        
        # Check if already read
        existing_result = await self.session.execute(
            select(AlertReadReceipt)
            .filter(
                AlertReadReceipt.alert_id == alert_id,
                AlertReadReceipt.user_id == user_id
            )
        )
        if existing_result.scalar_one_or_none():
            return False  # Already read
        
        # Create read receipt
        receipt = AlertReadReceipt(
            alert_id=alert_id,
            user_id=user_id
        )
        self.session.add(receipt)
        await self.session.flush()
        
        return True
    
    async def mark_all_as_read(self, user: User) -> int:
        """
        Mark all alerts as read for the user.
        
        Args:
            user_id: User marking all alerts as read
            
        Returns:
            Number of alerts marked as read
        """
        # Get all unread alert IDs
        unread_result = await self.session.execute(
            select(Alert.id)
            .filter(
                Alert.org_id == self.org_id,
                Alert.created_at >= user.created_at,
                # Exclude team_member_joined for the user who joined
                ~(
                    (Alert.alert_type == "team_member_joined") &
                    (Alert.alert_metadata["user_id"].astext == str(user.id))
                ),
                ~exists( 
                    select(1)
                    .select_from(AlertReadReceipt)
                    .filter(
                        AlertReadReceipt.alert_id == Alert.id,
                        AlertReadReceipt.user_id == user.id
                    )
                )
            )
        )
        unread_alert_ids = unread_result.scalars().all()
        
        if not unread_alert_ids:
            return 0
        
        # Bulk insert read receipts
        receipts = [
            AlertReadReceipt(alert_id=alert_id, user_id=user.id)
            for alert_id in unread_alert_ids
        ]
        self.session.add_all(receipts)
        await self.session.flush()
        
        return len(receipts)
    
    # ========================================================================
    # Low Stock Detection
    # ========================================================================
    
    async def check_sku_crossed_threshold(
        self, 
        sku_code: str,
        qty_before: int,
        qty_after: int
    ) -> Optional[Alert]:
        """
        Check if a specific SKU just crossed its reorder point threshold.
        
        Only creates/updates alert if:
        1. SKU has alerts enabled
        2. At least one user in the organization has alerts enabled
        3. Available across all locations was >= reorder_point before transaction
        4. Available across all locations is < reorder_point after transaction
        
        Args:
            sku_code: SKU to check
            qty_before: Available quantity across all locations before transaction
            qty_after: Available quantity across all locations after transaction
            
        Returns:
            Alert if threshold was crossed, None otherwise
        """
        # Fetch SKU configuration
        result = await self.session.execute(
            select(SKU.reorder_point, SKU.alerts, SKU.name)
            .filter(
                SKU.code == sku_code,
                SKU.org_id == self.org_id
            )
        )
        sku_data = result.one_or_none()
        
        if not sku_data:
            return None
        
        reorder_point, alerts_enabled, sku_name = sku_data
        
        # Check if alerts are disabled for this SKU
        if not alerts_enabled:
            return None
        
        # Check if at least one user in the org has alerts enabled
        result = await self.session.execute(
            select(exists(
                select(1)
                .select_from(UserSettings)
                .join(User, User.id == UserSettings.user_id)
                .filter(
                    User.org_id == self.org_id,
                    UserSettings.alerts == True
                )
            ))
        )
        any_user_has_alerts = result.scalar()
        
        # If no users have alerts enabled, don't create alert
        if not any_user_has_alerts:
            return None
        
        # Check if reorder point was crossed in this transaction OR if item went out of stock
        crossed_threshold = (qty_before >= reorder_point and qty_after < reorder_point)
        went_out_of_stock = (qty_before > 0 and qty_after == 0)

        if not (crossed_threshold or went_out_of_stock):
            return None
        
        # Create low stock item
        low_stock_item = LowStockItem(
            sku_code=sku_code,
            sku_name=sku_name,
            available=qty_after,
            reorder_point=reorder_point,
        )

        # Create or update aggregated alert
        alert = await self.create_or_update_low_stock_alert([low_stock_item])
        
        return alert
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    @staticmethod
    def _generate_low_stock_title(count: int) -> str:
        """Generate human-readable title for low stock alerts."""
        return f"{count} SKU{'s' if count != 1 else ''} need reordering"
    

class AlertTransformer:
    """Transformer that enriches alerts with read status."""
    
    def __init__(self, alert_service: AlertService, user_id: UUID):
        self.alert_service = alert_service
        self.user_id = user_id
    
    async def __call__(self, alerts: list[Alert]) -> list[AlertResponse]:
        """Transform alerts to responses with read status."""
        if not alerts:
            return []
        
        # Batch fetch read status for all alerts on this page
        alert_ids = [alert.id for alert in alerts]
        read_alert_ids = await self.alert_service.get_read_status_map(
            alert_ids, 
            self.user_id
        )
        
        return [
            self.alert_service.to_response(alert, alert.id in read_alert_ids)
            for alert in alerts
        ]
    