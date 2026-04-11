import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, DateTime, func, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ProjectMemberRole


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[ProjectMemberRole] = mapped_column(
        Enum(ProjectMemberRole, name="project_member_role", create_type=True),
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="members",
    )
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
        Index("idx_project_members_project_id", "project_id"),
        Index("idx_project_members_user_id", "user_id"),
    )
