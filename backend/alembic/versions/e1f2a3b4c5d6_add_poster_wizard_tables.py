"""add_poster_wizard_tables

Revision ID: e1f2a3b4c5d6
Revises: 53f0e01db9b9
Create Date: 2026-04-13 12:00:00.000000

Creates: poster_chat_turns, poster_reference_images.
Both tables have their own retention policies (30 days and 24-hour TTL respectively)
enforced by sweep jobs defined in backend/app/services/poster_sweep_service.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = '53f0e01db9b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- poster_chat_turns ---
    # Append-only log of Step 5 refinement turns. Retained for 30 days.
    op.create_table(
        'poster_chat_turns',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('artifact_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID(), nullable=False),
        sa.Column('turn_index', sa.Integer(), nullable=False),
        sa.Column('user_message', sa.Text(), nullable=False),
        sa.Column('ai_response', sa.Text(), nullable=False),
        sa.Column('action_type', sa.String(length=50), nullable=False),
        sa.Column('resulting_image_url', sa.String(length=500), nullable=True),
        sa.Column('inpaint_mask_url', sa.String(length=500), nullable=True),
        sa.Column('structural_change_detected', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "action_type IN ('CHAT_REFINE', 'INPAINT', 'REDIRECT', 'TURN_LIMIT_NUDGE')",
            name='ck_poster_chat_turns_action_type',
        ),
        sa.ForeignKeyConstraint(['artifact_id'], ['artifacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_poster_chat_turns_artifact_id', 'poster_chat_turns', ['artifact_id'])
    op.create_index('idx_poster_chat_turns_variant_id', 'poster_chat_turns', ['variant_id'])
    op.create_index('idx_poster_chat_turns_created_at', 'poster_chat_turns', ['created_at'])

    # --- poster_reference_images ---
    # Session-temporary reference images uploaded in Step 2 (product/asset subject).
    # TTL enforced by sweep_expired_reference_images job (expires_at < now()).
    op.create_table(
        'poster_reference_images',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('uploader_id', sa.UUID(), nullable=False),
        sa.Column('artifact_id', sa.UUID(), nullable=True),
        sa.Column('storage_url', sa.String(length=500), nullable=False),
        sa.Column('mime_type', sa.String(length=50), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('size_bytes <= 20971520', name='ck_poster_ref_images_size'),
        sa.CheckConstraint(
            "mime_type IN ('image/png', 'image/jpeg', 'image/webp')",
            name='ck_poster_ref_images_mime_type',
        ),
        sa.ForeignKeyConstraint(['uploader_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['artifact_id'], ['artifacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_poster_reference_images_uploader_id', 'poster_reference_images', ['uploader_id'])
    op.create_index('idx_poster_reference_images_artifact_id', 'poster_reference_images', ['artifact_id'])
    op.create_index('idx_poster_reference_images_expires_at', 'poster_reference_images', ['expires_at'])


def downgrade() -> None:
    op.drop_index('idx_poster_reference_images_expires_at', table_name='poster_reference_images')
    op.drop_index('idx_poster_reference_images_artifact_id', table_name='poster_reference_images')
    op.drop_index('idx_poster_reference_images_uploader_id', table_name='poster_reference_images')
    op.drop_table('poster_reference_images')

    op.drop_index('idx_poster_chat_turns_created_at', table_name='poster_chat_turns')
    op.drop_index('idx_poster_chat_turns_variant_id', table_name='poster_chat_turns')
    op.drop_index('idx_poster_chat_turns_artifact_id', table_name='poster_chat_turns')
    op.drop_table('poster_chat_turns')
