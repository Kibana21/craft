"""phase7_gamification_video

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-04-12 14:00:00.000000

Adds:
- video_generated value to points_action enum
- related_artifact_id column to points_log
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # points_log.action is a plain String(50) column, not a PostgreSQL enum —
    # no ALTER TYPE needed; new action values just need to be used in application code.

    # Add related_artifact_id to points_log
    op.add_column(
        'points_log',
        sa.Column(
            'related_artifact_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('artifacts.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('idx_points_log_artifact_id', 'points_log', ['related_artifact_id'])


def downgrade() -> None:
    op.drop_index('idx_points_log_artifact_id', table_name='points_log')
    op.drop_column('points_log', 'related_artifact_id')
    # Note: PostgreSQL does not support removing enum values; downgrade leaves the enum value in place
