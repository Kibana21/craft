"""Celery worker for My Studio image generation (Phase B/C/D).

Companion to `.claude/plans/my_studio/04-image-generation-pipeline.md`.

Handles both single-image and batch runs with one task. Outputs are inserted
into `studio_images` incrementally as each slot finishes so the client's
polling `GET /workflows/{run_id}/status` returns a growing `outputs` list and
the UI can render thumbnails live.

Concurrency cap: 4 in-flight Gemini image calls per run (asyncio.Semaphore).
Prevents rate-limit cascades for 20×4 batch runs while keeping latency
reasonable for a single 4-variation single-image run.

Time limits: 30-min soft / 45-min hard (`task_soft_time_limit` / `time_limit`).
Covers the worst case of a 20×2 batch (40 slots, 4 concurrent, ~10 s per
Gemini call) with generous headroom. Beyond that the worker kills itself so
a stuck task can't wedge a queue slot.
"""
from __future__ import annotations

import asyncio
import io
import logging
import uuid
from datetime import UTC, datetime

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_CONCURRENT_VARIATIONS = 4

# Soft / hard Celery limits for the top-level task. Worst case (20 × 4 = 40
# slots at 4-way concurrency, ~10 s each including a retry) is ~2 minutes;
# 30 min soft / 45 min hard gives a huge margin without hiding bugs.
TASK_SOFT_TIME_LIMIT = 30 * 60
TASK_HARD_TIME_LIMIT = 45 * 60


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _fetch_image_bytes(storage_url: str) -> bytes:
    """Fetch an image from storage. Local `/uploads/` path or remote URL."""
    from pathlib import Path

    # Local-dev path (starts with /uploads/).
    if storage_url.startswith("/uploads/"):
        local = (
            Path(__file__).resolve().parent.parent.parent
            / "uploads"
            / storage_url.removeprefix("/uploads/")
        )
        return local.read_bytes()

    # Remote (S3 / R2 / generic HTTPS)
    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(storage_url)
        resp.raise_for_status()
        return resp.content


def _image_dimensions(raw: bytes) -> tuple[int | None, int | None]:
    """Best-effort (width, height) via Pillow. (None, None) on failure."""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(raw))
        return img.width, img.height
    except Exception:
        return None, None


# ── Single-variation generation ───────────────────────────────────────────────


async def _generate_one_slot(
    *,
    session_factory,
    run_id: uuid.UUID,
    user_id: uuid.UUID,
    base_prompt: str,
    source_bytes: bytes | None,
    source_image_id: uuid.UUID | None,
    slot: int,
    output_index: int,
    source_name: str | None,
    is_ai_generated: bool,
    slot_weight: int,
) -> bool:
    """Generate one variation end-to-end. Returns True on success, False on
    policy/upstream failure. Writes an output row on success so the polling
    client sees it immediately. `slot_weight` is the % progress this one slot
    contributes — computed once per run so we don't stash transients on ORM
    rows."""
    from app.models.studio import StudioImage, StudioWorkflowRun
    from app.services.ai_service import GeminiImageError
    from app.services.gemini_image_utils import generate_one_variation
    from app.services.studio_image_service import _build_thumbnail_bytes
    from app.services.upload_service import upload_image_bytes
    from sqlalchemy import select
    from time import perf_counter

    started = perf_counter()
    input_images = [source_bytes] if source_bytes else None
    try:
        raw = await generate_one_variation(
            prompt=base_prompt,
            input_images=input_images,
            slot=slot,
        )
    except GeminiImageError as exc:
        logger.warning(
            "studio_slot_failed",
            extra={
                "run_id": str(run_id),
                "slot": slot,
                "error_code": exc.error_code,
                "duration_ms": int((perf_counter() - started) * 1000),
            },
        )
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "studio_slot_failed",
            extra={
                "run_id": str(run_id),
                "slot": slot,
                "error_code": "UNEXPECTED",
                "error": str(exc),
                "duration_ms": int((perf_counter() - started) * 1000),
            },
        )
        return False

    subfolder = f"studio/{user_id}/outputs/{run_id}"
    storage_url = await upload_image_bytes(data=raw, subfolder=subfolder, extension="png")

    thumb_bytes = await _build_thumbnail_bytes(raw)
    thumbnail_url: str | None = None
    if thumb_bytes is not None:
        thumbnail_url = await upload_image_bytes(
            data=thumb_bytes, subfolder=f"{subfolder}/thumbs", extension="webp"
        )

    width, height = _image_dimensions(raw)

    # Per-source "Enhanced N" or global "Generated N" naming.
    base_name = source_name or "Generated"
    display_name = f"{base_name} — variation {slot + 1}" if source_bytes else f"{base_name} {output_index + 1}"

    async with session_factory() as db:
        row = StudioImage(
            id=uuid.uuid4(),
            user_id=user_id,
            name=display_name[:200],
            type=("AI_GENERATED" if is_ai_generated else "ENHANCED"),
            storage_url=storage_url,
            thumbnail_url=thumbnail_url,
            mime_type="image/png",
            size_bytes=len(raw),
            width_px=width,
            height_px=height,
            source_image_id=source_image_id,
            workflow_run_id=run_id,
            prompt_used=base_prompt,
        )
        db.add(row)

        # Bump progress on the run. Re-read the row to avoid stale increments
        # under concurrent slot completions.
        run = (
            await db.execute(select(StudioWorkflowRun).where(StudioWorkflowRun.id == run_id))
        ).scalar_one()
        run.progress_percent = min(100, run.progress_percent + slot_weight)

        await db.commit()

    logger.info(
        "studio_slot_succeeded",
        extra={
            "run_id": str(run_id),
            "slot": slot,
            "duration_ms": int((perf_counter() - started) * 1000),
            "output_image_id": str(row.id),
        },
    )
    return True


# ── Core runner ───────────────────────────────────────────────────────────────


async def _execute_run(run_id_str: str) -> None:
    """Load the run, fan out slot generation, mark final status. Creates its
    own async engine so the connection pool binds to this task's event loop."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.core.config import settings
    from app.models.gamification import PointsAction
    from app.models.studio import StudioImage, StudioWorkflowRun
    from app.services.gamification_service import award_points

    engine = create_async_engine(settings.DATABASE_URL, pool_size=4, max_overflow=2)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    run_id = uuid.UUID(run_id_str)

    try:
        # ── Load + mark RUNNING ──────────────────────────────────────────────
        async with session_factory() as db:
            run = (
                await db.execute(select(StudioWorkflowRun).where(StudioWorkflowRun.id == run_id))
            ).scalar_one_or_none()
            if run is None:
                logger.error("studio run %s not found", run_id_str)
                return

            source_image_ids = [uuid.UUID(x) for x in (run.source_image_ids or [])]
            base_prompt = run.merged_prompt
            variation_count = run.variation_count
            user_id = run.user_id
            is_batch = run.is_batch
            total_slots = max(
                1,
                variation_count * max(1, len(source_image_ids))
                if is_batch
                else variation_count,
            )
            slot_weight = max(1, 100 // total_slots)

            run.status = "RUNNING"
            run.started_at = datetime.now(UTC)
            run.progress_percent = 0
            await db.commit()

        # ── Resolve sources ──────────────────────────────────────────────────
        is_text_to_image = len(source_image_ids) == 0
        source_rows: dict[uuid.UUID, StudioImage] = {}
        if not is_text_to_image:
            async with session_factory() as db:
                result = await db.execute(
                    select(StudioImage).where(StudioImage.id.in_(source_image_ids))
                )
                for row in result.scalars().all():
                    source_rows[row.id] = row

        # Build the list of (source_id, source_bytes, source_name, slot) pairs.
        pairs: list[tuple[uuid.UUID | None, bytes | None, str | None, int]] = []
        if is_text_to_image:
            for slot in range(variation_count):
                pairs.append((None, None, None, slot))
        else:
            for src_id in source_image_ids:
                src = source_rows.get(src_id)
                if src is None:
                    logger.warning("studio run %s: source %s missing, skipping", run_id, src_id)
                    continue
                try:
                    src_bytes = await _fetch_image_bytes(src.storage_url)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("studio run %s: fetch source %s failed: %s", run_id, src_id, exc)
                    continue
                for slot in range(variation_count):
                    pairs.append((src_id, src_bytes, src.name, slot))

        # ── Dispatch with concurrency cap ────────────────────────────────────
        sem = asyncio.Semaphore(MAX_CONCURRENT_VARIATIONS)

        async def _run_one(idx: int, pair) -> bool:
            src_id, src_bytes, src_name, slot = pair
            async with sem:
                return await _generate_one_slot(
                    session_factory=session_factory,
                    run_id=run_id,
                    user_id=user_id,
                    base_prompt=base_prompt,
                    source_bytes=src_bytes,
                    source_image_id=src_id,
                    slot=slot,
                    output_index=idx,
                    source_name=src_name,
                    is_ai_generated=is_text_to_image,
                    slot_weight=slot_weight,
                )

        results = await asyncio.gather(
            *[_run_one(i, p) for i, p in enumerate(pairs)],
            return_exceptions=False,
        )

        succeeded = sum(1 for ok in results if ok)
        total = len(results)
        final_status = (
            "DONE" if succeeded == total and total > 0
            else "PARTIAL" if succeeded > 0
            else "FAILED"
        )

        # ── Mark final status ───────────────────────────────────────────────
        async with session_factory() as db:
            run = (
                await db.execute(select(StudioWorkflowRun).where(StudioWorkflowRun.id == run_id))
            ).scalar_one()
            run.status = final_status
            run.completed_at = datetime.now(UTC)
            run.progress_percent = 100
            if final_status == "FAILED":
                run.error_message = "All variations failed. Try rephrasing the prompt or retrying."
            await db.commit()

        # ── Points ──────────────────────────────────────────────────────────
        if final_status in {"DONE", "PARTIAL"}:
            try:
                async with session_factory() as db:
                    action = PointsAction.MY_STUDIO_BATCH if is_batch else PointsAction.MY_STUDIO_ENHANCE
                    await award_points(db, user_id, action)
                    await db.commit()
            except Exception as exc:  # noqa: BLE001 — gamification must never block
                logger.warning("studio run %s points award failed: %s", run_id, exc)

        logger.info(
            "studio_run_completed",
            extra={"run_id": str(run_id), "status": final_status, "succeeded": succeeded, "total": total},
        )

    except Exception as exc:  # noqa: BLE001
        logger.exception("studio run %s crashed: %s", run_id_str, exc)
        try:
            async with session_factory() as db:
                run = (
                    await db.execute(select(StudioWorkflowRun).where(StudioWorkflowRun.id == run_id))
                ).scalar_one_or_none()
                if run is not None:
                    run.status = "FAILED"
                    run.completed_at = datetime.now(UTC)
                    run.error_message = f"Worker crashed: {exc}"
                    await db.commit()
        except Exception:
            logger.exception("studio run %s: could not mark FAILED after crash", run_id_str)
    finally:
        await engine.dispose()


# ── Retry one slot (called from the /retry-slot endpoint) ────────────────────


async def retry_one_slot_sync(
    *,
    run_id: uuid.UUID,
    user_id: uuid.UUID,
    base_prompt: str,
    source_image_id: uuid.UUID | None,
    source_bytes: bytes | None,
    source_name: str | None,
    slot: int,
    output_index: int,
    is_ai_generated: bool,
) -> uuid.UUID | None:
    """Run one slot synchronously (from the web process) and return the new
    StudioImage id, or None on failure. Uses the same per-slot helper as the
    Celery worker so behavior stays consistent."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.core.config import settings
    from app.models.studio import StudioImage

    engine = create_async_engine(settings.DATABASE_URL, pool_size=2, max_overflow=0)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        ok = await _generate_one_slot(
            session_factory=session_factory,
            run_id=run_id,
            user_id=user_id,
            base_prompt=base_prompt,
            source_bytes=source_bytes,
            source_image_id=source_image_id,
            slot=slot,
            output_index=output_index,
            source_name=source_name,
            is_ai_generated=is_ai_generated,
            # The run is already at 100% — a retry just adds one output. Don't
            # double-count into progress_percent.
            slot_weight=0,
        )
        if not ok:
            return None
        # Fetch the latest output row for this (run, slot) to return its id.
        async with session_factory() as db:
            latest = (
                await db.execute(
                    select(StudioImage)
                    .where(
                        StudioImage.workflow_run_id == run_id,
                        StudioImage.source_image_id == source_image_id,
                    )
                    .order_by(StudioImage.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            return latest.id if latest else None
    finally:
        await engine.dispose()


# ── Celery entry ─────────────────────────────────────────────────────────────


@celery_app.task(
    name="studio.generate_run",
    acks_late=True,
    soft_time_limit=TASK_SOFT_TIME_LIMIT,
    time_limit=TASK_HARD_TIME_LIMIT,
)
def generate_run_task(run_id_str: str) -> None:
    """Sync Celery entry — runs the async body in a fresh event loop."""
    asyncio.run(_execute_run(run_id_str))
