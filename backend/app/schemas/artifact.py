import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ArtifactType, ArtifactChannel, ArtifactFormat, ArtifactStatus


class ArtifactCreatorResponse(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class ArtifactResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    creator: ArtifactCreatorResponse
    type: ArtifactType
    name: str
    channel: ArtifactChannel | None = None
    format: ArtifactFormat | None = None
    thumbnail_url: str | None = None
    compliance_score: float | None = None
    status: ArtifactStatus
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtifactDetailResponse(ArtifactResponse):
    content: dict | None = None
    locks: list[str] | None = None
    video_session_id: uuid.UUID | None = None


class ArtifactListResponse(BaseModel):
    items: list[ArtifactResponse]
    total: int
    page: int
    per_page: int


class CreateArtifactRequest(BaseModel):
    type: ArtifactType
    name: str = Field(min_length=1, max_length=255)
    content: dict | None = None
    channel: ArtifactChannel | None = None
    format: ArtifactFormat | None = None
    target_duration_seconds: int | None = None  # VIDEO/REEL only; defaults to 60


class UpdateArtifactRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    content: dict | None = None
    channel: ArtifactChannel | None = None
    format: ArtifactFormat | None = None
