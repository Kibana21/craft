import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, text
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
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    changelog: Mapped[str | None] = mapped_column(Text, nullable=True)
    activated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    color_names: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    zone_roles: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("idx_brand_kit_updated_by", "updated_by"),
        Index("idx_brand_kit_activated_by", "activated_by"),
        Index(
            "idx_brand_kit_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )
