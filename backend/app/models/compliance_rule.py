import uuid

from sqlalchemy import String, Boolean, Text, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import ComplianceSeverity


class ComplianceRule(BaseModel):
    __tablename__ = "compliance_rules"

    rule_text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[ComplianceSeverity] = mapped_column(
        Enum(ComplianceSeverity, name="compliance_severity", create_type=True),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        Index("idx_compliance_rules_active", "id", postgresql_where="is_active = true"),
        Index("idx_compliance_rules_category", "category"),
        Index("idx_compliance_rules_created_by", "created_by"),
    )
