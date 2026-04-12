import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import CameraFraming


class SceneResponse(BaseModel):
    id: uuid.UUID
    video_session_id: uuid.UUID
    sequence: int
    name: str
    dialogue: str
    setting: str
    camera_framing: CameraFraming
    # True when merged_prompt has been built; not exposed in full for security
    merged_prompt_present: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_scene(cls, scene: object) -> "SceneResponse":
        from app.models.scene import Scene
        s: Scene = scene  # type: ignore[assignment]
        return cls(
            id=s.id,
            video_session_id=s.video_session_id,
            sequence=s.sequence,
            name=s.name,
            dialogue=s.dialogue,
            setting=s.setting,
            camera_framing=s.camera_framing,
            merged_prompt_present=bool(s.merged_prompt),
            created_at=s.created_at,
            updated_at=s.updated_at,
        )


class SceneUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    dialogue: str | None = None
    setting: str | None = Field(None, min_length=1, max_length=500)
    camera_framing: CameraFraming | None = None


class SceneInsertRequest(BaseModel):
    position: int = Field(ge=1, description="1-based position for the new scene")
    name: str = Field(min_length=1, max_length=255)
    dialogue: str
    setting: str = Field(min_length=1, max_length=500)
    camera_framing: CameraFraming = CameraFraming.MEDIUM_SHOT


class SceneListResponse(BaseModel):
    scenes: list[SceneResponse]
    # IDs for staleness detection — frontend compares these
    scenes_script_version_id: uuid.UUID | None
    current_script_version_id: uuid.UUID | None


class SceneAiDialogueResponse(BaseModel):
    dialogue: str


class SceneAiSettingResponse(BaseModel):
    setting: str
