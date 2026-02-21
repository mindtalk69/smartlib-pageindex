"""Add LLM providers table and update model_config

Revision ID: add_llm_providers_table
Revises: cd507e8c023a
Create Date: 2025-12-20 08:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_llm_providers_table'
down_revision = 'cd507e8c023a'  # Latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Determine if we're using PostgreSQL or SQLite
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    
    # Use appropriate JSON type based on database
    # PostgreSQL has native JSON support, SQLite uses TEXT
    json_type = postgresql.JSON(astext_type=sa.Text()) if dialect_name == 'postgresql' else sa.JSON()
    
    # Create llm_providers table
    op.create_table('llm_providers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('provider_type', sa.String(length=50), nullable=False),
        sa.Column('base_url', sa.String(length=500), nullable=True),
        sa.Column('api_key', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('priority', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('config', json_type, nullable=True),
        sa.Column('last_health_check', sa.DateTime(), nullable=True),
        sa.Column('health_status', sa.String(length=20), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Add provider_id column to model_configs table
    # Use batch_alter_table for SQLite compatibility (SQLite doesn't support ALTER TABLE ADD CONSTRAINT)
    with op.batch_alter_table('model_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provider_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_model_config_provider', 'llm_providers', ['provider_id'], ['id'])
        # Add unique constraint on provider_id and deployment_name
        # This allows NULL provider_id (for legacy records) while ensuring uniqueness when provider_id is set
        batch_op.create_unique_constraint('uix_provider_deployment', ['provider_id', 'deployment_name'])


def downgrade():
    # Remove unique constraint and foreign key from model_configs
    with op.batch_alter_table('model_configs', schema=None) as batch_op:
        batch_op.drop_constraint('uix_provider_deployment', type_='unique')
        batch_op.drop_constraint('fk_model_config_provider', type_='foreignkey')
        batch_op.drop_column('provider_id')

    # Drop llm_providers table
    op.drop_table('llm_providers')
