"""
Seed demo organization data on application startup.
This module is idempotent and will only seed if the org doesn't exist.
"""

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker


SOURCE_ORG_ID = "019b56c7-1a13-75d6-b2f3-1d07289c0b36"
SEED_OUTPUT_FILE = "./app/seeds/demo_org_seed.sql"

class DemoOrgSeeder:
    """Handles seeding of demo organization data."""
    
    def __init__(self, session: AsyncSession, org_id: str, seed_file: str):
        self.session = session
        self.org_id = org_id
        self.seed_file = Path(seed_file)
        
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
        
        if exists:
            return False
        
        if exists and force:
            print(f"  Force re-seeding demo org {self.org_id} (org exists)")
        else:
            print(f"Seeding demo organization: {self.org_id}")
        
        try:
            await self.execute_seed_file()
            
            # Show summary of what was seeded
            summary = await self.get_org_summary()
            print(f"Successfully seeded demo org from {self.seed_file.name}")
            if summary:
                print(f"   Seeded: {dict(summary)}")
            
            return True
            
        except Exception as e:
            await self.session.rollback()
            print(f"Failed to seed demo org: {e}")
            raise


async def seed_demo_org(force: bool = False) -> None:
    """
    Seed demo organization data if it doesn't exist.
    Called during application startup.
    
    Args:
        force: If True, re-seed even if org exists
    """
    
    try:
        async with async_session_maker() as session:
            seeder = DemoOrgSeeder(
                session=session,
                org_id=SOURCE_ORG_ID,
                seed_file=SEED_OUTPUT_FILE
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
async def manual_seed(force: bool = False) -> dict:
    """
    Manually trigger seeding. Use in admin endpoint.
    
    Returns:
        Status dict with seeding result
    """
    try:
        async with async_session_maker() as session:
            seeder = DemoOrgSeeder(
                session=session,
                org_id=SOURCE_ORG_ID,
                seed_file=SEED_OUTPUT_FILE
            )
            
            exists = await seeder.org_exists()
            seeded = await seeder.seed(force=force)
            
            return {
                "success": True,
                "seeded": seeded,
                "org_id": SOURCE_ORG_ID,
                "existed_before": exists,
                "summary": await seeder.get_org_summary() if seeded or exists else {}
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "org_id": SOURCE_ORG_ID,
        }
        