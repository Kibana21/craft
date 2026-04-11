import uuid

from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class BrandKit(BaseModel):
    __tablename__ = "brand_kit"

    name: Mapped[str] = mapped_column(String(255), nullable=False, server_default="Default")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    secondary_logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#D0103A")
    secondary_color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#1A1A18")
    accent_color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#1B9D74")
    fonts: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    version: Mapped[int] = mapped_column(nullable=False, server_default="1")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        Index("idx_brand_kit_updated_by", "updated_by"),
    )
