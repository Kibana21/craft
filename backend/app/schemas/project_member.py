import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ProjectMemberRole, UserRole


class InviteMemberRequest(BaseModel):
    user_id: uuid.UUID


class ProjectMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_role: UserRole
    user_avatar_url: str | None = None
    role: ProjectMemberRole
    joined_at: datetime
