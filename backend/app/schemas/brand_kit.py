import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FontsConfig(BaseModel):
    heading: str | None = None
    body: str | None = None
    accent: str | None = None
    heading_url: str | None = None
    body_url: str | None = None
    accent_url: str | None = None


class BrandKitResponse(BaseModel):
    id: uuid.UUID
    name: str
    logo_url: str | None = None
    secondary_logo_url: str | None = None
    primary_color: str
    secondary_color: str
    accent_color: str
    fonts: dict[str, str] | None = None
    version: int
    updated_by: uuid.UUID | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateBrandKitRequest(BaseModel):
    primary_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    accent_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    fonts: dict[str, str] | None = None
