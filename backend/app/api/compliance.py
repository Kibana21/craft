import asyncio
import uuid
from pathlib import Path

import redis.asyncio as redis
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rbac import require_brand_admin
from app.core.redis import get_redis
from app.models.user import User
from app.schemas.compliance import (
    CheckFieldRequest,
    CheckFieldResponse,
    ComplianceFlagResponse,
    CreateRuleRequest,
    UpdateRuleRequest,
    ComplianceRuleResponse,
    SuggestRuleRequest,
    SuggestRuleResponse,
    UploadDocumentRequest,
    ComplianceDocumentResponse,
    ComplianceDocumentDetailResponse,
    ComplianceScoreResponse,
)
from app.models.enums import DocumentType
from app.services.document_parser import extract_content_from_file
from app.services.compliance_service import (
    create_rule,
    list_rules,
    update_rule,
    upload_document,
    list_documents,
    get_document,
    delete_document,
    suggest_compliance_rule,
)
from app.services.compliance_scorer import score_artifact
from app.services.field_compliance_service import (
    check_field,
    invalidate_field_compliance_cache,
)

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


# ── Rules ─────────────────────────────────────────────────────────────────────

@router.post("/rules", response_model=ComplianceRuleResponse, status_code=201)
async def create_compliance_rule(
    data: CreateRuleRequest,
    current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
) -> ComplianceRuleResponse:
    rule = await create_rule(db, current_user.id, data)
    await invalidate_field_compliance_cache(redis_client)
    return ComplianceRuleResponse.model_validate(rule)


@router.get("/rules", response_model=list[ComplianceRuleResponse])
async def get_compliance_rules(
    active_only: bool = Query(False),
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ComplianceRuleResponse]:
    rules = await list_rules(db, active_only=active_only)
    return [ComplianceRuleResponse.model_validate(r) for r in rules]


@router.patch("/rules/{rule_id}", response_model=ComplianceRuleResponse)
async def update_compliance_rule(
    rule_id: uuid.UUID,
    data: UpdateRuleRequest,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
) -> ComplianceRuleResponse:
    rule = await update_rule(db, rule_id, data)
    await invalidate_field_compliance_cache(redis_client)
    return ComplianceRuleResponse.model_validate(rule)


@router.post("/rules/suggest", response_model=SuggestRuleResponse)
async def suggest_rule(
    data: SuggestRuleRequest,
    _current_user: User = Depends(require_brand_admin),
) -> SuggestRuleResponse:
    """AI-draft a compliance rule for the given category and optional hint."""
    rule_text = await suggest_compliance_rule(data.category, data.hint)
    return SuggestRuleResponse(rule_text=rule_text)


# ── Documents ─────────────────────────────────────────────────────────────────

@router.post("/documents", response_model=ComplianceDocumentResponse, status_code=201)
async def upload_compliance_document(
    data: UploadDocumentRequest,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> ComplianceDocumentResponse:
    doc = await upload_document(db, data)
    return ComplianceDocumentResponse.model_validate(doc)


ALLOWED_DOC_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
MAX_DOC_SIZE = 50 * 1024 * 1024  # 50 MB
_UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "documents"


async def _store_document_file(data: bytes, ext: str) -> str:
    filename = f"{uuid.uuid4().hex}{ext}"
    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = _UPLOAD_DIR / filename
    await asyncio.to_thread(path.write_bytes, data)
    return f"/uploads/documents/{filename}"


@router.post("/documents/upload-file", response_model=ComplianceDocumentResponse, status_code=201)
async def upload_compliance_document_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    document_type: DocumentType = Form(...),
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> ComplianceDocumentResponse:
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a PDF, DOCX, or plain text file.",
        )
    data = await file.read()
    if len(data) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50 MB.")
    content = await extract_content_from_file(data, file.content_type)

    file_ext = Path(file.filename or "doc").suffix or ".bin"
    file_url = await _store_document_file(data, file_ext)

    doc = await upload_document(
        db,
        UploadDocumentRequest(title=title, content=content, document_type=document_type),
    )
    doc.file_url = file_url
    doc.original_filename = file.filename
    doc.file_size = len(data)
    await db.flush()
    return ComplianceDocumentResponse.model_validate(doc)


@router.get("/documents", response_model=list[ComplianceDocumentResponse])
async def get_compliance_documents(
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ComplianceDocumentResponse]:
    docs = await list_documents(db)
    return [ComplianceDocumentResponse.model_validate(d) for d in docs]


@router.get("/documents/{doc_id}", response_model=ComplianceDocumentDetailResponse)
async def get_compliance_document_detail(
    doc_id: uuid.UUID,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> ComplianceDocumentDetailResponse:
    doc = await get_document(db, doc_id)
    return ComplianceDocumentDetailResponse.model_validate(doc)


@router.get("/documents/{doc_id}/download")
async def download_compliance_document(
    doc_id: uuid.UUID,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import FileResponse

    doc = await get_document(db, doc_id)
    if not doc.file_url:
        raise HTTPException(status_code=404, detail="No file attached to this document")
    file_path = Path(__file__).parent.parent.parent / doc.file_url.lstrip("/")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=str(file_path),
        filename=doc.original_filename or f"document{file_path.suffix}",
        media_type="application/octet-stream",
    )


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_compliance_document(
    doc_id: uuid.UUID,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_document(db, doc_id)


# ── Whole-artifact scoring ─────────────────────────────────────────────────────

@router.post("/score/{artifact_id}", response_model=ComplianceScoreResponse)
async def trigger_compliance_score(
    artifact_id: uuid.UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ComplianceScoreResponse:
    result = await score_artifact(db, artifact_id)
    return ComplianceScoreResponse(**result)


@router.get("/score/{artifact_id}", response_model=ComplianceScoreResponse)
async def get_compliance_score(
    artifact_id: uuid.UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ComplianceScoreResponse:
    result = await score_artifact(db, artifact_id)
    return ComplianceScoreResponse(**result)


# ── Per-field inline compliance (Phase E) ─────────────────────────────────────

@router.post("/check-field", response_model=CheckFieldResponse)
async def check_field_compliance(
    data: CheckFieldRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis),
) -> CheckFieldResponse:
    """Inline per-field compliance check for Step 3 copy fields.

    Returns flags in < 150 ms for cache hits, < 1.2 s for LLM-layer misses.
    Never blocks Continue — flags are advisory only.
    Rate limit: 60/min/user (enforced via middleware).
    """
    result = await check_field(
        db=db,
        redis_client=redis_client,
        field=data.field,
        text=data.text,
        tone=data.tone_context,
        content_hash=data.content_hash,
    )

    return CheckFieldResponse(
        flags=[
            ComplianceFlagResponse(
                pattern_type=f["pattern_type"],
                matched_phrase=f["matched_phrase"],
                severity=f["severity"],
                mas_basis=f["mas_basis"],
                suggestion=f.get("suggestion"),
                rule_id=uuid.UUID(f["rule_id"]) if f.get("rule_id") else None,
            )
            for f in result["flags"]
        ],
        cached=result["cached"],
    )
