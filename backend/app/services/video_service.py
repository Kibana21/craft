"""
Core video pipeline service: scene generation, renumbering, merged-prompt building.

Renumbering invariant:
  Phase 1 created (video_session_id, sequence) as DEFERRABLE INITIALLY DEFERRED.
  All INSERT/UPDATE/DELETE that touch sequences must happen inside a single transaction.
  The deferred constraint is only checked at COMMIT time, so intermediate states with
  duplicate sequence numbers are legal within the transaction.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.video_session import VideoSession
from app.models.video_script import VideoScript
from app.models.script_version import ScriptVersion
from app.models.scene import Scene
from app.models.presenter import Presenter
from app.models.brand_kit import BrandKit
from app.models.enums import CameraFraming, VideoSessionStep
from app.services.prompt_builder import build_scene_merged_prompt


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _load_session(db: AsyncSession, session_id: uuid.UUID) -> VideoSession:
    result = await db.execute(
        select(VideoSession).where(VideoSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video session not found")
    return session


async def _load_script(db: AsyncSession, session: VideoSession) -> VideoScript:
    if session.current_script_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No script found. Complete the script step before generating scenes.",
        )
    result = await db.execute(
        select(VideoScript).where(VideoScript.id == session.current_script_id)
    )
    script = result.scalar_one_or_none()
    if script is None or not script.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Script is empty. Write a script before generating scenes.",
        )
    return script


async def _load_presenter(db: AsyncSession, presenter_id: uuid.UUID | None) -> Presenter | None:
    if presenter_id is None:
        return None
    result = await db.execute(select(Presenter).where(Presenter.id == presenter_id))
    return result.scalar_one_or_none()


async def _load_brand_kit(db: AsyncSession) -> BrandKit | None:
    result = await db.execute(select(BrandKit).order_by(BrandKit.created_at).limit(1))
    return result.scalar_one_or_none()


async def _latest_script_version_id(db: AsyncSession, session_id: uuid.UUID) -> uuid.UUID | None:
    result = await db.execute(
        select(ScriptVersion.id)
        .where(ScriptVersion.video_session_id == session_id)
        .order_by(ScriptVersion.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row


# ── Merged prompt builder (pure function, wraps prompt_builder) ───────────────

def build_merged_prompt(scene: Scene, presenter: Presenter | None, brand_kit: BrandKit | None) -> str:
    return build_scene_merged_prompt(scene, presenter, brand_kit)


# ── Scene generation ──────────────────────────────────────────────────────────

async def generate_scenes(db: AsyncSession, session_id: uuid.UUID) -> list[Scene]:
    """
    AI-split the current script into scenes.
    409 if scenes already exist — caller should use regenerate_scenes instead.
    """
    session = await _load_session(db, session_id)

    # Guard: already has scenes
    existing = await db.execute(
        select(Scene.id).where(Scene.video_session_id == session_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Scenes already exist. Use regenerate to replace them.",
        )

    return await _do_generate(db, session)


async def regenerate_scenes(db: AsyncSession, session_id: uuid.UUID) -> list[Scene]:
    """Wipe all existing scenes and re-split. Atomic: rolls back on AI failure."""
    session = await _load_session(db, session_id)

    # Delete all existing scenes
    await db.execute(delete(Scene).where(Scene.video_session_id == session_id))
    await db.flush()

    return await _do_generate(db, session)


async def _do_generate(db: AsyncSession, session: VideoSession) -> list[Scene]:
    from app.services.ai_service import split_script_into_scenes

    script = await _load_script(db, session)
    presenter = await _load_presenter(db, session.presenter_id)
    brand_kit = await _load_brand_kit(db)
    latest_version_id = await _latest_script_version_id(db, session.id)

    # Build context dicts for the AI prompt
    presenter_ctx: dict | None = None
    if presenter is not None:
        presenter_ctx = {
            "speaking_style": presenter.speaking_style.value if hasattr(presenter.speaking_style, "value") else str(presenter.speaking_style),
            "full_appearance_description": presenter.full_appearance_description or "",
        }

    brand_ctx: dict | None = None
    if brand_kit is not None:
        brand_ctx = {
            "primary_color": brand_kit.primary_color or "#D0103A",
            "secondary_color": brand_kit.secondary_color or "#1A1A18",
            "tone": (brand_kit.fonts or {}).get("tone", "professional") if brand_kit.fonts else "professional",
        }

    raw_scenes = await split_script_into_scenes(script.content, session.target_duration_seconds, presenter_ctx, brand_ctx)

    scenes: list[Scene] = []
    for idx, raw in enumerate(raw_scenes, start=1):
        # Map camera framing string → enum (default MEDIUM_SHOT on unknown)
        framing_str = raw.get("camera_framing", "MEDIUM_SHOT").upper()
        try:
            framing = CameraFraming[framing_str]
        except KeyError:
            framing = CameraFraming.MEDIUM_SHOT

        scene = Scene(
            video_session_id=session.id,
            sequence=idx,
            name=raw.get("name", f"Scene {idx}"),
            dialogue=raw.get("dialogue", ""),
            setting=raw.get("setting", ""),
            camera_framing=framing,
            script_version_id=latest_version_id,
        )
        db.add(scene)
        await db.flush()  # needed so scene.id exists for merged prompt
        await db.refresh(scene)  # load server-generated timestamps (created_at, updated_at)

        scene.merged_prompt = build_merged_prompt(scene, presenter, brand_kit)
        scenes.append(scene)

    # Stamp the session with the script version used for generation
    session.scenes_script_version_id = latest_version_id
    session.current_step = VideoSessionStep.STORYBOARD
    await db.flush()

    # Re-refresh all scenes — the merged_prompt flush above triggers onupdate on updated_at,
    # expiring it on all scene objects. Refresh ensures serialization works without lazy-load.
    for scene in scenes:
        await db.refresh(scene)

    return scenes


# ── Scene list (with staleness metadata) ─────────────────────────────────────

async def list_scenes(db: AsyncSession, session_id: uuid.UUID) -> dict:
    session = await _load_session(db, session_id)
    result = await db.execute(
        select(Scene)
        .where(Scene.video_session_id == session_id)
        .order_by(Scene.sequence)
    )
    scenes = list(result.scalars().all())
    latest_version_id = await _latest_script_version_id(db, session_id)
    return {
        "scenes": scenes,
        "scenes_script_version_id": session.scenes_script_version_id,
        "current_script_version_id": latest_version_id,
    }


# ── Scene CRUD ────────────────────────────────────────────────────────────────

async def get_scene(db: AsyncSession, scene_id: uuid.UUID) -> Scene:
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return scene


async def update_scene(db: AsyncSession, scene_id: uuid.UUID, data: dict) -> Scene:
    """
    Update scene fields. Does NOT rebuild merged_prompt per PRD FR-13.
    The worker rebuilds merged prompts from latest field values at video-generation time.
    """
    scene = await get_scene(db, scene_id)
    for field, value in data.items():
        if value is not None:
            setattr(scene, field, value)
    await db.flush()
    await db.refresh(scene)
    return scene


async def insert_scene(
    db: AsyncSession,
    session_id: uuid.UUID,
    position: int,
    name: str,
    dialogue: str,
    setting: str,
    camera_framing: CameraFraming,
) -> Scene:
    """
    Insert a new scene at `position` (1-based). All scenes at >= position shift up by 1.
    Uses the deferred unique constraint so the UPDATE + INSERT can happen in one transaction.
    """
    await _load_session(db, session_id)

    # Count existing scenes to validate position
    count_result = await db.execute(
        select(Scene.id).where(Scene.video_session_id == session_id)
    )
    total = len(count_result.all())
    if position < 1 or position > total + 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Position {position} is out of range (1–{total + 1})",
        )

    # Shift sequences up — deferred constraint allows duplicate sequences mid-transaction
    await db.execute(
        update(Scene)
        .where(Scene.video_session_id == session_id, Scene.sequence >= position)
        .values(sequence=Scene.sequence + 1)
    )
    await db.flush()

    presenter_result = await db.execute(
        select(VideoSession.presenter_id).where(VideoSession.id == session_id)
    )
    presenter_id = presenter_result.scalar_one_or_none()
    presenter = await _load_presenter(db, presenter_id)
    brand_kit = await _load_brand_kit(db)

    scene = Scene(
        video_session_id=session_id,
        sequence=position,
        name=name,
        dialogue=dialogue,
        setting=setting,
        camera_framing=camera_framing,
    )
    db.add(scene)
    await db.flush()

    scene.merged_prompt = build_merged_prompt(scene, presenter, brand_kit)
    await db.flush()
    await db.refresh(scene)
    return scene


async def delete_scene(db: AsyncSession, scene_id: uuid.UUID) -> None:
    """
    Delete scene and renumber subsequent scenes contiguously.
    All in one transaction; deferred constraint protects the renumber step.
    """
    scene = await get_scene(db, scene_id)
    session_id = scene.video_session_id
    deleted_sequence = scene.sequence

    await db.delete(scene)
    await db.flush()

    # Shift subsequent scenes down by 1
    await db.execute(
        update(Scene)
        .where(Scene.video_session_id == session_id, Scene.sequence > deleted_sequence)
        .values(sequence=Scene.sequence - 1)
    )
    await db.flush()
