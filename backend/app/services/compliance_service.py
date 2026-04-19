import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance_rule import ComplianceRule
from app.models.compliance_document import ComplianceDocument
from app.models.enums import ComplianceSeverity, DocumentType
from app.schemas.compliance import CreateRuleRequest, UpdateRuleRequest, UploadDocumentRequest

logger = logging.getLogger(__name__)


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


async def get_document(db: AsyncSession, doc_id: uuid.UUID) -> ComplianceDocument:
    doc = (
        await db.execute(
            select(ComplianceDocument).where(ComplianceDocument.id == doc_id)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


async def list_documents(db: AsyncSession) -> list[ComplianceDocument]:
    result = await db.execute(
        select(ComplianceDocument)
        .where(ComplianceDocument.source_document_id.is_(None))
        .order_by(ComplianceDocument.created_at.desc())
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


_CATEGORY_CONTEXT = {
    "disclaimer_required": "rules that mandate specific MAS-required disclaimer text be present in all insurance advertisements",
    "prohibited_claim": "rules that ban specific words, phrases, or claim types that are misleading or unsubstantiated under MAS FAA-N16 and the Insurance Act",
    "benefit_illustration": "rules that govern how benefit illustrations must be presented — including non-guaranteed nature, assumed rates of return, and projection disclaimers",
    "competitor_reference": "rules that prohibit or restrict references to named competitor products or companies",
    "testimonial": "rules that govern the use of customer testimonials, including required disclaimers that individual results may vary",
}


async def suggest_compliance_rule(category: str, hint: str | None) -> str:
    """Use Gemini to draft a precise, MAS-aligned compliance rule.

    Returns the suggested rule text. Falls back to a generic prompt if the
    Gemini call fails so the endpoint never returns a 500 for an AI blip.
    """
    from app.services.ai_service import _gemini_model  # local import — avoids circular dependency at module load

    category_ctx = _CATEGORY_CONTEXT.get(category, f"rules related to '{category}'")
    hint_section = f"\n\nThe admin has provided this starting point or keyword to base the rule on:\n\"{hint}\"" if hint else ""

    prompt = f"""You are a compliance specialist for AIA Singapore, an insurance company regulated by the Monetary Authority of Singapore (MAS).

Your task is to draft a single, enforceable compliance rule for the following category:
Category: {category_ctx}{hint_section}

Requirements for the rule:
- Be specific and unambiguous — describe exactly what is required or prohibited
- Reference the relevant MAS regulation where applicable (e.g. MAS FAA-N16, Insurance Act Cap 142, MAS Notice on Prevention of Money Laundering)
- Use clear, direct language — one or two sentences maximum
- Focus on content creators (staff writing marketing copy and social media posts for AIA Singapore)
- Do NOT include preamble, explanation, or bullet points — return ONLY the rule text itself

Rule:"""

    try:
        model = _gemini_model()
        response = await model.generate_content(prompt)
        text = response.text.strip()
        # Strip any leading label the model may have echoed (e.g. "Rule: ...")
        for prefix in ("Rule:", "rule:", "RULE:"):
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
        return text
    except Exception:
        logger.warning("Gemini rule suggestion failed", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="AI suggestion unavailable — please write the rule manually.",
        )
