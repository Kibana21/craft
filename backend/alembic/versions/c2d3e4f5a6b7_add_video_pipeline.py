"""add_video_pipeline

Revision ID: c2d3e4f5a6b7
Revises: b2c3d4e5f6a7
Create Date: 2026-04-12 12:00:00.000000

Creates: presenters, video_sessions, video_scripts, script_versions, scenes, generated_videos.

Two circular FK cycles are resolved by adding the back-pointing constraints
after the referenced tables exist (see ALTER TABLE at the end of upgrade()).

The (video_session_id, sequence) unique constraint on scenes is DEFERRABLE
INITIALLY DEFERRED so that sequence renumbering within a transaction doesn't
violate uniqueness mid-update.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Enums (uppercase values to match existing CRAFT enum convention) ---
    op.execute("CREATE TYPE speaking_style AS ENUM ('AUTHORITATIVE', 'CONVERSATIONAL', 'ENTHUSIASTIC', 'EMPATHETIC')")
    op.execute("CREATE TYPE camera_framing AS ENUM ('WIDE_SHOT', 'MEDIUM_SHOT', 'CLOSE_UP', 'OVER_THE_SHOULDER', 'TWO_SHOT', 'AERIAL', 'POV')")
    op.execute("CREATE TYPE video_status AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED')")
    op.execute("CREATE TYPE script_action AS ENUM ('DRAFT', 'WARM', 'PROFESSIONAL', 'SHORTER', 'STRONGER_CTA', 'MANUAL')")
    op.execute("CREATE TYPE target_duration AS ENUM ('SECONDS_30', 'SECONDS_60', 'SECONDS_90', 'MINUTES_2', 'MINUTES_3', 'MINUTES_5')")
    op.execute("CREATE TYPE video_session_step AS ENUM ('PRESENTER', 'SCRIPT', 'STORYBOARD', 'GENERATION')")

    # --- presenters ---
    op.create_table(
        'presenters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('age_range', sa.String(length=50), nullable=False),
        sa.Column('appearance_keywords', sa.String(length=500), nullable=False),
        sa.Column('full_appearance_description', sa.Text(), nullable=False),
        sa.Column('speaking_style', postgresql.ENUM('AUTHORITATIVE', 'CONVERSATIONAL', 'ENTHUSIASTIC', 'EMPATHETIC', name='speaking_style', create_type=False), nullable=False),
        sa.Column('is_library', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=False),
        sa.Column('deleted_at', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_presenters_created_by_id', 'presenters', ['created_by_id'])
    op.create_index('idx_presenters_is_library', 'presenters', ['is_library'])

    # --- video_sessions (without circular FKs — added via ALTER TABLE below) ---
    op.create_table(
        'video_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('artifact_id', sa.UUID(), nullable=False),
        sa.Column('presenter_id', sa.UUID(), nullable=True),
        sa.Column('target_duration_seconds', sa.Integer(), server_default='60', nullable=False),
        sa.Column('current_step', postgresql.ENUM('PRESENTER', 'SCRIPT', 'STORYBOARD', 'GENERATION', name='video_session_step', create_type=False), server_default='PRESENTER', nullable=False),
        sa.Column('current_script_id', sa.UUID(), nullable=True),         # FK added after video_scripts
        sa.Column('scenes_script_version_id', sa.UUID(), nullable=True),  # FK added after script_versions
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['artifact_id'], ['artifacts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['presenter_id'], ['presenters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('artifact_id', name='uq_video_sessions_artifact_id'),
    )
    op.create_index('idx_video_sessions_artifact_id', 'video_sessions', ['artifact_id'])
    op.create_index('idx_video_sessions_presenter_id', 'video_sessions', ['presenter_id'])
    op.create_index('idx_video_sessions_current_script_id', 'video_sessions', ['current_script_id'])
    op.create_index('idx_video_sessions_scenes_script_version_id', 'video_sessions', ['scenes_script_version_id'])

    # --- video_scripts ---
    op.create_table(
        'video_scripts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('video_session_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), server_default='', nullable=False),
        sa.Column('word_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('estimated_duration_seconds', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['video_session_id'], ['video_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_video_scripts_video_session_id', 'video_scripts', ['video_session_id'])

    # --- script_versions ---
    op.create_table(
        'script_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('video_session_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('action', postgresql.ENUM('DRAFT', 'WARM', 'PROFESSIONAL', 'SHORTER', 'STRONGER_CTA', 'MANUAL', name='script_action', create_type=False), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['video_session_id'], ['video_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_script_versions_video_session_id', 'script_versions', ['video_session_id'])

    # --- scenes ---
    op.create_table(
        'scenes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('video_session_id', sa.UUID(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('dialogue', sa.Text(), nullable=False),
        sa.Column('setting', sa.String(length=500), nullable=False),
        sa.Column('camera_framing', postgresql.ENUM('WIDE_SHOT', 'MEDIUM_SHOT', 'CLOSE_UP', 'OVER_THE_SHOULDER', 'TWO_SHOT', 'AERIAL', 'POV', name='camera_framing', create_type=False), server_default='MEDIUM_SHOT', nullable=False),
        sa.Column('merged_prompt', sa.Text(), server_default='', nullable=False),
        sa.Column('script_version_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['video_session_id'], ['video_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['script_version_id'], ['script_versions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # DEFERRABLE INITIALLY DEFERRED for safe sequence renumbering within transactions
    op.execute(
        "ALTER TABLE scenes ADD CONSTRAINT uq_scenes_session_sequence "
        "UNIQUE (video_session_id, sequence) DEFERRABLE INITIALLY DEFERRED"
    )
    op.create_index('idx_scenes_video_session_id', 'scenes', ['video_session_id'])
    op.create_index('idx_scenes_script_version_id', 'scenes', ['script_version_id'])

    # --- generated_videos ---
    op.create_table(
        'generated_videos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('video_session_id', sa.UUID(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('status', postgresql.ENUM('QUEUED', 'RENDERING', 'READY', 'FAILED', name='video_status', create_type=False), server_default='QUEUED', nullable=False),
        sa.Column('progress_percent', sa.Integer(), server_default='0', nullable=False),
        sa.Column('current_scene', sa.Integer(), nullable=True),
        sa.Column('file_url', sa.String(length=1000), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['video_session_id'], ['video_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('video_session_id', 'version', name='uq_generated_videos_session_version'),
    )
    op.create_index('idx_generated_videos_video_session_id', 'generated_videos', ['video_session_id'])
    op.create_index('idx_generated_videos_status', 'generated_videos', ['status'])

    # --- Circular FK constraints (added after both referenced tables exist) ---
    op.create_foreign_key(
        'fk_video_sessions_current_script_id',
        'video_sessions', 'video_scripts',
        ['current_script_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_video_sessions_scenes_script_version_id',
        'video_sessions', 'script_versions',
        ['scenes_script_version_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    # Drop circular FK constraints first
    op.drop_constraint('fk_video_sessions_scenes_script_version_id', 'video_sessions', type_='foreignkey')
    op.drop_constraint('fk_video_sessions_current_script_id', 'video_sessions', type_='foreignkey')

    # Drop tables in reverse dependency order
    op.drop_index('idx_generated_videos_status', table_name='generated_videos')
    op.drop_index('idx_generated_videos_video_session_id', table_name='generated_videos')
    op.drop_table('generated_videos')

    op.drop_index('idx_scenes_script_version_id', table_name='scenes')
    op.drop_index('idx_scenes_video_session_id', table_name='scenes')
    op.drop_table('scenes')

    op.drop_index('idx_script_versions_video_session_id', table_name='script_versions')
    op.drop_table('script_versions')

    op.drop_index('idx_video_scripts_video_session_id', table_name='video_scripts')
    op.drop_table('video_scripts')

    op.drop_index('idx_video_sessions_scenes_script_version_id', table_name='video_sessions')
    op.drop_index('idx_video_sessions_current_script_id', table_name='video_sessions')
    op.drop_index('idx_video_sessions_presenter_id', table_name='video_sessions')
    op.drop_index('idx_video_sessions_artifact_id', table_name='video_sessions')
    op.drop_table('video_sessions')

    op.drop_index('idx_presenters_is_library', table_name='presenters')
    op.drop_index('idx_presenters_created_by_id', table_name='presenters')
    op.drop_table('presenters')

    # Drop enum types
    op.execute("DROP TYPE video_session_step")
    op.execute("DROP TYPE target_duration")
    op.execute("DROP TYPE script_action")
    op.execute("DROP TYPE video_status")
    op.execute("DROP TYPE camera_framing")
    op.execute("DROP TYPE speaking_style")
