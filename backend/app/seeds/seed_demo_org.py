"""
Seed demo organization data on application startup.
This module is idempotent and will only seed if the org doesn't exist.
"""

from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional
import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker


SOURCE_ORG_ID = "019b56c7-1a13-75d6-b2f3-1d07289c0b36"
SEED_OUTPUT_FILE = "./app/seeds/demo_org_seed.sql"

class DemoOrgSeeder:
    """Handles seeding of demo organization data."""
    
    def __init__(
        self, 
        session: AsyncSession, 
        org_id: str, 
        seed_file: str,
        time_shift_to_now: bool = True
    ):
        self.session = session
        self.org_id = org_id
        self.seed_file = Path(seed_file)
        self.time_shift_to_now = time_shift_to_now
        self.time_offset = None  # Will be calculated if time_shift_to_now is True
        
    async def org_exists(self) -> bool:
        """Check if the organization already exists."""
        result = await self.session.execute(
            text("SELECT 1 FROM orgs WHERE org_id = :org_id"),
            {"org_id": self.org_id}
        )
        return result.scalar_one_or_none() is not None
    
    async def get_org_summary(self) -> dict[str, int]:
        """Get summary of seeded data."""
        tables = [
            'users', 'skus', 'locations', 'transactions', 
            'states', 'barcodes', 'alerts'
        ]
        
        summary = {}
        for table in tables:
            result = await self.session.execute(
                text(f"SELECT COUNT(*) FROM {table} WHERE org_id = :org_id"),
                {"org_id": self.org_id}
            )
            count = result.scalar_one()
            if count > 0:
                summary[table] = count
        
        return summary
    
    def extract_transaction_timestamps(self, sql_content: str) -> list[datetime]:
        """Extract timestamps specifically from transaction INSERT statements."""
        timestamps = []
        
        # Split content into lines
        lines = sql_content.split('\n')
        
        # Pattern to match timestamps in ISO 8601 format
        timestamp_pattern = r"'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\+\d{2}:\d{2})?)'"
        
        for line in lines:
            # Only process lines that are INSERT statements for transactions table
            if 'INSERT INTO transactions' in line:
                # Find all timestamps in this line
                matches = re.findall(timestamp_pattern, line)
                
                # The last timestamp in a transaction INSERT is typically the created_at
                if matches:
                    try:
                        ts = datetime.fromisoformat(matches[-1])
                        timestamps.append(ts)
                    except ValueError:
                        continue
        
        return timestamps
    
    def calculate_time_offset(self, sql_content: str) -> Optional[tuple]:
        """
        Calculate the time offset needed to shift the latest transaction to now.
        
        Returns:
            Tuple of (offset_seconds, latest_timestamp) or None if no timestamps found
        """
        timestamps = self.extract_transaction_timestamps(sql_content)
        
        if not timestamps:
            print("   Warning: No transaction timestamps found")
            return None
        
        # Find the latest transaction timestamp
        latest_timestamp = max(timestamps)
        
        # Calculate offset to shift latest to now
        now = datetime.now(timezone.utc)
        offset = now - latest_timestamp
        
        return (offset.total_seconds(), latest_timestamp)
    
    def shift_timestamp(self, timestamp_str: str, offset_seconds: float) -> str:
        """Shift a timestamp string by the given offset in seconds."""
        try:
            # Parse the timestamp
            ts = datetime.fromisoformat(timestamp_str)
            
            # Add the offset
            shifted_ts = ts + timedelta(seconds=offset_seconds)
            
            # Return in the same ISO format
            return shifted_ts.isoformat()
        except (ValueError, AttributeError):
            # If parsing fails, return original
            return timestamp_str
    
    def apply_time_shift(self, sql_content: str, offset_seconds: float) -> str:
        """
        Apply time shift to all timestamps in the SQL content.
        
        Args:
            sql_content: The original SQL content
            offset_seconds: Number of seconds to add to each timestamp
        
        Returns:
            Modified SQL content with shifted timestamps
        """
        # Pattern matches ISO 8601 timestamps in single quotes
        timestamp_pattern = r"'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\+\d{2}:\d{2})?)'"
        
        def replace_timestamp(match):
            original_ts = match.group(1)
            shifted_ts = self.shift_timestamp(original_ts, offset_seconds)
            return f"'{shifted_ts}'"
        
        # Replace all timestamps
        modified_content = re.sub(timestamp_pattern, replace_timestamp, sql_content)
        
        return modified_content
    
    def parse_sql_statements(self, sql_content: str) -> list[str]:
        """Parse SQL file into individual executable statements."""
        statements = []
        current_statement = []
        
        for line in sql_content.split('\n'):
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('--'):
                continue
            
            # Skip transaction control statements (we handle transaction ourselves)
            if line.upper() in ('BEGIN;', 'COMMIT;', 'ROLLBACK;'):
                continue
            
            current_statement.append(line)
            
            # If line ends with semicolon, we have a complete statement
            if line.endswith(';'):
                stmt = ' '.join(current_statement).strip()
                if stmt and stmt != ';':
                    # Remove trailing semicolon for SQLAlchemy
                    statements.append(stmt.rstrip(';'))
                current_statement = []
        
        # Add any remaining statement
        if current_statement:
            stmt = ' '.join(current_statement).strip()
            if stmt and stmt != ';':
                statements.append(stmt.rstrip(';'))
        
        return statements
    
    async def execute_seed_file(self) -> None:
        """Execute the SQL seed file within a transaction."""
        if not self.seed_file.exists():
            raise FileNotFoundError(f"Seed file not found: {self.seed_file}")
        
        with open(self.seed_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Apply time shift if requested
        if self.time_shift_to_now:
            offset_info = self.calculate_time_offset(sql_content)
            
            if offset_info:
                offset_seconds, latest_ts = offset_info
                print(f"   Time-shifting data: latest transaction was {latest_ts}")
                print(f"   Applying offset: {offset_seconds / 86400:.1f} days")
                
                sql_content = self.apply_time_shift(sql_content, offset_seconds)
                self.time_offset = offset_seconds
            else:
                print("   Warning: No transaction timestamps found, skipping time shift")
        
        # Parse into individual statements
        statements = self.parse_sql_statements(sql_content)
        
        print(f"   Executing {len(statements)} SQL statements...")
        
        # Execute all statements in a single transaction
        try:
            for i, statement in enumerate(statements, 1):
                try:
                    await self.session.execute(text(statement))
                except Exception as e:
                    print(f"   Error at statement {i}: {statement[:100]}...")
                    raise
            
            # Commit the transaction
            await self.session.commit()
            
        except Exception as e:
            await self.session.rollback()
            raise
    
    async def seed(self, force: bool = False) -> bool:
        """
        Seed the demo organization if it doesn't exist.
        
        Args:
            force: If True, seed even if org exists (re-seed)
        
        Returns:
            True if seeded, False if skipped
        """
        exists = await self.org_exists()
        
        if exists and not force:
            return False
        
        if exists and force:
            print(f"  Force re-seeding demo org {self.org_id} (org exists)")
        else:
            action = "with time-shift" if self.time_shift_to_now else ""
            print(f"Seeding demo organization: {self.org_id} {action}")
        
        try:
            await self.execute_seed_file()
            
            # Show summary of what was seeded
            summary = await self.get_org_summary()
            print(f"Successfully seeded demo org from {self.seed_file.name}")
            if self.time_offset:
                print(f"   Applied time offset: {self.time_offset / 86400:.1f} days")
            if summary:
                print(f"   Seeded: {dict(summary)}")
            
            return True
            
        except Exception as e:
            await self.session.rollback()
            print(f"Failed to seed demo org: {e}")
            raise


async def seed_demo_org(force: bool = False, time_shift_to_now: bool = True) -> None:
    """
    Seed demo organization data if it doesn't exist.
    Called during application startup.
    
    Args:
        force: If True, re-seed even if org exists
        time_shift_to_now: If True, shift all timestamps so latest transaction is today
    """
    
    try:
        async with async_session_maker() as session:
            seeder = DemoOrgSeeder(
                session=session,
                org_id=SOURCE_ORG_ID,
                seed_file=SEED_OUTPUT_FILE,
                time_shift_to_now=time_shift_to_now
            )
            await seeder.seed(force=force)
            
    except FileNotFoundError as e:
        print(f"  {e}")
        
    except Exception as e:
        print(f" Error seeding demo org: {e}")
        # Don't crash the app, just log and continue
        import traceback
        traceback.print_exc()


# Optional: Manual seeding endpoint for testing
async def manual_seed(force: bool = False, time_shift_to_now: bool = True) -> dict:
    """
    Manually trigger seeding. Use in admin endpoint.
    
    Args:
        force: If True, re-seed even if org exists
        time_shift_to_now: If True, shift all timestamps so latest transaction is today
    
    Returns:
        Status dict with seeding result
    """
    try:
        async with async_session_maker() as session:
            seeder = DemoOrgSeeder(
                session=session,
                org_id=SOURCE_ORG_ID,
                seed_file=SEED_OUTPUT_FILE,
                time_shift_to_now=time_shift_to_now
            )
            
            exists = await seeder.org_exists()
            seeded = await seeder.seed(force=force)
            
            return {
                "success": True,
                "seeded": seeded,
                "org_id": SOURCE_ORG_ID,
                "existed_before": exists,
                "time_shifted": time_shift_to_now,
                "time_offset_days": seeder.time_offset / 86400 if seeder.time_offset else None,
                "summary": await seeder.get_org_summary() if seeded or exists else {}
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "org_id": SOURCE_ORG_ID,
        }
        