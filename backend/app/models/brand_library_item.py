import uuid
from datetime import datetime

from sqlalchemy import Integer, Enum, ForeignKey, DateTime, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import LibraryItemStatus


class BrandLibraryItem(BaseModel):
    __tablename__ = "brand_library_items"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
    )
    published_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[LibraryItemStatus] = mapped_column(
        Enum(LibraryItemStatus, name="library_item_status", create_type=True),
        nullable=False,
        default=LibraryItemStatus.PENDING_REVIEW,
    )
    remix_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(nullable=True)

    # Relationships
    artifact: Mapped["Artifact"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    publisher: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (
        Index("idx_brand_library_items_artifact_id", "artifact_id"),
        Index("idx_brand_library_items_published_by", "published_by"),
        Index("idx_brand_library_items_status", "status"),
    )
