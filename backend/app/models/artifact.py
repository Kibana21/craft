import uuid

from sqlalchemy import String, Float, Integer, Enum, ForeignKey, CheckConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ArtifactType, ArtifactChannel, ArtifactFormat, ArtifactStatus


class Artifact(BaseModel):
    __tablename__ = "artifacts"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[ArtifactType] = mapped_column(
        Enum(ArtifactType, name="artifact_type", create_type=True),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    channel: Mapped[ArtifactChannel | None] = mapped_column(
        Enum(ArtifactChannel, name="artifact_channel", create_type=True),
        nullable=True,
    )
    format: Mapped[ArtifactFormat | None] = mapped_column(
        Enum(ArtifactFormat, name="artifact_format", create_type=True),
        nullable=True,
    )
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    compliance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[ArtifactStatus] = mapped_column(
        Enum(ArtifactStatus, name="artifact_status", create_type=True),
        nullable=False,
        default=ArtifactStatus.DRAFT,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    deleted_at: Mapped[str | None] = mapped_column(nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="artifacts",
    )
    creator: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    video_session: Mapped["VideoSession | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="artifact",
        uselist=False,
    )

    __table_args__ = (
        CheckConstraint(
            "compliance_score IS NULL OR (compliance_score >= 0 AND compliance_score <= 100)",
            name="ck_artifacts_compliance_score_range",
        ),
        Index("idx_artifacts_project_id", "project_id"),
        Index("idx_artifacts_creator_id", "creator_id"),
        Index("idx_artifacts_type", "type"),
        Index("idx_artifacts_status", "status"),
    )
