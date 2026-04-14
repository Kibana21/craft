"""My Studio — per-user image library + enhancement workflow runs (Phase A+).

See `.claude/plans/my_studio/01-data-model-and-migrations.md` for the full schema.

Two tables:
- `studio_images`    permanent, user-owned image records (library).
- `studio_workflow_runs` one row per single- or batch-enhancement run.

Notes:
- `studio_images.source_image_id` is a self-FK with `ON DELETE SET NULL` so
  that deleting a source image turns its outputs into standalone records
  (PRD §14.2).
- `studio_images.workflow_run_id` is nullable; NULL for uploads and poster
  exports, populated for AI outputs.
- `studio_workflow_runs` has no `deleted_at` — runs are audit records.
- The JSONB columns (`source_image_ids`, `style_inputs`, `ai_enrichments`,
  `tags`, `metadata`) are validated at the API boundary by Pydantic — never
  trust raw dict reads.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class StudioImage(BaseModel):
    __tablename__ = "studio_images"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="StudioImageType: PHOTO | AI_GENERATED | ENHANCED | POSTER_EXPORT",
    )
    storage_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width_px: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_px: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Lineage: points at the source image if this row is an AI output; NULL
    # for uploads and exports. `ON DELETE SET NULL` so outputs survive source
    # deletion (see module docstring).
    source_image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_images.id", ondelete="SET NULL"),
        nullable=True,
    )
    workflow_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_workflow_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    image_metadata: Mapped[dict | None] = mapped_column(
        "metadata",  # column name in DB is `metadata`; Python attr avoids SQLA reserved name
        JSONB,
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('PHOTO', 'AI_GENERATED', 'ENHANCED', 'POSTER_EXPORT')",
            name="ck_studio_images_type",
        ),
        CheckConstraint(
            "mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/heic')",
            name="ck_studio_images_mime_type",
        ),
        CheckConstraint(
            "size_bytes <= 26214400",  # 25 MB
            name="ck_studio_images_size",
        ),
        Index("idx_studio_images_user_id", "user_id"),
        Index("idx_studio_images_type", "type"),
        Index("idx_studio_images_source_image_id", "source_image_id"),
        Index("idx_studio_images_workflow_run_id", "workflow_run_id"),
        # Composite index powers the default library listing (user + newest first).
        Index(
            "idx_studio_images_user_created",
            "user_id",
            "created_at",
            postgresql_using="btree",
        ),
        # Partial index on active (non-deleted) rows for cheap filtering.
        Index(
            "idx_studio_images_active",
            "user_id",
            postgresql_where="deleted_at IS NULL",
        ),
    )


class StudioWorkflowRun(BaseModel):
    __tablename__ = "studio_workflow_runs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    intent: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="StudioIntent: MAKE_PROFESSIONAL | CHANGE_BACKGROUND | ENHANCE_QUALITY | VARIATION | CUSTOM",
    )
    is_batch: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    source_image_ids: Mapped[list] = mapped_column(JSONB, nullable=False)
    style_inputs: Mapped[dict] = mapped_column(JSONB, nullable=False)
    merged_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    ai_enrichments: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    variation_count: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="QUEUED",
        comment="WorkflowStatus: QUEUED | RUNNING | DONE | FAILED | PARTIAL",
    )
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "intent IN ('MAKE_PROFESSIONAL', 'CHANGE_BACKGROUND', 'ENHANCE_QUALITY', 'VARIATION', 'CUSTOM')",
            name="ck_studio_runs_intent",
        ),
        CheckConstraint(
            "status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'PARTIAL')",
            name="ck_studio_runs_status",
        ),
        CheckConstraint("variation_count <= 8", name="ck_studio_runs_variation_count"),
        Index("idx_studio_runs_user_id", "user_id"),
        Index("idx_studio_runs_status", "status"),
        Index(
            "idx_studio_runs_active",
            "user_id",
            postgresql_where="status IN ('QUEUED', 'RUNNING')",
        ),
    )
