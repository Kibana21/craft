"""add_my_studio_tables

Revision ID: f2c3d4e5f6a7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-14 02:05:00.000000

Creates:
- studio_images — permanent user-owned image library (Phase A).
- studio_workflow_runs — one row per enhancement run (populated in Phase B+).

See .claude/plans/my_studio/01-data-model-and-migrations.md for the full spec.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2c3d4e5f6a7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── studio_workflow_runs ──────────────────────────────────────────────────
    # Created first because studio_images has an FK into it.
    op.create_table(
        "studio_workflow_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("intent", sa.String(length=30), nullable=False),
        sa.Column("is_batch", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("source_image_ids", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("style_inputs", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("merged_prompt", sa.Text(), nullable=False),
        sa.Column("ai_enrichments", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("variation_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="QUEUED", nullable=False),
        sa.Column("progress_percent", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "intent IN ('MAKE_PROFESSIONAL', 'CHANGE_BACKGROUND', 'ENHANCE_QUALITY', 'VARIATION', 'CUSTOM')",
            name="ck_studio_runs_intent",
        ),
        sa.CheckConstraint(
            "status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'PARTIAL')",
            name="ck_studio_runs_status",
        ),
        sa.CheckConstraint("variation_count <= 8", name="ck_studio_runs_variation_count"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_studio_runs_user_id", "studio_workflow_runs", ["user_id"])
    op.create_index("idx_studio_runs_status", "studio_workflow_runs", ["status"])
    op.create_index(
        "idx_studio_runs_active",
        "studio_workflow_runs",
        ["user_id"],
        postgresql_where=sa.text("status IN ('QUEUED', 'RUNNING')"),
    )

    # ── studio_images ─────────────────────────────────────────────────────────
    op.create_table(
        "studio_images",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("storage_url", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=True),
        sa.Column("mime_type", sa.String(length=50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width_px", sa.Integer(), nullable=True),
        sa.Column("height_px", sa.Integer(), nullable=True),
        sa.Column("source_image_id", sa.UUID(), nullable=True),
        sa.Column("workflow_run_id", sa.UUID(), nullable=True),
        sa.Column("prompt_used", sa.Text(), nullable=True),
        sa.Column("tags", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("metadata", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "type IN ('PHOTO', 'AI_GENERATED', 'ENHANCED', 'POSTER_EXPORT')",
            name="ck_studio_images_type",
        ),
        sa.CheckConstraint(
            "mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/heic')",
            name="ck_studio_images_mime_type",
        ),
        sa.CheckConstraint("size_bytes <= 26214400", name="ck_studio_images_size"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_image_id"], ["studio_images.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["workflow_run_id"], ["studio_workflow_runs.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_studio_images_user_id", "studio_images", ["user_id"])
    op.create_index("idx_studio_images_type", "studio_images", ["type"])
    op.create_index("idx_studio_images_source_image_id", "studio_images", ["source_image_id"])
    op.create_index("idx_studio_images_workflow_run_id", "studio_images", ["workflow_run_id"])
    op.create_index(
        "idx_studio_images_user_created",
        "studio_images",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_studio_images_active",
        "studio_images",
        ["user_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_studio_images_active", table_name="studio_images")
    op.drop_index("idx_studio_images_user_created", table_name="studio_images")
    op.drop_index("idx_studio_images_workflow_run_id", table_name="studio_images")
    op.drop_index("idx_studio_images_source_image_id", table_name="studio_images")
    op.drop_index("idx_studio_images_type", table_name="studio_images")
    op.drop_index("idx_studio_images_user_id", table_name="studio_images")
    op.drop_table("studio_images")

    op.drop_index("idx_studio_runs_active", table_name="studio_workflow_runs")
    op.drop_index("idx_studio_runs_status", table_name="studio_workflow_runs")
    op.drop_index("idx_studio_runs_user_id", table_name="studio_workflow_runs")
    op.drop_table("studio_workflow_runs")
