"""merge heads

Revision ID: 3b8f6623a8be
Revises: add_llm_providers_table, e4c22e9088a3
Create Date: 2026-02-21 18:36:26.805306

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b8f6623a8be'
down_revision = ('add_llm_providers_table', 'e4c22e9088a3')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
