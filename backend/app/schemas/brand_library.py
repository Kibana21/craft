import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import LibraryItemStatus, ArtifactType


class LibraryArtifactResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: ArtifactType
    thumbnail_url: str | None = None
    product: str | None = None

    model_config = {"from_attributes": True}


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


class BrandLibraryListResponse(BaseModel):
    items: list[BrandLibraryItemResponse]
    total: int
    page: int
    per_page: int
