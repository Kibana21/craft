import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class FontsConfig(BaseModel):
    heading: str | None = None
    body: str | None = None
    disclaimer: str | None = None
    heading_url: str | None = None
    body_url: str | None = None
    disclaimer_url: str | None = None
    disclaimer_inherited: bool | None = None
    size_scale: dict | None = None


class ColorNames(BaseModel):
    primary_name: str | None = None
    secondary_name: str | None = None
    accent_name: str | None = None
    primary_usage: str | None = None
    secondary_usage: str | None = None
    accent_usage: str | None = None


class ActivatedByInfo(BaseModel):
    id: uuid.UUID
    name: str


class BrandKitResponse(BaseModel):
    id: uuid.UUID
    name: str
    logo_url: str | None = None
    secondary_logo_url: str | None = None
    primary_color: str
    secondary_color: str
    accent_color: str
    fonts: dict[str, Any] | None = None
    version: int
    updated_by: uuid.UUID | None = None
    updated_at: datetime
    is_active: bool = True
    changelog: str | None = None
    activated_by_info: ActivatedByInfo | None = None
    activated_at: datetime | None = None
    color_names: dict | None = None
    zone_roles: dict | None = None

    model_config = {"from_attributes": True}


class BrandKitVersionSummary(BaseModel):
    id: uuid.UUID
    version: int
    name: str
    changelog: str | None = None
    activated_by_info: ActivatedByInfo | None = None
    activated_at: datetime | None = None
    is_active: bool
    created_at: datetime
    # Kit values — shown in the preview panel before restoring
    primary_color: str
    secondary_color: str
    accent_color: str
    logo_url: str | None = None
    fonts: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class TemplateZone(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class BrandKitTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    layout_key: str
    zones: list[TemplateZone]
    is_default: bool

    model_config = {"from_attributes": True}


class CreateTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    layout_key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    zones: list[TemplateZone] = Field(min_length=1)


class UpdateTemplateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    zones: list[TemplateZone] | None = None


class UpdateBrandKitRequest(BaseModel):
    primary_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    accent_color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    fonts: dict[str, Any] | None = None
    color_names: dict | None = None
    zone_roles: dict | None = None
    changelog: str | None = None
