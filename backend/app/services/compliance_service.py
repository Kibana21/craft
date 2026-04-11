import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance_rule import ComplianceRule
from app.models.compliance_document import ComplianceDocument
from app.models.enums import ComplianceSeverity, DocumentType
from app.schemas.compliance import CreateRuleRequest, UpdateRuleRequest, UploadDocumentRequest


async def create_rule(
    db: AsyncSession, user_id: uuid.UUID, data: CreateRuleRequest
) -> ComplianceRule:
    rule = ComplianceRule(
        rule_text=data.rule_text,
        category=data.category,
        severity=data.severity,
        is_active=True,
        created_by=user_id,
    )
    db.add(rule)
    await db.flush()
    return rule


async def list_rules(
    db: AsyncSession, active_only: bool = False
) -> list[ComplianceRule]:
    query = select(ComplianceRule).order_by(ComplianceRule.created_at.desc())
    if active_only:
        query = query.where(ComplianceRule.is_active.is_(True))
    return list((await db.execute(query)).scalars().all())


async def update_rule(
    db: AsyncSession, rule_id: uuid.UUID, data: UpdateRuleRequest
) -> ComplianceRule:
    rule = (
        await db.execute(select(ComplianceRule).where(ComplianceRule.id == rule_id))
    ).scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    await db.flush()
    return rule


async def upload_document(
    db: AsyncSession, data: UploadDocumentRequest
) -> ComplianceDocument:
    """Store a compliance document. Chunking for RAG will be done when pgvector is available."""
    doc = ComplianceDocument(
        title=data.title,
        content=data.content,
        document_type=data.document_type,
        chunk_index=0,
    )
    db.add(doc)
    await db.flush()
    return doc


async def list_documents(db: AsyncSession) -> list[ComplianceDocument]:
    result = await db.execute(
        select(ComplianceDocument).order_by(ComplianceDocument.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_document(db: AsyncSession, doc_id: uuid.UUID) -> None:
    doc = (
        await db.execute(
            select(ComplianceDocument).where(ComplianceDocument.id == doc_id)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await db.delete(doc)
    await db.flush()
