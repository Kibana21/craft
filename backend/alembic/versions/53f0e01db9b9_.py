"""widen_scene_setting_to_text

Revision ID: 53f0e01db9b9
Revises: d3e4f5a6b7c8
Create Date: 2026-04-12 21:21:00.169462
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '53f0e01db9b9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'scenes', 'setting',
        existing_type=sa.VARCHAR(length=500),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'scenes', 'setting',
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=500),
        existing_nullable=False,
    )
