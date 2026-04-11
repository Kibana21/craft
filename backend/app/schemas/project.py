import uuid
from datetime import datetime

from pydantic import BaseModel, Field

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
    suggestion_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    brief: dict | None = None
    brand_kit_id: uuid.UUID | None = None


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    per_page: int


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: ProjectType
    purpose: ProjectPurpose = ProjectPurpose.CAMPAIGN
    product: str | None = None
    target_audience: str | None = None
    campaign_period: str | None = None
    key_message: str | None = None
    brand_kit_id: uuid.UUID | None = None
    brief: dict | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    product: str | None = None
    target_audience: str | None = None
    campaign_period: str | None = None
    key_message: str | None = None
    brief: dict | None = None
    status: str | None = Field(None, pattern="^(active|archived)$")
