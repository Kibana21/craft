"""My Studio — Pydantic request/response schemas (Phase A+).

Response shapes mirror `StudioImage` + `StudioWorkflowRun` ORM columns plus a
few derived/nested fields for the Detail view.

`style_inputs` on `studio_workflow_runs` is a JSONB column whose shape depends
on the run's `intent`. We model each shape as its own Pydantic class; the API
boundary (Phase B generate/prompt-builder endpoints) picks the right validator
using the run's `intent` field — the union is not a discriminated model so the
column can remain schema-less JSONB for forward-compat.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Union

from pydantic import BaseModel, Field, model_validator


# ── Enums mirrored as Literals for stricter client-facing validation ──────────

StudioImageTypeLit = Literal["PHOTO", "AI_GENERATED", "ENHANCED", "POSTER_EXPORT"]
StudioIntentLit = Literal[
    "MAKE_PROFESSIONAL", "CHANGE_BACKGROUND", "ENHANCE_QUALITY", "VARIATION", "CUSTOM"
]
WorkflowStatusLit = Literal["QUEUED", "RUNNING", "DONE", "FAILED", "PARTIAL"]


# ── Library responses ─────────────────────────────────────────────────────────


class StudioImageResponse(BaseModel):
    """Shape returned from list / upload / rename endpoints."""

    id: uuid.UUID
    name: str
    type: StudioImageTypeLit
    storage_url: str
    thumbnail_url: str | None = None
    mime_type: str
    size_bytes: int
    width_px: int | None = None
    height_px: int | None = None
    source_image_id: uuid.UUID | None = None
    workflow_run_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunSummary(BaseModel):
    """Compact run shape used in detail view + recent-runs list."""

    id: uuid.UUID
    intent: StudioIntentLit
    is_batch: bool
    status: WorkflowStatusLit
    progress_percent: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StudioImageDetailResponse(StudioImageResponse):
    """Detail view — includes nested source + run so the client renders in one fetch."""

    source_image: StudioImageResponse | None = None
    workflow_run: WorkflowRunSummary | None = None
    prompt_used: str | None = None


class StudioImageListResponse(BaseModel):
    items: list[StudioImageResponse]
    total: int
    page: int
    per_page: int


# ── Library requests ──────────────────────────────────────────────────────────


class RenameImageRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tags: list[str] | None = None


# ── Workflow run status (Phase B+) ────────────────────────────────────────────


class WorkflowRunStatusResponse(WorkflowRunSummary):
    outputs: list[StudioImageResponse] = Field(default_factory=list)
    error: str | None = None


# ── Workflow requests (Phase B) ───────────────────────────────────────────────

VariationCountLit = Literal[1, 2, 4, 8]


class PromptBuilderRequest(BaseModel):
    """POST /api/studio/workflows/prompt-builder.

    `style_inputs` is validated at the API boundary against the matching
    per-intent model via `validate_style_inputs()`. We accept a raw dict here
    so each intent's schema can evolve without changing this envelope.
    """

    intent: StudioIntentLit
    style_inputs: dict
    source_image_id: uuid.UUID | None = None
    variation_count: VariationCountLit = 4

    model_config = {"extra": "forbid"}


class PromptBuilderResponse(BaseModel):
    merged_prompt: str
    ai_enrichments: list[str]


class GenerateWorkflowRequest(BaseModel):
    """POST /api/studio/workflows/generate.

    Single-image run: `is_batch=False`, `source_image_ids` length 0 (Text→Image)
    or 1 (Image→Image). Batch run: `is_batch=True`, length 2–20.
    """

    intent: StudioIntentLit
    style_inputs: dict
    source_image_ids: list[uuid.UUID] = Field(default_factory=list)
    merged_prompt: str = Field(min_length=1)
    variation_count: VariationCountLit = 4
    is_batch: bool = False

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _validate_shape(self):  # type: ignore[no-untyped-def]
        n = len(self.source_image_ids)
        if self.is_batch:
            if n < 2 or n > 20:
                raise ValueError("batch runs require 2–20 source_image_ids")
            if self.variation_count == 8:
                # Caps batch total at 40 — PRD §11.5 / plan doc 04.
                raise ValueError("batch runs cap variation_count at 4")
        else:
            if n > 1:
                raise ValueError("single runs take 0 or 1 source_image_id")
        return self


class GenerateWorkflowResponse(BaseModel):
    run_id: uuid.UUID
    status: WorkflowStatusLit


class RetrySlotRequest(BaseModel):
    """POST /api/studio/workflows/{run_id}/retry-slot.

    `source_image_id` is null for Text→Image runs (no source); required for
    Image→Image runs.
    """

    source_image_id: uuid.UUID | None = None
    slot: int = Field(ge=0, le=7)  # variation_count max is 8

    model_config = {"extra": "forbid"}


class RetrySlotResponse(BaseModel):
    output: StudioImageResponse


class DiscardOutputsResponse(BaseModel):
    """POST /api/studio/workflows/{run_id}/discard-outputs."""

    discarded_count: int


# ── Style-input shapes per intent (PRD §9.6 / plan doc 01) ────────────────────
# The Phase B prompt-builder + generate endpoints call `validate_style_inputs()`
# with the intent enum and the raw dict; it returns the typed model.

SettingLit = Literal["OFFICE", "OUTDOOR", "STUDIO", "BLURRED"]
AttireLit = Literal["KEEP", "MORE_FORMAL"]
MoodLit = Literal["CONFIDENT", "WARM", "APPROACHABLE"]


class MakeProfessionalInputs(BaseModel):
    """PRD §9.6 Make it professional."""

    setting: list[SettingLit] = Field(min_length=1)
    attire: AttireLit
    mood: MoodLit
    notes: str | None = Field(default=None, max_length=500)

    model_config = {"extra": "forbid"}


BackgroundTypeLit = Literal[
    "OFFICE_INTERIOR",
    "OUTDOOR_NATURE",
    "CITY_SKYLINE",
    "ABSTRACT",
    "PLAIN_COLOUR",
    "CUSTOM",
]
LightingMatchLit = Literal["MATCH", "RELIGHT"]


class ChangeBackgroundInputs(BaseModel):
    """PRD §9.6 Change the background. `description` is required iff
    `new_background == CUSTOM`."""

    new_background: BackgroundTypeLit
    lighting_match: LightingMatchLit
    description: str | None = Field(default=None, max_length=500)

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _require_description_for_custom(self):  # type: ignore[no-untyped-def]
        if self.new_background == "CUSTOM" and not (self.description and self.description.strip()):
            raise ValueError("description is required when new_background is CUSTOM")
        return self


FocusAreaLit = Literal["LIGHTING", "SHARPNESS", "COLOUR", "SKIN_TONES", "BG_BLUR"]
OutputResolutionLit = Literal["SAME", "UPSCALE_2X", "UPSCALE_4X"]


class EnhanceQualityInputs(BaseModel):
    """PRD §9.6 Enhance quality."""

    focus_areas: list[FocusAreaLit] = Field(min_length=1)
    output_resolution: OutputResolutionLit = "SAME"

    model_config = {"extra": "forbid"}


KeepConsistentLit = Literal["IDENTITY", "PALETTE", "COMPOSITION", "MOOD"]
StyleDirectionLit = Literal["SAME", "MORE_PROFESSIONAL", "MORE_ARTISTIC", "MORE_VIBRANT"]


class VariationInputs(BaseModel):
    """PRD §9.6 Generate a variation. `difference_level` is the slider value
    from 10 (subtle) to 90 (very different)."""

    difference_level: int = Field(ge=10, le=90)
    keep_consistent: list[KeepConsistentLit] = Field(default_factory=list)
    style_direction: StyleDirectionLit = "SAME"

    model_config = {"extra": "forbid"}


class CustomInputs(BaseModel):
    """PRD §9.6 Custom — free-text description."""

    description: str = Field(min_length=1, max_length=1000)
    use_source_as_reference: bool = True

    model_config = {"extra": "forbid"}


# Union helper for callers that want an annotation. The runtime validator
# (`validate_style_inputs`) is the preferred entry point — the union itself
# can't be used as a Pydantic discriminator because `intent` lives on the
# parent row, not inside the style-inputs JSONB.
StyleInputs = Union[
    MakeProfessionalInputs,
    ChangeBackgroundInputs,
    EnhanceQualityInputs,
    VariationInputs,
    CustomInputs,
]


_INTENT_TO_MODEL: dict[str, type[BaseModel]] = {
    "MAKE_PROFESSIONAL": MakeProfessionalInputs,
    "CHANGE_BACKGROUND": ChangeBackgroundInputs,
    "ENHANCE_QUALITY": EnhanceQualityInputs,
    "VARIATION": VariationInputs,
    "CUSTOM": CustomInputs,
}


def validate_style_inputs(intent: str, raw: dict) -> BaseModel:
    """Validate a raw style_inputs dict against the correct intent model.

    Raises pydantic.ValidationError on mismatch; the API boundary catches
    this and surfaces a 422. Returns the typed Pydantic instance so the
    caller can access fields without repeated dict key lookups.
    """
    model = _INTENT_TO_MODEL.get(intent)
    if model is None:
        raise ValueError(f"Unknown intent: {intent!r}")
    return model.model_validate(raw)
