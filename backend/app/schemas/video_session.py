import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import SpeakingStyle, VideoSessionStep


class VideoSessionResponse(BaseModel):
    id: uuid.UUID
    artifact_id: uuid.UUID
    current_step: VideoSessionStep
    target_duration_seconds: int
    presenter_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BriefImproveRequest(BaseModel):
    field: str  # "key_message" | "target_audience" | "cta_text" | "video_brief"
    title: str = ""
    key_message: str = ""
    target_audience: str = ""
    tone: str = "professional"
    cta_text: str = ""
    video_brief: str = ""


class AssignPresenterRequest(BaseModel):
    """
    Two modes:
    - Library reuse: supply only presenter_id
    - Inline create: supply all presenter fields (+ save_to_library flag)
    At least one of the two must be provided (validated in the service layer).
    """
    # --- Library path ---
    presenter_id: uuid.UUID | None = None

    # --- Inline-create path ---
    name: str | None = None
    age_range: str | None = None
    appearance_keywords: str | None = None
    full_appearance_description: str | None = None
    speaking_style: SpeakingStyle | None = None
    save_to_library: bool = False
