import uuid

from sqlalchemy import String, Integer, Text, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import DocumentType


class ComplianceDocument(BaseModel):
    __tablename__ = "compliance_documents"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # embedding column will be added when pgvector is installed
    # embedding: Mapped[...] = mapped_column(Vector(768), nullable=True)
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", create_type=True),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    __table_args__ = (
        Index("idx_compliance_documents_type", "document_type"),
        Index("idx_compliance_documents_source", "source_document_id"),
    )
