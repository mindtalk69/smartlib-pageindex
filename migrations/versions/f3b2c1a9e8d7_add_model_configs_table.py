"""add model_configs table

Revision ID: f3b2c1a9e8d7
Revises: d98af8a9b50c
Create Date: 2025-08-26 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3b2c1a9e8d7'
down_revision = 'd98af8a9b50c'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'model_configs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('deployment_name', sa.String(length=256), nullable=False),
        sa.Column('provider', sa.String(length=64), nullable=False, server_default='azure_openai'),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('streaming', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('name', name='uq_model_configs_name')
    )
    # Create an index on is_default to make default lookups fast
    op.create_index('ix_model_configs_is_default', 'model_configs', ['is_default'])


def downgrade():
    op.drop_index('ix_model_configs_is_default', table_name='model_configs')
    op.drop_table('model_configs')
