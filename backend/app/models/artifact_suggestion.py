import uuid

from sqlalchemy import String, Boolean, Text, Enum, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ArtifactType, SuggestionAudience


class ArtifactSuggestion(BaseModel):
    __tablename__ = "artifact_suggestions"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    artifact_type: Mapped[ArtifactType] = mapped_column(
        Enum(ArtifactType, name="artifact_type", create_type=True),
        nullable=False,
    )
    artifact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    audience: Mapped[SuggestionAudience] = mapped_column(
        Enum(SuggestionAudience, name="suggestion_audience", create_type=True),
        nullable=False,
        default=SuggestionAudience.EXTERNAL,
    )
    selected: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Relationships
    project: Mapped["Project"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="suggestions",
    )

    __table_args__ = (
        Index("idx_artifact_suggestions_project_id", "project_id"),
    )
