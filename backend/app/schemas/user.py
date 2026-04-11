import uuid

from pydantic import BaseModel

from app.models.enums import UserRole


class UserSearchResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: UserRole
    avatar_url: str | None = None

    model_config = {"from_attributes": True}
