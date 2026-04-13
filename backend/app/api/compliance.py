import uuid

import redis.asyncio as redis
from fastapi import APIRouter, Depends, Query
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
    UploadDocumentRequest,
    ComplianceDocumentResponse,
    ComplianceScoreResponse,
)
from app.services.compliance_service import (
    create_rule,
    list_rules,
    update_rule,
    upload_document,
    list_documents,
    delete_document,
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


# ── Documents ─────────────────────────────────────────────────────────────────

@router.post("/documents", response_model=ComplianceDocumentResponse, status_code=201)
async def upload_compliance_document(
    data: UploadDocumentRequest,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> ComplianceDocumentResponse:
    doc = await upload_document(db, data)
    return ComplianceDocumentResponse.model_validate(doc)


@router.get("/documents", response_model=list[ComplianceDocumentResponse])
async def get_compliance_documents(
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ComplianceDocumentResponse]:
    docs = await list_documents(db)
    return [ComplianceDocumentResponse.model_validate(d) for d in docs]


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
