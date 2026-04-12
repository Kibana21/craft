import uuid

from sqlalchemy import String, Boolean, Text, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import SpeakingStyle


class Presenter(BaseModel):
    __tablename__ = "presenters"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    age_range: Mapped[str] = mapped_column(String(50), nullable=False)
    appearance_keywords: Mapped[str] = mapped_column(String(500), nullable=False)
    full_appearance_description: Mapped[str] = mapped_column(Text, nullable=False)
    speaking_style: Mapped[SpeakingStyle] = mapped_column(
        Enum(SpeakingStyle, name="speaking_style", create_type=True),
        nullable=False,
    )
    is_library: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    deleted_at: Mapped[str | None] = mapped_column(nullable=True)

    # Relationships
    created_by: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        foreign_keys=[created_by_id],
    )

    __table_args__ = (
        Index("idx_presenters_created_by_id", "created_by_id"),
        Index("idx_presenters_is_library", "is_library"),
    )
