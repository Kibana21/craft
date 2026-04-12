import uuid

from sqlalchemy import Integer, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class VideoScript(BaseModel):
    __tablename__ = "video_scripts"

    video_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("video_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    estimated_duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )

    # Relationships
    video_session: Mapped["VideoSession"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        foreign_keys=[video_session_id],
    )

    __table_args__ = (
        Index("idx_video_scripts_video_session_id", "video_session_id"),
    )
