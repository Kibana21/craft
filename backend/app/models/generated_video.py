import uuid
from datetime import datetime

from sqlalchemy import Integer, String, Text, Enum, ForeignKey, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import VideoStatus


class GeneratedVideo(Base):
    """A single rendered video version. Status and progress are mutable; clip data is set on completion."""

    __tablename__ = "generated_videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    video_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("video_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[VideoStatus] = mapped_column(
        Enum(VideoStatus, name="video_status", create_type=True),
        nullable=False,
        default=VideoStatus.QUEUED,
        server_default="QUEUED",
    )
    progress_percent: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    current_scene: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    video_session: Mapped["VideoSession"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="generated_videos",
    )

    __table_args__ = (
        UniqueConstraint(
            "video_session_id",
            "version",
            name="uq_generated_videos_session_version",
        ),
        Index("idx_generated_videos_video_session_id", "video_session_id"),
        Index("idx_generated_videos_status", "status"),
    )
