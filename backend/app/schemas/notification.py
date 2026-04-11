import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    message: str | None = None
    data: dict | None = None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
