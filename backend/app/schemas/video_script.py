import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.enums import ScriptAction

# Subset of ScriptAction values accepted on the rewrite endpoint
REWRITE_ACTIONS = {ScriptAction.WARM, ScriptAction.PROFESSIONAL, ScriptAction.SHORTER, ScriptAction.STRONGER_CTA}

WORDS_PER_MINUTE = 150


def compute_stats(content: str) -> tuple[int, int]:
    """Return (word_count, estimated_duration_seconds)."""
    words = len(content.split()) if content.strip() else 0
    duration = round(words / WORDS_PER_MINUTE * 60)
    return words, duration


class ScriptResponse(BaseModel):
    id: uuid.UUID
    video_session_id: uuid.UUID
    content: str
    word_count: int
    estimated_duration_seconds: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScriptUpdateRequest(BaseModel):
    content: str


class ScriptDraftRequest(BaseModel):
    """Optional one-off overrides — if omitted, pulled from project brief."""
    target_audience: str | None = None
    key_message: str | None = None
    tone: str | None = None
    cta_text: str | None = None
    video_brief: str | None = None


class ScriptRewriteRequest(BaseModel):
    tone: ScriptAction

    @field_validator("tone")
    @classmethod
    def tone_must_be_rewrite_action(cls, v: ScriptAction) -> ScriptAction:
        if v not in REWRITE_ACTIONS:
            raise ValueError(
                f"tone must be one of: {[a.value for a in REWRITE_ACTIONS]}. "
                f"Got '{v.value}'."
            )
        return v


class ScriptVersionResponse(BaseModel):
    id: uuid.UUID
    video_session_id: uuid.UUID
    action: ScriptAction
    preview: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_version(cls, version: object) -> "ScriptVersionResponse":
        from app.models.script_version import ScriptVersion
        v: ScriptVersion = version  # type: ignore[assignment]
        return cls(
            id=v.id,
            video_session_id=v.video_session_id,
            action=v.action,
            preview=v.content[:150],
            created_at=v.created_at,
        )
