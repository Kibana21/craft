import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ArtifactType, SuggestionAudience


class ArtifactSuggestionResponse(BaseModel):
    id: uuid.UUID
    artifact_type: ArtifactType
    artifact_name: str
    description: str | None = None
    audience: SuggestionAudience
    selected: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ToggleSuggestionRequest(BaseModel):
    selected: bool
