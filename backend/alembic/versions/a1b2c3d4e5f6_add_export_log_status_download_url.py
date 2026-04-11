"""add_export_log_status_download_url

Revision ID: a1b2c3d4e5f6
Revises: 4906a5094a60
Create Date: 2026-04-11 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '4906a5094a60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('export_logs', sa.Column('aspect_ratio', sa.String(length=20), nullable=True))
    op.add_column('export_logs', sa.Column('status', sa.String(length=20), server_default='processing', nullable=False))
    op.add_column('export_logs', sa.Column('download_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('export_logs', 'download_url')
    op.drop_column('export_logs', 'status')
    op.drop_column('export_logs', 'aspect_ratio')
