import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video_session import VideoSession
from app.models.enums import VideoSessionStep


async def create_for_artifact(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    target_duration_seconds: int = 60,
) -> VideoSession:
    """
    Create a VideoSession linked to a VIDEO or REEL artifact.
    Called inside the artifact creation transaction — do NOT commit here.
    """
    session = VideoSession(
        artifact_id=artifact_id,
        target_duration_seconds=target_duration_seconds,
        current_step=VideoSessionStep.PRESENTER,
    )
    db.add(session)
    await db.flush()
    return session


async def get_for_artifact(db: AsyncSession, artifact_id: uuid.UUID) -> VideoSession | None:
    result = await db.execute(
        select(VideoSession).where(VideoSession.artifact_id == artifact_id)
    )
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, session_id: uuid.UUID) -> VideoSession:
    result = await db.execute(
        select(VideoSession).where(VideoSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video session not found")
    return session


async def assign_presenter(
    db: AsyncSession,
    session_id: uuid.UUID,
    presenter_id: uuid.UUID,
) -> VideoSession:
    """
    Assign an existing presenter to a VideoSession and advance step to SCRIPT.
    Caller is responsible for verifying the presenter exists and is accessible.
    """
    session = await get_by_id(db, session_id)
    session.presenter_id = presenter_id
    session.current_step = VideoSessionStep.SCRIPT
    await db.flush()
    await db.refresh(session)
    return session
