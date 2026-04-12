import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import SpeakingStyle


class PresenterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    age_range: str = Field(min_length=1, max_length=50)
    appearance_keywords: str = Field(min_length=1, max_length=500)
    full_appearance_description: str = Field(min_length=1)
    speaking_style: SpeakingStyle
    is_library: bool = True


class PresenterUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    age_range: str | None = Field(None, min_length=1, max_length=50)
    appearance_keywords: str | None = Field(None, min_length=1, max_length=500)
    full_appearance_description: str | None = None
    speaking_style: SpeakingStyle | None = None
    is_library: bool | None = None


class PresenterResponse(BaseModel):
    id: uuid.UUID
    name: str
    age_range: str
    appearance_keywords: str
    full_appearance_description: str
    speaking_style: SpeakingStyle
    is_library: bool
    created_by_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateAppearanceRequest(BaseModel):
    appearance_keywords: str = Field(min_length=1, max_length=500)
    speaking_style: SpeakingStyle


class GenerateAppearanceResponse(BaseModel):
    full_appearance_description: str


class SuggestKeywordsRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    age_range: str = Field(min_length=1, max_length=50)
    speaking_style: SpeakingStyle


class SuggestKeywordsResponse(BaseModel):
    appearance_keywords: str
