import uuid

from sqlalchemy import String, Enum, ForeignKey, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ProjectType, ProjectPurpose


class Project(BaseModel):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[ProjectType] = mapped_column(
        Enum(ProjectType, name="project_type", create_type=True),
        nullable=False,
    )
    purpose: Mapped[ProjectPurpose] = mapped_column(
        Enum(ProjectPurpose, name="project_purpose", create_type=True),
        nullable=False,
        default=ProjectPurpose.CAMPAIGN,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    product: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(String(500), nullable=True)
    campaign_period: Mapped[str | None] = mapped_column(String(255), nullable=True)
    key_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand_kit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brand_kit.id", ondelete="SET NULL"),
        nullable=True,
    )
    brief: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="active"
    )
    deleted_at: Mapped[str | None] = mapped_column(nullable=True)

    # Relationships
    owner: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="owned_projects",
        foreign_keys=[owner_id],
    )
    members: Mapped[list["ProjectMember"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="project",
        cascade="all, delete-orphan",
    )
    artifacts: Mapped[list["Artifact"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="project",
        cascade="all, delete-orphan",
    )
    suggestions: Mapped[list["ArtifactSuggestion"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="project",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_projects_owner_id", "owner_id"),
        Index("idx_projects_type", "type"),
        Index("idx_projects_brand_kit_id", "brand_kit_id"),
    )
