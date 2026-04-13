import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ExportFormat = Literal["png", "jpg", "mp4", "pdf"]
ExportAspectRatio = Literal["1:1", "4:5", "9:16", "800x800"]
ExportStatus = Literal["processing", "ready", "failed"]


class ExportRequest(BaseModel):
    format: ExportFormat
    aspect_ratio: ExportAspectRatio | None = None


class ExportResponse(BaseModel):
    export_id: uuid.UUID
    status: ExportStatus


class ExportStatusResponse(BaseModel):
    export_id: uuid.UUID
    status: ExportStatus
    download_url: str | None = None
    format: str
    aspect_ratio: str | None = None
    exported_at: datetime

    model_config = {"from_attributes": True}
