import uuid
from datetime import datetime

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
    document_type: DocumentType
    chunk_index: int
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
