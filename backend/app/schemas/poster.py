"""Pydantic schemas for the Poster Wizard.

PosterContent mirrors the `artifacts.content` JSONB shape for type=POSTER
(see 01-data-model-and-migrations.md). All sub-fields carry defaults so that
partial saves (step-by-step) always pass validation.

Validation is intentionally lenient about *which* fields are populated but
strict about *types*: a wrong type (e.g. a list where a string is expected)
raises 422 VALIDATION_ERROR. Enum-value enforcement is deferred to Phase E
inline compliance.
"""
import enum
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ── Domain enums ──────────────────────────────────────────────────────────────


class CampaignObjective(str, enum.Enum):
    PRODUCT_LAUNCH = "PRODUCT_LAUNCH"
    BRAND_AWARENESS = "BRAND_AWARENESS"
    SEASONAL_PROMOTION = "SEASONAL_PROMOTION"
    AGENT_ENABLEMENT = "AGENT_ENABLEMENT"
    CUSTOMER_RETENTION = "CUSTOMER_RETENTION"


class Tone(str, enum.Enum):
    PROFESSIONAL = "PROFESSIONAL"
    INSPIRATIONAL = "INSPIRATIONAL"
    WARM = "WARM"
    URGENT = "URGENT"
    EMPATHETIC = "EMPATHETIC"


class PostureFraming(str, enum.Enum):
    FACING_CAMERA = "FACING_CAMERA"
    THREE_QUARTER = "THREE_QUARTER"
    PROFILE = "PROFILE"
    LOOKING_UP = "LOOKING_UP"


class VisualStyle(str, enum.Enum):
    PHOTOREALISTIC = "PHOTOREALISTIC"
    EDITORIAL_GRAPHIC = "EDITORIAL_GRAPHIC"
    ILLUSTRATED = "ILLUSTRATED"
    ABSTRACT = "ABSTRACT"


class SubjectType(str, enum.Enum):
    HUMAN_MODEL = "HUMAN_MODEL"
    PRODUCT_ASSET = "PRODUCT_ASSET"
    SCENE_ABSTRACT = "SCENE_ABSTRACT"


class PosterFormat(str, enum.Enum):
    PORTRAIT = "PORTRAIT"
    SQUARE = "SQUARE"
    LANDSCAPE = "LANDSCAPE"
    STORY = "STORY"
    CUSTOM = "CUSTOM"


# ── JSONB content sub-schemas (used for artifact.content validation) ───────────


class BriefContent(BaseModel):
    title: str = ""
    campaign_objective: str = ""  # CampaignObjective value
    target_audience: str = ""
    tone: str = ""               # Tone value
    call_to_action: str = ""
    narrative: str = Field("", max_length=1500)

    model_config = {"extra": "ignore"}


class HumanModelSubject(BaseModel):
    appearance_keywords: str = ""
    expression_mood: str = ""
    full_appearance: str = ""
    posture_framing: str = ""  # PostureFraming value

    model_config = {"extra": "ignore"}


class ProductAssetSubject(BaseModel):
    reference_image_ids: list[str] = Field(default_factory=list)
    placement: str = ""            # HERO_CENTRED | LIFESTYLE_CONTEXT | DETAIL_CLOSE | FLOATING
    background_treatment: str = "" # REPLACE | EXTEND | KEEP_ORIGINAL | ABSTRACT_BLEND

    model_config = {"extra": "ignore"}


class SceneAbstractSubject(BaseModel):
    description: str = ""
    visual_style: str = ""  # VisualStyle value

    model_config = {"extra": "ignore"}


class SubjectContent(BaseModel):
    type: str = ""  # SubjectType value
    human_model: HumanModelSubject = Field(default_factory=HumanModelSubject)
    product_asset: ProductAssetSubject = Field(default_factory=ProductAssetSubject)
    scene_abstract: SceneAbstractSubject = Field(default_factory=SceneAbstractSubject)
    locked: bool = False

    model_config = {"extra": "ignore"}


class ComplianceFlagSchema(BaseModel):
    field: str
    pattern_type: str
    matched_phrase: str
    severity: str  # WARNING | ERROR
    at: str        # ISO-8601 timestamp

    model_config = {"extra": "ignore"}


class CopyContent(BaseModel):
    headline: str = ""
    subheadline: str = ""
    body: str = ""
    cta_text: str = ""
    brand_tagline: str = ""
    regulatory_disclaimer: str = ""
    compliance_flags: list[ComplianceFlagSchema] = Field(default_factory=list)

    model_config = {"extra": "ignore"}


class CompositionContent(BaseModel):
    format: str = ""           # PosterFormat value
    layout_template: str = ""  # HERO_DOMINANT | SPLIT | FRAME_BORDER | TYPOGRAPHIC | FULL_BLEED
    visual_style: str = ""     # CLEAN_CORPORATE | WARM_HUMAN | BOLD_HIGH_CONTRAST | …
    palette: list[str] = Field(default_factory=list)
    merged_prompt: str = ""
    merged_prompt_stale: bool = False
    prompt_generated_at: str | None = None

    model_config = {"extra": "ignore"}


class ChangeLogEntrySchema(BaseModel):
    id: str
    description: str
    accepted_at: str  # ISO-8601

    model_config = {"extra": "ignore"}


class VariantContent(BaseModel):
    id: str
    image_url: str | None = None
    generated_at: str | None = None
    status: str = "PENDING"  # PENDING | GENERATING | READY | FAILED
    selected: bool = False
    parent_variant_id: str | None = None
    change_log: list[ChangeLogEntrySchema] = Field(default_factory=list)

    model_config = {"extra": "ignore"}


class GenerationState(BaseModel):
    variants: list[VariantContent] = Field(default_factory=list)
    last_generation_job_id: str | None = None
    turn_count_on_selected: int = 0

    model_config = {"extra": "ignore"}


# ── Top-level JSONB schema ─────────────────────────────────────────────────────


class PosterContent(BaseModel):
    """Full content schema for artifacts where type=POSTER.

    All sub-objects have defaults so partial step saves are always valid.
    `schema_version` must be 1; unknown versions are rejected at the API boundary.
    """
    schema_version: int = 1
    brief: BriefContent = Field(default_factory=BriefContent)
    subject: SubjectContent = Field(default_factory=SubjectContent)
    copy: CopyContent = Field(default_factory=CopyContent)
    composition: CompositionContent = Field(default_factory=CompositionContent)
    generation: GenerationState = Field(default_factory=GenerationState)

    @field_validator("schema_version")
    @classmethod
    def version_must_be_known(cls, v: int) -> int:
        if v != 1:
            raise ValueError(
                f"Unknown poster content schema_version: {v}. Only version 1 is supported."
            )
        return v

    model_config = {"extra": "ignore"}


# ── Sweep / admin response schemas ────────────────────────────────────────────


class SweepResultResponse(BaseModel):
    deleted_count: int
    swept_at: datetime

    model_config = {"from_attributes": True}


# ── Reference image schemas ───────────────────────────────────────────────────


class PosterReferenceImageResponse(BaseModel):
    id: uuid.UUID
    uploader_id: uuid.UUID
    artifact_id: uuid.UUID | None
    storage_url: str
    mime_type: str
    size_bytes: int
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class RefImageUploadResponse(BaseModel):
    """Slim upload response returned by POST /api/uploads/reference-image-temp."""
    id: uuid.UUID
    storage_url: str
    expires_at: datetime

    model_config = {"from_attributes": True}


# ── Shared API types ──────────────────────────────────────────────────────────


class CopyValues(BaseModel):
    """Snapshot of copy fields — used as both input context and rewrite result."""
    headline: str = ""
    subheadline: str = ""
    body: str = ""
    cta_text: str = ""

    model_config = {"extra": "ignore"}


class CompositionSettings(BaseModel):
    format: str
    layout_template: str
    visual_style: str
    palette: list[str] = Field(default_factory=list)

    model_config = {"extra": "ignore"}


# ── Phase B — AI text endpoints ───────────────────────────────────────────────


class GenerateBriefRequest(BaseModel):
    """POST /api/ai/poster/generate-brief"""
    campaign_objective: CampaignObjective
    target_audience: str = Field(min_length=1, max_length=500)
    tone: Tone
    call_to_action: str = Field(min_length=1, max_length=300)
    existing_brief: str | None = None


class GenerateBriefResponse(BaseModel):
    brief: str
    generation_id: uuid.UUID


class AppearanceParagraphRequest(BaseModel):
    """POST /api/ai/poster/generate-appearance-paragraph"""
    appearance_keywords: str
    expression_mood: str
    posture_framing: PostureFraming
    brief_context: str | None = None


class AppearanceParagraphResponse(BaseModel):
    paragraph: str
    word_count: int


class SceneDescriptionRequest(BaseModel):
    """POST /api/ai/poster/generate-scene-description"""
    visual_style: VisualStyle
    brief_context: str | None = None
    seed_hint: str | None = None


class SceneDescriptionResponse(BaseModel):
    description: str


class CopyDraftAllRequest(BaseModel):
    """POST /api/ai/poster/copy-draft-all"""
    brief: str
    tone: Tone
    campaign_objective: CampaignObjective
    audience: str | None = None


class CopyDraftAllResponse(BaseModel):
    headline: str
    subheadline: str
    body: str
    cta_text: str


class CopyDraftFieldRequest(BaseModel):
    """POST /api/ai/poster/copy-draft-field"""
    field: Literal["headline", "subheadline", "body", "cta_text"]
    brief: str
    tone: Tone
    current_values: CopyValues


class CopyDraftFieldResponse(BaseModel):
    value: str


class ToneRewriteRequest(BaseModel):
    """POST /api/ai/poster/tone-rewrite"""
    rewrite_tone: Literal["SHARPER", "WARMER", "MORE_URGENT", "SHORTER"]
    current_copy: CopyValues


class ToneRewriteResponse(BaseModel):
    rewritten: CopyValues


# ── Phase C — Image generation ────────────────────────────────────────────────


class CompositionPromptRequest(BaseModel):
    """POST /api/ai/poster/generate-composition-prompt"""
    brief: BriefContent
    subject: SubjectContent
    copy: CopyValues
    composition_settings: CompositionSettings


class CompositionPromptResponse(BaseModel):
    merged_prompt: str
    style_sentence: str


class Variant(BaseModel):
    id: uuid.UUID
    slot: int
    status: Literal["READY", "FAILED"]
    image_url: str | None = None
    error_code: str | None = None
    retry_token: str | None = None


class GenerateVariantsRequest(BaseModel):
    """POST /api/ai/poster/generate-variants"""
    artifact_id: uuid.UUID
    merged_prompt: str
    subject_type: SubjectType
    reference_image_ids: list[uuid.UUID] = Field(default_factory=list)
    count: int = 4
    format: PosterFormat


class GenerateVariantsResponse(BaseModel):
    job_id: uuid.UUID
    variants: list[Variant]
    partial_failure: bool


class GenerateVariantsJobResponse(BaseModel):
    """Returned immediately (202) when a generation job is dispatched to the worker."""
    job_id: str
    status: Literal["QUEUED"]


class VariantJobStatusResponse(BaseModel):
    """Polling response for GET /generate-variants/{job_id}/status."""
    job_id: str
    status: Literal["QUEUED", "RUNNING", "READY", "FAILED"]
    variants: list[Variant]
    partial_failure: bool
    error: str | None = None


class RetryVariantRequest(BaseModel):
    """POST /api/ai/poster/generate-variants/retry"""
    artifact_id: uuid.UUID
    job_id: uuid.UUID
    slot: int
    retry_token: str
    merged_prompt: str
    subject_type: SubjectType
    reference_image_ids: list[uuid.UUID] = Field(default_factory=list)


class RetryVariantResponse(BaseModel):
    variant: Variant


# ── Phase D — Chat refinement ─────────────────────────────────────────────────


class RefineChatRequest(BaseModel):
    """POST /api/ai/poster/refine-chat"""
    artifact_id: uuid.UUID
    variant_id: uuid.UUID
    user_message: str
    change_history: list[ChangeLogEntrySchema]
    original_merged_prompt: str


class RefineChatResponse(BaseModel):
    turn_id: uuid.UUID
    ai_response: str
    change_description: str
    new_image_url: str | None
    action_type: Literal["CHAT_REFINE", "REDIRECT", "TURN_LIMIT_NUDGE"]
    redirect_target: Literal["STEP_2_SUBJECT", "STEP_3_COPY", "STEP_4_COMPOSITION"] | None
    turn_index: int


class InpaintResponse(BaseModel):
    turn_id: uuid.UUID
    new_image_url: str
    change_description: str


class ClassifyStructuralChangeRequest(BaseModel):
    """POST /api/ai/poster/classify-structural-change"""
    message: str


class ClassifyStructuralChangeResponse(BaseModel):
    is_structural: bool
    target: Literal["STEP_2_SUBJECT", "STEP_3_COPY", "STEP_4_COMPOSITION"] | None
    confidence: float


class SaveAsVariantRequest(BaseModel):
    """POST /api/artifacts/{id}/save-as-variant"""
    variant_id: uuid.UUID


class SaveAsVariantResponse(BaseModel):
    new_variant_id: uuid.UUID


# ── Phase E — Per-field compliance ────────────────────────────────────────────


class ComplianceFlagItem(BaseModel):
    field: str
    pattern_type: str
    matched_phrase: str
    severity: Literal["WARNING", "ERROR"]


class CheckFieldRequest(BaseModel):
    """POST /api/compliance/check-field"""
    field: Literal["headline", "subheadline", "body", "cta_text"]
    text: str
    tone_context: Tone
    content_hash: str | None = None


class CheckFieldResponse(BaseModel):
    flags: list[ComplianceFlagItem]
    cached: bool


# ── Phase E — 2× Upscale ──────────────────────────────────────────────────────


class UpscaleVariantRequest(BaseModel):
    """POST /api/ai/poster/upscale"""
    artifact_id: uuid.UUID
    variant_id: uuid.UUID


class UpscaleVariantResponse(BaseModel):
    image_url: str
    width: int
    height: int
