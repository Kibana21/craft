import uuid

from sqlalchemy import Integer, String, Text, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import CameraFraming


class Scene(BaseModel):
    __tablename__ = "scenes"

    video_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("video_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dialogue: Mapped[str] = mapped_column(Text, nullable=False)
    setting: Mapped[str] = mapped_column(Text, nullable=False)
    camera_framing: Mapped[CameraFraming] = mapped_column(
        Enum(CameraFraming, name="camera_framing", create_type=True),
        nullable=False,
        default=CameraFraming.MEDIUM_SHOT,
        server_default="MEDIUM_SHOT",
    )
    merged_prompt: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # Tracks which script version was active when this scene was generated
    # Used for staleness detection in Phase 4
    script_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("script_versions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    video_session: Mapped["VideoSession"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="scenes",
    )

    __table_args__ = (
        # Constraint is created DEFERRABLE INITIALLY DEFERRED by the migration (raw SQL)
        # so sequence renumbering within a transaction doesn't violate uniqueness mid-update.
        UniqueConstraint(
            "video_session_id",
            "sequence",
            name="uq_scenes_session_sequence",
        ),
        Index("idx_scenes_video_session_id", "video_session_id"),
        Index("idx_scenes_script_version_id", "script_version_id"),
    )
