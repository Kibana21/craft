import uuid

from sqlalchemy import Integer, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import VideoSessionStep


class VideoSession(BaseModel):
    __tablename__ = "video_sessions"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    presenter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("presenters.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="60"
    )
    current_step: Mapped[VideoSessionStep] = mapped_column(
        Enum(VideoSessionStep, name="video_session_step", create_type=True),
        nullable=False,
        default=VideoSessionStep.PRESENTER,
        server_default="PRESENTER",
    )
    # Circular FK to video_scripts — use_alter=True breaks the creation cycle
    current_script_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "video_scripts.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_video_sessions_current_script_id",
        ),
        nullable=True,
    )
    # Circular FK to script_versions — use_alter=True breaks the creation cycle
    scenes_script_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "script_versions.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_video_sessions_scenes_script_version_id",
        ),
        nullable=True,
    )

    # Relationships
    artifact: Mapped["Artifact"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="video_session",
    )
    presenter: Mapped["Presenter"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        foreign_keys=[presenter_id],
    )
    current_script: Mapped["VideoScript | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        foreign_keys=[current_script_id],
        primaryjoin="VideoSession.current_script_id == VideoScript.id",
    )
    scenes: Mapped[list["Scene"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="video_session",
        order_by="Scene.sequence",
    )
    generated_videos: Mapped[list["GeneratedVideo"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="video_session",
        order_by="GeneratedVideo.version.desc()",
    )

    __table_args__ = (
        Index("idx_video_sessions_artifact_id", "artifact_id"),
        Index("idx_video_sessions_presenter_id", "presenter_id"),
        Index("idx_video_sessions_current_script_id", "current_script_id"),
        Index("idx_video_sessions_scenes_script_version_id", "scenes_script_version_id"),
    )
