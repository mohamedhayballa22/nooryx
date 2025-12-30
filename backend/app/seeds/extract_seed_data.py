"""
Extract organization data and generate SQL seed file.
Run with: python scripts/extract_org_seed.py
"""

import asyncio
import json
from datetime import datetime
from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy import select, inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker
from app.models import (
    Organization,
    OrganizationSettings,
    Subscription,
    User,
    Location,
    SKU,
    Barcode,
    Transaction,
    State,
    CostRecord,
    Alert,
)

# Configuration
ORG_ID = "019b56c7-1a13-75d6-b2f3-1d07289c0b36"
OUTPUT_FILE = "./app/seeds/demo_org_seed.sql"


class OrgDataExtractor:
    """Extract all data for an organization and generate seed SQL."""
    
    # Models in foreign key dependency order
    MODELS = [
        Organization,
        OrganizationSettings,
        Subscription,
        User,
        Location,
        SKU,
        Barcode,
        Transaction,
        State,
        CostRecord,
        Alert,
    ]
    
    def __init__(self, session: AsyncSession, org_id: str):
        self.session = session
        self.org_id = org_id
        
    async def fetch_model_data(self, model) -> List[Any]:
        """Fetch all records for a model filtered by org_id."""
        table_name = model.__tablename__
        
        if table_name == 'orgs':
            stmt = select(model).where(model.org_id == self.org_id)
        else:
            # All other tables have org_id
            stmt = select(model).where(model.org_id == self.org_id)
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    def format_value(self, value: Any) -> str:
        """Format a Python value for SQL insertion."""
        if value is None:
            return 'NULL'
        elif isinstance(value, bool):
            return 'TRUE' if value else 'FALSE'
        elif isinstance(value, (int, float)):
            return str(value)
        elif isinstance(value, UUID):
            return f"'{value}'"
        elif isinstance(value, datetime):
            return f"'{value.isoformat()}'"
        elif isinstance(value, dict):
            # JSONB columns - escape single quotes in JSON
            json_str = json.dumps(value).replace("'", "''")
            return f"'{json_str}'::jsonb"
        elif isinstance(value, str):
            # Escape single quotes
            escaped = value.replace("'", "''")
            return f"'{escaped}'"
        else:
            # Fallback
            escaped = str(value).replace("'", "''")
            return f"'{escaped}'"
    
    def generate_insert(self, model, instance) -> str:
        """Generate INSERT statement for a model instance."""
        table_name = model.__tablename__
        mapper = inspect(model)
        
        columns = []
        values = []
        
        for column in mapper.columns:
            col_name = column.name
            value = getattr(instance, col_name, None)
            
            columns.append(col_name)
            values.append(self.format_value(value))
        
        col_list = ', '.join(columns)
        val_list = ', '.join(values)
        
        return f"INSERT INTO {table_name} ({col_list}) VALUES ({val_list});"
    
    async def extract_to_sql(self) -> str:
        """Extract all organization data as SQL statements."""
        output = []
        
        # Header
        output.append("-- Organization Seed Data")
        output.append(f"-- Generated: {datetime.utcnow().isoformat()}")
        output.append(f"-- Organization ID: {self.org_id}")
        output.append("")
        output.append("BEGIN;")
        output.append("")
        
        total_rows = 0
        
        for model in self.MODELS:
            table_name = model.__tablename__
            
            try:
                records = await self.fetch_model_data(model)
                
                if not records:
                    output.append(f"-- No data in {table_name}")
                    output.append("")
                    continue
                
                output.append(f"-- Table: {table_name} ({len(records)} rows)")
                output.append("")
                
                for record in records:
                    insert_stmt = self.generate_insert(model, record)
                    output.append(insert_stmt)
                
                output.append("")
                total_rows += len(records)
                
                print(f"✓ Extracted {len(records)} rows from {table_name}")
                
            except Exception as e:
                print(f"Warning: Failed to extract {table_name}: {e}")
                output.append(f"-- ERROR extracting {table_name}: {e}")
                output.append("")
        
        output.append("COMMIT;")
        output.append("")
        output.append(f"-- Total rows exported: {total_rows}")
        
        return '\n'.join(output)
    
    async def get_summary(self) -> Dict[str, int]:
        """Get counts of related records."""
        summary = {}
        
        for model in self.MODELS:
            records = await self.fetch_model_data(model)
            summary[model.__tablename__] = len(records)
        
        return summary
    
    async def verify_org_exists(self) -> bool:
        """Check if organization exists."""
        stmt = select(Organization).where(Organization.org_id == self.org_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None


async def main():
    """Main extraction logic."""
    print(f"Extracting data for organization: {ORG_ID}")
    
    async with async_session_maker() as session:
        extractor = OrgDataExtractor(session, ORG_ID)
        
        # Verify org exists
        if not await extractor.verify_org_exists():
            print(f"Organization {ORG_ID} not found")
            return
        
        # Show summary
        print(f"\nOrganization Summary:")
        summary = await extractor.get_summary()
        for table, count in summary.items():
            if count > 0:
                print(f"   • {table}: {count}")
        
        # Extract data
        print(f"\nExtracting data...")
        seed_sql = await extractor.extract_to_sql()
        
        # Write to file
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(seed_sql)
        
        print(f"\nSuccessfully generated: {OUTPUT_FILE}")
        print(f"Total size: {len(seed_sql):,} bytes")
        print(f"\nUse the seeder script to apply this to production")


if __name__ == '__main__':
    asyncio.run(main())
    