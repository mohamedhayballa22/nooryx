"""Add indexes for search

Revision ID: 9e2b46962ab9
Revises: 734fbb79d012
Create Date: 2025-10-28 13:11:19.066251

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e2b46962ab9'
down_revision: Union[str, None] = '734fbb79d012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    op.create_index(
        'ix_locations_orgid_lower_name_trgm',
        'locations',
        [sa.text('lower(name) gin_trgm_ops')],
        unique=False,
        postgresql_using='gin'
    )
    op.create_index(
        'ix_skus_org_code_prefix',
        'skus',
        ['org_id', 'code'],
        unique=False
    )
    op.create_index(
        'ix_skus_org_name_trgm',
        'skus',
        [sa.text('lower(name) gin_trgm_ops')],
        unique=False,
        postgresql_using='gin'
    )


def downgrade() -> None:
    op.drop_index('ix_skus_org_name_trgm', table_name='skus')
    op.drop_index('ix_skus_org_code_prefix', table_name='skus')
    op.drop_index('ix_locations_orgid_lower_name_trgm', table_name='locations')
    op.execute("DROP EXTENSION IF EXISTS pg_trgm;")
