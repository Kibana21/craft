import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, Integer, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PosterChatTurn(BaseModel):
    """Append-only log of Step 5 chat refinement turns. Retained 30 days."""

    __tablename__ = "poster_chat_turns"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="References content.generation.variants[].id — not a FK (JSONB)",
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False, comment="0-based; ≤5 at save-as-variant nudge")
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    ai_response: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="CHAT_REFINE | INPAINT | REDIRECT | TURN_LIMIT_NUDGE",
    )
    resulting_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    inpaint_mask_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    structural_change_detected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True when classifier redirects instead of processing",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    artifact: Mapped["Artifact"] = relationship()  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        CheckConstraint(
            "action_type IN ('CHAT_REFINE', 'INPAINT', 'REDIRECT', 'TURN_LIMIT_NUDGE')",
            name="ck_poster_chat_turns_action_type",
        ),
        Index("idx_poster_chat_turns_artifact_id", "artifact_id"),
        Index("idx_poster_chat_turns_variant_id", "variant_id"),
        Index("idx_poster_chat_turns_created_at", "created_at"),
    )


class PosterReferenceImage(BaseModel):
    """Session-temporary reference image uploaded in Step 2 (product/asset subject).
    TTL enforced by sweep_expired_reference_images job.
    """

    __tablename__ = "poster_reference_images"

    uploader_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    artifact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=True,
        comment="Populated once the wizard draft artifact exists",
    )
    storage_url: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="image/png | image/jpeg | image/webp",
    )
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, comment="Hard cap: 20 MB")
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        comment="Default now() + 24h; enforced by sweep job",
    )

    __table_args__ = (
        CheckConstraint("size_bytes <= 20971520", name="ck_poster_ref_images_size"),
        CheckConstraint(
            "mime_type IN ('image/png', 'image/jpeg', 'image/webp')",
            name="ck_poster_ref_images_mime_type",
        ),
        Index("idx_poster_reference_images_uploader_id", "uploader_id"),
        Index("idx_poster_reference_images_artifact_id", "artifact_id"),
        Index("idx_poster_reference_images_expires_at", "expires_at"),
    )
