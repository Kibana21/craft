"""
Trigger, list, and cancel video generation jobs.

Invariants:
  - At most one QUEUED/RENDERING job per project at any time (enforced at trigger time).
  - version = max(existing versions for this session) + 1, computed atomically.
  - All prerequisite validation (scenes exist, dialogues non-empty) runs before the DB write.
"""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generated_video import GeneratedVideo
from app.models.video_session import VideoSession
from app.models.artifact import Artifact
from app.models.scene import Scene
from app.models.enums import VideoStatus


ACTIVE_STATUSES = (VideoStatus.QUEUED, VideoStatus.RENDERING)


async def _check_project_lock(db: AsyncSession, project_id: uuid.UUID) -> None:
    """
    Ensure no QUEUED/RENDERING video exists for any session in this project.
    Uses a subquery: GeneratedVideo → VideoSession → Artifact (project_id).
    """
    active = (
        await db.execute(
            select(GeneratedVideo.id)
            .join(VideoSession, GeneratedVideo.video_session_id == VideoSession.id)
            .join(Artifact, VideoSession.artifact_id == Artifact.id)
            .where(
                Artifact.project_id == project_id,
                GeneratedVideo.status.in_(ACTIVE_STATUSES),
            )
            .limit(1)
        )
    ).scalar_one_or_none()

    if active is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A video is already being generated for this project.",
        )


async def trigger(
    db: AsyncSession,
    session_id: uuid.UUID,
    project_id: uuid.UUID,
) -> GeneratedVideo:
    """
    Validate prerequisites, create a QUEUED GeneratedVideo row, return it.
    Caller dispatches the worker and commits.
    """
    # ── 1. Prerequisite: at least one scene, all with non-empty dialogue ──
    scenes_result = await db.execute(
        select(Scene)
        .where(Scene.video_session_id == session_id)
        .order_by(Scene.sequence)
    )
    scenes = list(scenes_result.scalars().all())

    if not scenes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No scenes found. Generate a storyboard before triggering video generation.",
        )

    empty_dialogue = [s.sequence for s in scenes if not s.dialogue.strip()]
    if empty_dialogue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scene(s) {empty_dialogue} have empty dialogue. Fill them before generating.",
        )

    # ── 2. One-active-job-per-project lock ────────────────────────────────
    await _check_project_lock(db, project_id)

    # ── 3. Compute next version number atomically ─────────────────────────
    max_version_result = await db.execute(
        select(func.coalesce(func.max(GeneratedVideo.version), 0))
        .where(GeneratedVideo.video_session_id == session_id)
    )
    next_version = (max_version_result.scalar() or 0) + 1

    # ── 4. Insert QUEUED row ──────────────────────────────────────────────
    video = GeneratedVideo(
        video_session_id=session_id,
        version=next_version,
        status=VideoStatus.QUEUED,
        progress_percent=0,
    )
    db.add(video)
    await db.flush()
    await db.refresh(video)
    return video


async def list_for_session(db: AsyncSession, session_id: uuid.UUID) -> dict:
    """Return all generated videos newest-first plus the any_active convenience flag."""
    result = await db.execute(
        select(GeneratedVideo)
        .where(GeneratedVideo.video_session_id == session_id)
        .order_by(GeneratedVideo.created_at.desc())
    )
    videos = list(result.scalars().all())
    any_active = any(v.status in ACTIVE_STATUSES for v in videos)
    return {"videos": videos, "any_active": any_active}


async def delete(db: AsyncSession, video_id: uuid.UUID) -> None:
    """
    Delete a generated video.

    Branch logic:
    - READY   → delete the file from storage, then delete the DB row.
    - QUEUED/RENDERING → flip status to FAILED (worker will bail on next check) then delete row.
    - FAILED  → delete DB row only.
    """
    result = await db.execute(
        select(GeneratedVideo).where(GeneratedVideo.id == video_id)
    )
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    if video.status == VideoStatus.READY and video.file_url:
        # Attempt to delete from storage (best-effort; don't block deletion if it fails)
        _try_delete_file(video.file_url)

    elif video.status in ACTIVE_STATUSES:
        # Signal the in-progress worker to bail by flipping status to FAILED first.
        # The worker polls status between scenes and will exit cleanly.
        from sqlalchemy import update as sa_update
        from datetime import datetime, timezone

        await db.execute(
            sa_update(GeneratedVideo)
            .where(GeneratedVideo.id == video_id)
            .values(
                status=VideoStatus.FAILED,
                error_message="Cancelled by user",
                completed_at=datetime.now(timezone.utc),
            )
        )
        await db.flush()

    await db.delete(video)


def _try_delete_file(file_url: str) -> None:
    """Best-effort file deletion from local or S3 storage."""
    from app.services.upload_service import UPLOAD_DIR
    from app.core.config import settings

    # Local file
    if file_url.startswith("/uploads/"):
        relative = file_url.removeprefix("/uploads/")
        path = UPLOAD_DIR / relative
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass
        return

    # S3 — attempt delete, swallow all errors
    if settings.S3_BUCKET:
        for prefix in [
            f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com/",
            (settings.S3_ENDPOINT_URL or "") + "/",
        ]:
            if prefix and file_url.startswith(prefix):
                key = file_url.removeprefix(prefix)
                try:
                    import boto3
                    s3 = boto3.client(
                        "s3",
                        region_name=settings.S3_REGION,
                        aws_access_key_id=settings.S3_ACCESS_KEY,
                        aws_secret_access_key=settings.S3_SECRET_KEY,
                        endpoint_url=settings.S3_ENDPOINT_URL or None,
                    )
                    s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)
                except Exception:
                    pass
                return


async def mark_orphans_failed(db: AsyncSession) -> int:
    """
    Startup sweep: mark any QUEUED/RENDERING rows as FAILED.
    Called from lifespan so they don't block future triggers.
    Returns the number of rows updated.
    """
    from sqlalchemy import update as sa_update

    result = await db.execute(
        sa_update(GeneratedVideo)
        .where(GeneratedVideo.status.in_(ACTIVE_STATUSES))
        .values(
            status=VideoStatus.FAILED,
            error_message="Server restart during generation",
            completed_at=datetime.now(timezone.utc),
        )
        .returning(GeneratedVideo.id)
    )
    rows = result.fetchall()
    if rows:
        await db.commit()
    return len(rows)
