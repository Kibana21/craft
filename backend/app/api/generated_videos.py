"""
GET  /api/generated-videos/{id}/stream  — HTTP Range streaming (also used as download URL)
DELETE /api/generated-videos/{id}       — Delete with optional job cancellation
"""
import uuid

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.generated_video import GeneratedVideo
from app.services import video_generation_service, stream_service

router = APIRouter(tags=["generated-videos"])


@router.get(
    "/api/generated-videos/{video_id}/stream",
    response_class=StreamingResponse,
)
async def stream_video(
    video_id: uuid.UUID,
    range: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream the MP4. Supports HTTP Range for seeking and partial playback."""
    result = await db.execute(
        select(GeneratedVideo).where(GeneratedVideo.id == video_id)
    )
    video = result.scalar_one_or_none()
    from fastapi import HTTPException, status
    if video is None or video.file_url is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    return await stream_service.stream_video(video.file_url, range)


@router.delete(
    "/api/generated-videos/{video_id}",
    status_code=204,
)
async def delete_video(
    video_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a generated video. Cancels an in-progress job by flipping its status to FAILED."""
    await video_generation_service.delete(db, video_id)
    await db.commit()
