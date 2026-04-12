import uuid
from datetime import datetime

from sqlalchemy import Text, Enum, ForeignKey, DateTime, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ScriptAction


class ScriptVersion(Base):
    """Immutable snapshot of a script at a point in time. Never updated after creation."""

    __tablename__ = "script_versions"

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
    content: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[ScriptAction] = mapped_column(
        Enum(ScriptAction, name="script_action", create_type=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    video_session: Mapped["VideoSession"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        foreign_keys=[video_session_id],
        back_populates=None,
    )

    __table_args__ = (
        Index("idx_script_versions_video_session_id", "video_session_id"),
    )
