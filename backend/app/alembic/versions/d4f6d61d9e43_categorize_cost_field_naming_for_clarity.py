"""Categorize cost field naming for clarity

Revision ID: d4f6d61d9e43
Revises: 48060c37e1e1
Create Date: 2025-12-04 16:35:28.815932

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f6d61d9e43'
down_revision: Union[str, None] = '48060c37e1e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename columns instead of drop/create
    op.alter_column('cost_records', 'cost_price', new_column_name='unit_cost_minor')
    op.alter_column('transactions', 'cost_price', new_column_name='total_cost_minor')


def downgrade() -> None:
    # Reverse the renames
    op.alter_column('cost_records', 'unit_cost_minor', new_column_name='cost_price')
    op.alter_column('transactions', 'total_cost_minor', new_column_name='cost_price')
