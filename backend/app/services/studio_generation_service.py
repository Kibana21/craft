"""My Studio generation orchestration (Phase B).

Companion to `.claude/plans/my_studio/04-image-generation-pipeline.md`.

This sits between the API layer and the Celery worker:
- `enqueue_run` validates the quota, inserts the run row, dispatches Celery.
- `fetch_status` returns the run + any outputs written so far (live polling).
- `retry_slot` re-runs one failed (source, slot) pair synchronously.

Redis is used only for the daily variation quota. The worker writes outputs
straight to `studio_images`; polling reads from there.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.studio import StudioImage, StudioWorkflowRun
from app.schemas.studio import (
    GenerateWorkflowRequest,
    StudioImageResponse,
    WorkflowRunStatusResponse,
    WorkflowRunSummary,
)

logger = logging.getLogger(__name__)

# Daily per-user cap on variations (PRD budget-guard; same value as posters).
DAILY_VARIATION_CAP = 100


# ── Redis-backed daily quota ─────────────────────────────────────────────────


async def _get_redis():
    """Best-effort Redis client; returns None if Redis is unreachable.
    Matches the degradation stance in `poster_image_service`."""
    try:
        import redis.asyncio as aioredis

        return aioredis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("studio quota Redis unreachable: %s", exc)
        return None


async def _reserve_quota(user_id: uuid.UUID, requested: int) -> None:
    """Atomic daily quota check. Raises 429 on over-cap; no-op if Redis is
    down (fail-open matches the existing convention — we don't block usage on
    infra outages)."""
    r = await _get_redis()
    if r is None:
        return
    key = f"studio_daily:{user_id}:{date.today().isoformat()}"
    try:
        # INCR + EXPIRE (set TTL only on first increment today).
        current = int(await r.incrby(key, requested))
        if current == requested:
            await r.expire(key, 86400 + 3600)  # 25h — safe beyond midnight rollover
        if current > DAILY_VARIATION_CAP:
            # Roll back the increment so the user can still do smaller runs.
            await r.incrby(key, -requested)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "detail": "Daily generation cap reached. Try again tomorrow.",
                    "error_code": "STUDIO_QUOTA_EXCEEDED",
                },
            )
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


# ── Dispatch ──────────────────────────────────────────────────────────────────


async def enqueue_run(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    request: GenerateWorkflowRequest,
) -> StudioWorkflowRun:
    """Validate ownership of source images, reserve quota, insert run row,
    dispatch Celery task."""
    # Cross-check every source image belongs to this user (no silent drops in
    # the worker — we catch it here at the boundary).
    if request.source_image_ids:
        rows = (
            await db.execute(
                select(StudioImage).where(
                    StudioImage.id.in_(request.source_image_ids),
                    StudioImage.user_id == user_id,
                    StudioImage.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        if len(rows) != len(request.source_image_ids):
            raise HTTPException(
                status_code=404,
                detail="One or more source images not found on your library",
            )

    # Reserve the per-user daily quota. Total variations = count × max(1, sources).
    total_variations = request.variation_count * max(1, len(request.source_image_ids))
    await _reserve_quota(user_id, total_variations)

    # Insert the run row (status=QUEUED).
    run = StudioWorkflowRun(
        id=uuid.uuid4(),
        user_id=user_id,
        intent=request.intent,
        is_batch=request.is_batch,
        source_image_ids=[str(x) for x in request.source_image_ids],
        style_inputs=request.style_inputs,
        merged_prompt=request.merged_prompt,
        ai_enrichments=[],
        variation_count=request.variation_count,
        status="QUEUED",
        progress_percent=0,
    )
    db.add(run)
    await db.flush()

    # Dispatch Celery task (queue "studio").
    from app.services.studio_generation_worker import generate_run_task

    generate_run_task.delay(str(run.id))
    logger.info(
        "studio_run_dispatched",
        extra={
            "run_id": str(run.id),
            "user_id": str(user_id),
            "is_batch": request.is_batch,
            "variation_count": request.variation_count,
            "source_count": len(request.source_image_ids),
        },
    )
    return run


# ── Status ───────────────────────────────────────────────────────────────────


async def fetch_status(
    db: AsyncSession, *, run_id: uuid.UUID, user_id: uuid.UUID
) -> WorkflowRunStatusResponse:
    run = (
        await db.execute(
            select(StudioWorkflowRun).where(
                StudioWorkflowRun.id == run_id,
                StudioWorkflowRun.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    outputs_rows = (
        await db.execute(
            select(StudioImage)
            .where(
                and_(
                    StudioImage.workflow_run_id == run_id,
                    StudioImage.deleted_at.is_(None),
                )
            )
            .order_by(StudioImage.created_at.asc())
        )
    ).scalars().all()

    return WorkflowRunStatusResponse(
        id=run.id,
        intent=run.intent,  # type: ignore[arg-type]
        is_batch=run.is_batch,
        status=run.status,  # type: ignore[arg-type]
        progress_percent=run.progress_percent,
        created_at=run.created_at,
        outputs=[StudioImageResponse.model_validate(r) for r in outputs_rows],
        error=run.error_message,
    )


# ── Recent runs ──────────────────────────────────────────────────────────────


async def list_recent_runs(
    db: AsyncSession, *, user_id: uuid.UUID, limit: int = 10
) -> list[WorkflowRunSummary]:
    rows = (
        await db.execute(
            select(StudioWorkflowRun)
            .where(StudioWorkflowRun.user_id == user_id)
            .order_by(StudioWorkflowRun.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [WorkflowRunSummary.model_validate(r) for r in rows]


# ── Retry slot ───────────────────────────────────────────────────────────────


async def discard_outputs(
    db: AsyncSession, *, run_id: uuid.UUID, user_id: uuid.UUID
) -> int:
    """Soft-delete every output produced by this run. Returns the count. PRD
    §15.2 — "Discard" sets `deleted_at` on all output rows so the user can
    clean up a failed/partial run without touching rows one by one."""
    run = (
        await db.execute(
            select(StudioWorkflowRun).where(
                StudioWorkflowRun.id == run_id,
                StudioWorkflowRun.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    outputs = (
        await db.execute(
            select(StudioImage).where(
                and_(
                    StudioImage.workflow_run_id == run_id,
                    StudioImage.user_id == user_id,
                    StudioImage.deleted_at.is_(None),
                )
            )
        )
    ).scalars().all()
    now = datetime.now(timezone.utc)
    for row in outputs:
        row.deleted_at = now
    await db.flush()
    return len(outputs)


async def mark_orphans_failed(session_factory) -> int:
    """Boot-time cleanup: flip any run left in QUEUED/RUNNING to FAILED.

    Runs from `main.py` lifespan startup so a worker crash / server restart
    never leaves a run stuck "running" forever. Returns the count flipped.
    Uses a fresh session so we don't pollute request-scoped DB state.
    """
    flipped = 0
    async with session_factory() as db:
        rows = (
            await db.execute(
                select(StudioWorkflowRun).where(
                    StudioWorkflowRun.status.in_(["QUEUED", "RUNNING"])
                )
            )
        ).scalars().all()
        for r in rows:
            r.status = "FAILED"
            r.completed_at = datetime.now(timezone.utc)
            r.error_message = "Worker interrupted — run marked failed at server startup."
            flipped += 1
        if flipped:
            await db.commit()
    if flipped:
        logger.info("studio mark_orphans_failed: flipped %d runs", flipped)
    return flipped


async def retry_slot(
    db: AsyncSession,
    *,
    run_id: uuid.UUID,
    user_id: uuid.UUID,
    source_image_id: uuid.UUID | None,
    slot: int,
) -> StudioImage:
    """Synchronously re-run a single (source, slot) pair. Intended for failed
    outputs during PARTIAL runs. Does NOT consume quota (the original run
    already paid for this slot)."""
    run = (
        await db.execute(
            select(StudioWorkflowRun).where(
                StudioWorkflowRun.id == run_id,
                StudioWorkflowRun.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in {"DONE", "PARTIAL", "FAILED"}:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": "Run is still in progress — wait for it to finish.",
                "error_code": "STUDIO_RUN_NOT_READY",
            },
        )

    is_text_to_image = not run.source_image_ids
    source_name: str | None = None
    source_bytes: bytes | None = None
    if not is_text_to_image:
        if source_image_id is None:
            raise HTTPException(
                status_code=400, detail="source_image_id is required for Image→Image runs"
            )
        if str(source_image_id) not in (run.source_image_ids or []):
            raise HTTPException(
                status_code=404, detail="Source image is not part of this run"
            )
        src = (
            await db.execute(
                select(StudioImage).where(
                    StudioImage.id == source_image_id,
                    StudioImage.user_id == user_id,
                    StudioImage.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if src is None:
            raise HTTPException(status_code=404, detail="Source image not found")
        source_name = src.name
        from app.services.studio_generation_worker import _fetch_image_bytes

        source_bytes = await _fetch_image_bytes(src.storage_url)

    from app.services.studio_generation_worker import retry_one_slot_sync

    new_id = await retry_one_slot_sync(
        run_id=run_id,
        user_id=user_id,
        base_prompt=run.merged_prompt,
        source_image_id=source_image_id,
        source_bytes=source_bytes,
        source_name=source_name,
        slot=slot,
        output_index=slot,
        is_ai_generated=is_text_to_image,
    )
    if new_id is None:
        raise HTTPException(
            status_code=502,
            detail={
                "detail": "Image model failed again. Try tweaking the prompt.",
                "error_code": "AI_UPSTREAM_ERROR",
            },
        )

    new_row = (
        await db.execute(select(StudioImage).where(StudioImage.id == new_id))
    ).scalar_one()
    # Reflect the retry in the run's completed_at so clients see a fresh timestamp.
    run.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return new_row
