import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import VideoStatus


class GeneratedVideoResponse(BaseModel):
    id: uuid.UUID
    video_session_id: uuid.UUID
    version: int
    status: VideoStatus
    progress_percent: int
    current_scene: int | None
    file_url: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class GeneratedVideoListResponse(BaseModel):
    videos: list[GeneratedVideoResponse]
    any_active: bool  # True when any video is QUEUED or RENDERING — drives frontend polling
