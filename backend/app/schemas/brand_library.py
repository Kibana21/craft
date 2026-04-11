import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import LibraryItemStatus, ArtifactType, ArtifactStatus


class LibraryArtifactResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: ArtifactType
    thumbnail_url: str | None = None
    product: str | None = None

    model_config = {"from_attributes": True}


class LibraryArtifactDetailResponse(LibraryArtifactResponse):
    content: dict | None = None
    compliance_score: float | None = None
    status: ArtifactStatus | None = None


class LibraryPublisherResponse(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class BrandLibraryItemResponse(BaseModel):
    id: uuid.UUID
    artifact: LibraryArtifactResponse
    published_by: LibraryPublisherResponse
    status: LibraryItemStatus
    remix_count: int
    published_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BrandLibraryDetailResponse(BaseModel):
    id: uuid.UUID
    artifact: LibraryArtifactDetailResponse
    published_by: LibraryPublisherResponse
    status: LibraryItemStatus
    remix_count: int
    rejection_reason: str | None = None
    published_at: datetime | None = None
    created_at: datetime


class BrandLibraryListResponse(BaseModel):
    items: list[BrandLibraryItemResponse]
    total: int
    page: int
    per_page: int


class PublishToLibraryRequest(BaseModel):
    artifact_id: uuid.UUID


class ReviewLibraryItemRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject|unpublish)$")
    reason: str | None = None


class RemixResponse(BaseModel):
    project_id: uuid.UUID
    artifact_id: uuid.UUID
