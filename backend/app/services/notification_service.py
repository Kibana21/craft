"""Notification service for in-app alerts."""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artifact import Artifact
from app.models.notification import Notification
from app.models.project_member import ProjectMember

log = logging.getLogger(__name__)

NOTIFICATION_VIDEO_READY = "VIDEO_READY"
NOTIFICATION_VIDEO_FAILED = "VIDEO_FAILED"


async def notify_video_ready(db: AsyncSession, artifact_id: uuid.UUID) -> None:
    """Create VIDEO_READY notifications for all members of the artifact's project."""
    artifact = (
        await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    ).scalar_one_or_none()
    if artifact is None:
        log.warning("notify_video_ready: artifact %s not found", artifact_id)
        return

    members = (
        await db.execute(
            select(ProjectMember).where(ProjectMember.project_id == artifact.project_id)
        )
    ).scalars().all()

    for member in members:
        notification = Notification(
            user_id=member.user_id,
            type=NOTIFICATION_VIDEO_READY,
            title="Video ready",
            message=f'Your video "{artifact.name}" has finished generating.',
            data={"artifact_id": str(artifact_id)},
        )
        db.add(notification)

    await db.flush()
    log.info(
        "notify_video_ready: sent VIDEO_READY to %d members for artifact %s",
        len(members),
        artifact_id,
    )


async def notify_video_failed(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Create a VIDEO_FAILED notification for the triggering user only."""
    artifact = (
        await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    ).scalar_one_or_none()
    name = artifact.name if artifact else "your video"

    notification = Notification(
        user_id=user_id,
        type=NOTIFICATION_VIDEO_FAILED,
        title="Video generation failed",
        message=f'"{name}" could not be generated. Please try again.',
        data={"artifact_id": str(artifact_id)},
    )
    db.add(notification)
    await db.flush()
    log.info("notify_video_failed: sent VIDEO_FAILED to user %s for artifact %s", user_id, artifact_id)
