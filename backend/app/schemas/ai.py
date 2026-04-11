from pydantic import BaseModel, Field


class GenerateTaglinesRequest(BaseModel):
    product: str
    audience: str = ""
    tone: str = "professional"
    count: int = Field(default=5, ge=1, le=10)


class GenerateTaglinesResponse(BaseModel):
    taglines: list[str]


class GenerateImageRequest(BaseModel):
    prompt_context: str
    artifact_type: str = "poster"
    tone: str = "professional"
    style: str = "modern minimal"
    aspect_ratio: str = "1:1"


class GenerateImageResponse(BaseModel):
    image_url: str
    prompt_used: str


class StoryboardFrame(BaseModel):
    frame_number: int
    duration_seconds: int
    text_overlay: str
    visual_description: str
    transition: str


class GenerateStoryboardRequest(BaseModel):
    topic: str
    key_message: str
    product: str = ""
    tone: str = "professional"


class GenerateStoryboardResponse(BaseModel):
    frames: list[StoryboardFrame]
