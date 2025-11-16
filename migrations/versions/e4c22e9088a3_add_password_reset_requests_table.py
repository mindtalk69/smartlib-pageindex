"""Add password_reset_requests table

Revision ID: e4c22e9088a3
Revises: 2886c256d61b
Create Date: 2025-11-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4c22e9088a3'
down_revision = '2886c256d61b'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'password_reset_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_by', sa.String(), nullable=True),
        sa.Column('request_reason', sa.Text(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
    )
    op.create_index(
        'ix_password_reset_requests_status',
        'password_reset_requests',
        ['status'],
    )


def downgrade():
    op.drop_index('ix_password_reset_requests_status', table_name='password_reset_requests')
    op.drop_table('password_reset_requests')
