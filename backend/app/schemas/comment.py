import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CreateCommentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class CommentAuthorResponse(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: uuid.UUID
    user: CommentAuthorResponse
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}
