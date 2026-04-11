import uuid

from sqlalchemy import String, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import UserRole


class User(BaseModel):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_type=True),
        nullable=False,
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True)

    # Relationships
    owned_projects: Mapped[list["Project"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="owner",
        foreign_keys="Project.owner_id",
    )

    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
        Index("idx_users_agent_id", "agent_id"),
    )
