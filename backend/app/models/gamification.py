import uuid
from datetime import date, datetime

from sqlalchemy import String, Integer, Date, DateTime, Enum, ForeignKey, func, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
import enum


class PointsAction(str, enum.Enum):
    CREATE_ARTIFACT = "create_artifact"
    EXPORT = "export"
    REMIX = "remix"
    STREAK_BONUS = "streak_bonus"
    VIDEO_GENERATED = "video_generated"


class UserPoints(Base):
    __tablename__ = "user_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    total_points: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    longest_streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_user_points_user_id", "user_id"),
        Index("idx_user_points_total", "total_points"),
    )


class PointsLog(Base):
    __tablename__ = "points_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[PointsAction] = mapped_column(
        String(50), nullable=False
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    related_artifact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artifacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_points_log_user_id", "user_id"),
        Index("idx_points_log_artifact_id", "related_artifact_id"),
    )
