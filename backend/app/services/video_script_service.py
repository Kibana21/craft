"""
Service layer for VideoScript and ScriptVersion management.

Version creation rules:
 - AI actions (DRAFT, WARM, PROFESSIONAL, SHORTER, STRONGER_CTA): always snapshot
   the prior content as a ScriptVersion before replacing.
 - MANUAL saves: snapshot only when word count differs by ≥10 from the last
   MANUAL version, OR when ≥60 seconds have passed since the last MANUAL version.
   This prevents version spam from rapid auto-saves.
"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.video_session import VideoSession
from app.models.video_script import VideoScript
from app.models.script_version import ScriptVersion
from app.models.enums import ScriptAction, VideoSessionStep

WORDS_PER_MINUTE = 150
MANUAL_VERSION_WORD_DELTA = 10    # snapshot when word count changes by this much
MANUAL_VERSION_TIME_GAP = timedelta(seconds=60)  # or when this much time has passed


def _compute_stats(content: str) -> tuple[int, int]:
    words = len(content.split()) if content.strip() else 0
    duration = round(words / WORDS_PER_MINUTE * 60)
    return words, duration


async def _get_session(db: AsyncSession, session_id: uuid.UUID) -> VideoSession:
    result = await db.execute(
        select(VideoSession).where(VideoSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video session not found")
    return session


async def get_session_with_script(db: AsyncSession, session_id: uuid.UUID) -> VideoSession:
    result = await db.execute(
        select(VideoSession)
        .where(VideoSession.id == session_id)
        .options(selectinload(VideoSession.current_script))  # type: ignore[attr-defined]
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video session not found")
    return session


async def get_or_create_script(db: AsyncSession, session_id: uuid.UUID) -> VideoScript:
    """Return the VideoScript for this session, creating an empty one if needed."""
    session = await _get_session(db, session_id)
    if session.current_script_id is not None:
        result = await db.execute(
            select(VideoScript).where(VideoScript.id == session.current_script_id)
        )
        script = result.scalar_one_or_none()
        if script is not None:
            return script

    # No script yet — create empty
    script = VideoScript(
        video_session_id=session_id,
        content="",
        word_count=0,
        estimated_duration_seconds=0,
    )
    db.add(script)
    await db.flush()

    session.current_script_id = script.id
    await db.flush()
    return script


async def _last_manual_version(
    db: AsyncSession, session_id: uuid.UUID
) -> ScriptVersion | None:
    result = await db.execute(
        select(ScriptVersion)
        .where(
            ScriptVersion.video_session_id == session_id,
            ScriptVersion.action == ScriptAction.MANUAL,
        )
        .order_by(ScriptVersion.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _snapshot(
    db: AsyncSession,
    session_id: uuid.UUID,
    content: str,
    action: ScriptAction,
) -> ScriptVersion:
    version = ScriptVersion(
        video_session_id=session_id,
        content=content,
        action=action,
    )
    db.add(version)
    await db.flush()
    return version


async def update_content(
    db: AsyncSession,
    session_id: uuid.UUID,
    content: str,
) -> VideoScript:
    """
    Upsert script content. Creates a MANUAL ScriptVersion when the change is
    meaningful (word count delta ≥10 OR ≥60s since last MANUAL version).
    """
    script = await get_or_create_script(db, session_id)
    old_word_count = script.word_count

    new_word_count, new_duration = _compute_stats(content)

    # Decide whether to snapshot
    word_delta = abs(new_word_count - old_word_count)
    should_snapshot = False
    if word_delta >= MANUAL_VERSION_WORD_DELTA:
        should_snapshot = True
    else:
        last_manual = await _last_manual_version(db, session_id)
        if last_manual is None:
            should_snapshot = bool(content.strip())
        else:
            elapsed = datetime.now(timezone.utc) - last_manual.created_at.replace(tzinfo=timezone.utc)
            if elapsed >= MANUAL_VERSION_TIME_GAP:
                should_snapshot = True

    if should_snapshot and script.content.strip():
        await _snapshot(db, session_id, script.content, ScriptAction.MANUAL)

    script.content = content
    script.word_count = new_word_count
    script.estimated_duration_seconds = new_duration
    await db.flush()
    await db.refresh(script)
    return script


async def draft_from_brief(
    db: AsyncSession,
    session_id: uuid.UUID,
    overrides: dict | None = None,
) -> VideoScript:
    """
    Generate a full script draft from the project brief via Gemini.
    Snapshots current script as DRAFT version before replacing.
    """
    from sqlalchemy.orm import selectinload as _sil
    from app.models.artifact import Artifact
    from app.models.project import Project
    from app.models.brand_kit import BrandKit
    from app.services.ai_service import draft_script

    # Load session → artifact → project → brand_kit in one query
    result = await db.execute(
        select(VideoSession)
        .where(VideoSession.id == session_id)
        .options(
            selectinload(VideoSession.artifact).selectinload(Artifact.project).selectinload(Project.brand_kit)  # type: ignore[attr-defined]
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video session not found")

    project: Project = session.artifact.project
    brief = project.brief or {}
    brand_kit: BrandKit | None = getattr(project, "brand_kit", None)

    # video_brief from artifact content — try loading it for richer script context
    artifact_content = (session.artifact.content or {}) if session.artifact else {}
    artifact_video_brief = artifact_content.get("video_brief", "")

    brief_data = {
        "product": project.product or brief.get("product", ""),
        "target_audience": (overrides or {}).get("target_audience") or project.target_audience or brief.get("target_audience", ""),
        "key_message": (overrides or {}).get("key_message") or project.key_message or brief.get("key_message", ""),
        "tone": (overrides or {}).get("tone") or brief.get("tone", "professional"),
        "cta_text": (overrides or {}).get("cta_text") or brief.get("cta_text", ""),
        "video_brief": (overrides or {}).get("video_brief") or artifact_video_brief or "",
        "target_duration_seconds": session.target_duration_seconds,
        "brand_name": "AIA Singapore",
        "primary_color": brand_kit.primary_color if brand_kit else "#D0103A",
    }

    script = await get_or_create_script(db, session_id)

    # Snapshot current content before replacing
    if script.content.strip():
        await _snapshot(db, session_id, script.content, ScriptAction.DRAFT)

    generated_content = await draft_script(brief_data)

    word_count, duration = _compute_stats(generated_content)
    script.content = generated_content
    script.word_count = word_count
    script.estimated_duration_seconds = duration
    await db.flush()
    await db.refresh(script)
    return script


async def rewrite(
    db: AsyncSession,
    session_id: uuid.UUID,
    tone: ScriptAction,
) -> VideoScript:
    """
    Rewrite the current script in the given tone using Gemini.
    Snapshots current content as a version with the tone action before replacing.
    """
    from app.services.ai_service import rewrite_script

    script = await get_or_create_script(db, session_id)
    if not script.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Script is empty — draft it first before rewriting",
        )

    # Snapshot current before replacing
    await _snapshot(db, session_id, script.content, tone)

    rewritten = await rewrite_script(script.content, tone.value)

    word_count, duration = _compute_stats(rewritten)
    script.content = rewritten
    script.word_count = word_count
    script.estimated_duration_seconds = duration
    await db.flush()
    await db.refresh(script)

    # Advance step to STORYBOARD if still on SCRIPT
    session = await _get_session(db, session_id)
    if session.current_step == VideoSessionStep.SCRIPT:
        pass  # step stays at SCRIPT until user explicitly proceeds

    return script


async def list_versions(
    db: AsyncSession, session_id: uuid.UUID
) -> list[ScriptVersion]:
    result = await db.execute(
        select(ScriptVersion)
        .where(ScriptVersion.video_session_id == session_id)
        .order_by(ScriptVersion.created_at.desc())
    )
    return list(result.scalars().all())


async def restore(
    db: AsyncSession,
    session_id: uuid.UUID,
    version_id: uuid.UUID,
) -> VideoScript:
    """
    Restore a prior version. Always snapshots current script as MANUAL first
    (so the restore itself is recoverable).
    """
    result = await db.execute(
        select(ScriptVersion).where(
            ScriptVersion.id == version_id,
            ScriptVersion.video_session_id == session_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Script version not found")

    script = await get_or_create_script(db, session_id)

    # Snapshot current before restoring
    if script.content.strip():
        await _snapshot(db, session_id, script.content, ScriptAction.MANUAL)

    restored_content = version.content
    word_count, duration = _compute_stats(restored_content)
    script.content = restored_content
    script.word_count = word_count
    script.estimated_duration_seconds = duration
    await db.flush()
    await db.refresh(script)
    return script
