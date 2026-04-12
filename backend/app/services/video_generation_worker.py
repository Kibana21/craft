"""
Background worker for video generation.

Runs inside FastAPI BackgroundTasks (in-process thread pool).
Fetches scenes, rebuilds merged prompts from latest field values (FR-13),
chains scene-extension calls, uploads final MP4, updates status.

Cancellation: checks GeneratedVideo.status between scenes.
If status is no longer RENDERING, aborts gracefully.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.generated_video import GeneratedVideo
from app.models.video_session import VideoSession
from app.models.scene import Scene
from app.models.presenter import Presenter
from app.models.brand_kit import BrandKit
from app.models.enums import VideoStatus
from app.services.video_service import build_merged_prompt
from app.services.upload_service import upload_video_bytes

log = logging.getLogger(__name__)


async def _load_prerequisites(db: AsyncSession, generated_video_id: uuid.UUID):
    """Load video, session, scenes, presenter, brand kit in one go."""
    result = await db.execute(
        select(GeneratedVideo).where(GeneratedVideo.id == generated_video_id)
    )
    video = result.scalar_one_or_none()
    if video is None:
        raise ValueError(f"GeneratedVideo {generated_video_id} not found")

    result = await db.execute(
        select(VideoSession).where(VideoSession.id == video.video_session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise ValueError(f"VideoSession {video.video_session_id} not found")

    result = await db.execute(
        select(Scene)
        .where(Scene.video_session_id == session.id)
        .order_by(Scene.sequence)
    )
    scenes = list(result.scalars().all())

    presenter = None
    if session.presenter_id:
        r = await db.execute(select(Presenter).where(Presenter.id == session.presenter_id))
        presenter = r.scalar_one_or_none()

    r = await db.execute(select(BrandKit).order_by(BrandKit.created_at).limit(1))
    brand_kit = r.scalar_one_or_none()

    return video, session, scenes, presenter, brand_kit


async def _update_progress(
    db: AsyncSession,
    video_id: uuid.UUID,
    progress: int,
    current_scene: int,
) -> None:
    result = await db.execute(select(GeneratedVideo).where(GeneratedVideo.id == video_id))
    video = result.scalar_one_or_none()
    if video:
        video.progress_percent = progress
        video.current_scene = current_scene
        video.status = VideoStatus.RENDERING
        await db.commit()


async def _mark_failed(
    db: AsyncSession,
    video_id: uuid.UUID,
    message: str,
    artifact_id: uuid.UUID | None = None,
    triggering_user_id: uuid.UUID | None = None,
) -> None:
    result = await db.execute(select(GeneratedVideo).where(GeneratedVideo.id == video_id))
    video = result.scalar_one_or_none()
    if video:
        video.status = VideoStatus.FAILED
        video.error_message = message
        video.completed_at = datetime.now(timezone.utc)
        await db.commit()

    if artifact_id is not None and triggering_user_id is not None:
        try:
            from app.services.notification_service import notify_video_failed
            await notify_video_failed(db, artifact_id, triggering_user_id)
            await db.commit()
        except Exception as exc:
            log.error("Worker: notify_video_failed raised %s — continuing", exc)

    log.error("Video %s FAILED: %s", video_id, message)


async def _mark_ready(
    db: AsyncSession,
    video_id: uuid.UUID,
    artifact_id: str,
    version: int,
    final_bytes: bytes,
    triggering_user_id: uuid.UUID | None = None,
) -> None:
    file_url = await upload_video_bytes(final_bytes, artifact_id, version)
    result = await db.execute(select(GeneratedVideo).where(GeneratedVideo.id == video_id))
    video = result.scalar_one_or_none()
    if video:
        video.status = VideoStatus.READY
        video.file_url = file_url
        video.progress_percent = 100
        video.completed_at = datetime.now(timezone.utc)
        await db.commit()
    log.info("Video %s READY — url=%s", video_id, file_url)

    artifact_uuid = uuid.UUID(artifact_id)

    # Integration hooks — each wrapped in try/except so a failure never marks the video as FAILED
    try:
        from app.services.compliance_scorer import score_artifact
        await score_artifact(db, artifact_uuid)
        await db.commit()
    except Exception as exc:
        log.error("Worker: compliance scoring failed for artifact %s: %s", artifact_id, exc)

    if triggering_user_id is not None:
        try:
            from app.services.gamification_service import award_points_once
            from app.models.gamification import PointsAction
            await award_points_once(db, triggering_user_id, PointsAction.VIDEO_GENERATED, artifact_uuid)
            await db.commit()
        except Exception as exc:
            log.error("Worker: gamification award failed for user %s: %s", triggering_user_id, exc)

    try:
        from app.services.notification_service import notify_video_ready
        await notify_video_ready(db, artifact_uuid)
        await db.commit()
    except Exception as exc:
        log.error("Worker: notify_video_ready failed for artifact %s: %s", artifact_id, exc)


async def _is_cancelled(db: AsyncSession, video_id: uuid.UUID) -> bool:
    """Return True if status has been flipped away from RENDERING externally."""
    result = await db.execute(
        select(GeneratedVideo.status).where(GeneratedVideo.id == video_id)
    )
    current_status = result.scalar_one_or_none()
    return current_status not in (VideoStatus.QUEUED, VideoStatus.RENDERING)


async def _run(generated_video_id: uuid.UUID) -> None:
    """Main async body — runs in its own database session."""
    from app.services.veo_client import (
        generate_scene as veo_generate,
        extend_scene as veo_extend,
        VeoTimeoutError,
        VeoPolicyError,
        VeoQuotaError,
        VeoMalformedResponseError,
        VeoNotConfiguredError,
    )

    async with async_session() as db:
        try:
            video, session, scenes, presenter, brand_kit = await _load_prerequisites(
                db, generated_video_id
            )
        except Exception as exc:
            log.error("Worker failed to load prerequisites: %s", exc)
            return

        # Resolve artifact for upload path and triggering user (needed before scenes check)
        from app.models.artifact import Artifact
        result = await db.execute(
            select(Artifact).where(Artifact.id == session.artifact_id)
        )
        artifact_obj = result.scalar_one()
        artifact_id = str(artifact_obj.id)
        triggering_user_id: uuid.UUID = artifact_obj.creator_id
        artifact_uuid = artifact_obj.id

        if not scenes:
            await _mark_failed(
                db, video.id, "No scenes found. Add scenes and retry.",
                artifact_id=artifact_uuid, triggering_user_id=triggering_user_id,
            )
            return

        # Refresh merged prompts from latest scene fields (FR-13)
        for scene in scenes:
            scene.merged_prompt = build_merged_prompt(scene, presenter, brand_kit)
        await db.commit()

        # ── Scene-extension chain ─────────────────────────────────────────
        previous_clip: bytes | None = None
        total = len(scenes)

        # Mark as RENDERING before starting
        result = await db.execute(select(GeneratedVideo).where(GeneratedVideo.id == video.id))
        gv = result.scalar_one()
        gv.status = VideoStatus.RENDERING
        await db.commit()

    # Use a fresh session for each scene update (avoids long-held transactions)
    for idx, scene in enumerate(scenes, start=1):
        async with async_session() as db:
            if await _is_cancelled(db, generated_video_id):
                log.info("Video %s was cancelled before scene %d — stopping", generated_video_id, idx)
                return

        prompt = scene.merged_prompt or f"{scene.dialogue}\nSetting: {scene.setting}"

        try:
            log.info("Generating scene %d/%d for video %s", idx, total, generated_video_id)
            if idx == 1:
                clip = await asyncio.get_event_loop().run_in_executor(
                    None, veo_generate, prompt
                )
            else:
                clip = await asyncio.get_event_loop().run_in_executor(
                    None, veo_extend, prompt, previous_clip
                )
        except VeoTimeoutError as exc:
            async with async_session() as db:
                await _mark_failed(db, generated_video_id, str(exc), artifact_uuid, triggering_user_id)
            return
        except VeoPolicyError as exc:
            async with async_session() as db:
                await _mark_failed(db, generated_video_id, str(exc), artifact_uuid, triggering_user_id)
            return
        except VeoQuotaError as exc:
            async with async_session() as db:
                await _mark_failed(db, generated_video_id, str(exc), artifact_uuid, triggering_user_id)
            return
        except (VeoNotConfiguredError, VeoMalformedResponseError) as exc:
            async with async_session() as db:
                await _mark_failed(db, generated_video_id, str(exc), artifact_uuid, triggering_user_id)
            return
        except Exception as exc:
            async with async_session() as db:
                await _mark_failed(
                    db, generated_video_id,
                    f"Unexpected error on scene {idx}: {type(exc).__name__}",
                    artifact_uuid, triggering_user_id,
                )
            log.exception("Unexpected worker error on scene %d", idx)
            return

        previous_clip = clip
        progress = round(idx / total * 100)

        async with async_session() as db:
            await _update_progress(db, generated_video_id, progress, idx)

    # Upload final clip (last scene's output)
    async with async_session() as db:
        result = await db.execute(select(GeneratedVideo).where(GeneratedVideo.id == generated_video_id))
        gv = result.scalar_one()
        await _mark_ready(db, generated_video_id, artifact_id, gv.version, previous_clip or b"", triggering_user_id)


def generate_video_task(generated_video_id: uuid.UUID) -> None:
    """
    Synchronous entry point for FastAPI BackgroundTasks.
    Creates and runs the async event loop internally.
    """
    log.info("Worker starting for GeneratedVideo %s", generated_video_id)
    asyncio.run(_run(generated_video_id))
    log.info("Worker finished for GeneratedVideo %s", generated_video_id)
