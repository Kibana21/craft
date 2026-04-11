import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ProjectType, ProjectPurpose


class ProjectOwnerResponse(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: ProjectType
    purpose: ProjectPurpose
    owner: ProjectOwnerResponse
    product: str | None = None
    target_audience: str | None = None
    campaign_period: str | None = None
    key_message: str | None = None
    status: str
    artifact_count: int = 0
    member_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    per_page: int
