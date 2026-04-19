import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import ComplianceSeverity, DocumentType


class CreateRuleRequest(BaseModel):
    rule_text: str = Field(min_length=10)
    category: str = Field(min_length=1)
    severity: ComplianceSeverity


class UpdateRuleRequest(BaseModel):
    rule_text: str | None = None
    category: str | None = None
    severity: ComplianceSeverity | None = None
    is_active: bool | None = None


class ComplianceRuleResponse(BaseModel):
    id: uuid.UUID
    rule_text: str
    category: str
    severity: ComplianceSeverity
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UploadDocumentRequest(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=10)
    document_type: DocumentType


class ComplianceDocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    content_preview: str
    document_type: DocumentType
    chunk_index: int
    source_document_id: uuid.UUID | None = None
    file_url: str | None = None
    original_filename: str | None = None
    file_size: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ComplianceDocumentDetailResponse(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    document_type: DocumentType
    chunk_index: int
    source_document_id: uuid.UUID | None = None
    file_url: str | None = None
    original_filename: str | None = None
    file_size: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RuleResult(BaseModel):
    rule_id: str
    rule_text: str
    category: str
    severity: str
    passed: bool
    details: str | None = None


class DisclaimerResult(BaseModel):
    disclaimer: str
    present: bool
    required: bool


class ComplianceScoreResponse(BaseModel):
    score: float
    breakdown: dict
    suggestions: list[str]


# ── Per-field inline compliance (Phase E) ────────────────────────────────────

class CheckFieldRequest(BaseModel):
    field: Literal["headline", "subheadline", "body", "cta_text"]
    text: str = Field(min_length=1, max_length=2000)
    tone_context: str = Field(default="PROFESSIONAL")
    content_hash: str | None = None   # client-computed hash for client-side dedup


class ComplianceFlagResponse(BaseModel):
    pattern_type: Literal[
        "ABSOLUTE_CLAIM",
        "UNQUALIFIED_SUPERLATIVE",
        "MISLEADING_CERTAINTY",
        "MISSING_PRODUCT_QUALIFIER",
        "CUSTOM_RULE",
    ]
    matched_phrase: str
    severity: Literal["ERROR", "WARNING"]
    mas_basis: str
    suggestion: str | None = None
    rule_id: uuid.UUID | None = None


class CheckFieldResponse(BaseModel):
    flags: list[ComplianceFlagResponse]
    cached: bool


class SuggestRuleRequest(BaseModel):
    category: str = Field(min_length=1)
    hint: str | None = Field(None, max_length=300)


class SuggestRuleResponse(BaseModel):
    rule_text: str
