"""Celery task for async poster image generation (Phase C).

The web process dispatches this task and returns immediately with a job_id.
The task runs the Gemini call in a background worker, storing progress and
the final variant list in Redis so the frontend can poll for completion.

Redis key:  poster:gen:job:{job_id}
TTL:        1 hour
Value (JSON):
  { "status": "QUEUED|RUNNING|READY|FAILED",
    "variants": [...],          # filled on READY
    "partial_failure": false,   # filled on READY
    "error": null }             # filled on FAILED
"""
import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

JOB_KEY_PREFIX = "poster:gen:job:"
JOB_TTL_SECONDS = 3600  # 1 hour


async def _run_generation(
    job_id: str,
    artifact_id: str,
    merged_prompt: str,
    subject_type: str,
    reference_image_ids: list[str],
    count: int,
    format_name: str,
) -> None:
    """Async core: runs Gemini calls, uploads images, persists to DB, writes Redis.

    Creates its own SQLAlchemy engine so the connection pool is bound to this
    task's event loop — not the web process's loop (which is already closed).
    """
    import redis.asyncio as aioredis
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.core.config import settings
    from app.models.artifact import Artifact
    from app.services.poster_image_service import (
        SEED_PHRASES,
        _downscale_image_bytes,
        _fetch_image_bytes,
        _single_variant,
        _upload_and_assemble,
    )

    # Fresh engine per task — avoids "Future attached to a different loop" when
    # asyncio.run() creates a new event loop in the Celery worker process.
    engine = create_async_engine(settings.DATABASE_URL, pool_size=2, max_overflow=0)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def _set_status(status: str, extra: dict | None = None) -> None:
        payload: dict = {
            "status": status,
            "variants": [],
            "partial_failure": False,
            "error": None,
        }
        if extra:
            payload.update(extra)
        await r.setex(f"{JOB_KEY_PREFIX}{job_id}", JOB_TTL_SECONDS, json.dumps(payload))

    try:
        await _set_status("RUNNING")

        job_uuid = uuid.UUID(job_id)
        artifact_uuid = uuid.UUID(artifact_id)

        # ── Reference images (PRODUCT_ASSET only) ─────────────────────────────
        reference_images_bytes: list[bytes] = []
        if subject_type == "PRODUCT_ASSET" and reference_image_ids:
            async with session_factory() as db:
                from app.models.poster import PosterReferenceImage

                ref_result = await db.execute(
                    select(PosterReferenceImage).where(
                        PosterReferenceImage.id.in_(
                            [uuid.UUID(rid) for rid in reference_image_ids]
                        )
                    )
                )
                for row in ref_result.scalars().all():
                    try:
                        raw = await _fetch_image_bytes(row.storage_url)
                        reference_images_bytes.append(_downscale_image_bytes(raw))
                    except Exception as exc:
                        logger.warning("Could not load reference image %s: %s", row.id, exc)

        # ── Gemini generation ─────────────────────────────────────────────────
        seed_phrases = SEED_PHRASES[:count]
        tasks = [
            _single_variant(merged_prompt, seed, reference_images_bytes, slot, job_uuid)
            for slot, seed in enumerate(seed_phrases)
        ]
        slot_results = await asyncio.gather(*tasks, return_exceptions=True)

        # ── Upload + assemble ─────────────────────────────────────────────────
        variants = await _upload_and_assemble(slot_results, artifact_uuid)
        partial_failure = any(v["status"] == "FAILED" for v in variants)

        # ── Persist to artifact.content ───────────────────────────────────────
        async with session_factory() as db:
            db_result = await db.execute(
                select(Artifact).where(
                    Artifact.id == artifact_uuid, Artifact.deleted_at.is_(None)
                )
            )
            artifact = db_result.scalar_one_or_none()
            if artifact is not None:
                content = dict(artifact.content or {})
                gen = dict(content.get("generation", {}))
                # Only overwrite if this job is still the latest
                if gen.get("last_generation_job_id") == job_id:
                    gen["variants"] = [
                        {
                            "id": v["id"],
                            "image_url": v.get("image_url"),
                            "generated_at": datetime.now(UTC).isoformat(),
                            "status": v["status"],
                            "selected": False,
                            "parent_variant_id": None,
                            "change_log": [],
                        }
                        for v in variants
                    ]
                    gen["turn_count_on_selected"] = 0
                    content["generation"] = gen
                    artifact.content = content
                    await db.commit()

        # ── Write READY to Redis ──────────────────────────────────────────────
        await _set_status("READY", {"variants": variants, "partial_failure": partial_failure})

    except Exception as exc:
        logger.exception("Poster generation job %s failed: %s", job_id, exc)
        await _set_status("FAILED", {"partial_failure": True, "error": str(exc)})
    finally:
        await r.aclose()
        await engine.dispose()


@celery_app.task(name="poster.generate", acks_late=True)
def generate_poster_task(
    job_id: str,
    artifact_id: str,
    merged_prompt: str,
    subject_type: str,
    reference_image_ids: list[str],
    count: int,
    format_name: str,
) -> None:
    """Celery task: sync wrapper that runs the async generation in a new event loop."""
    asyncio.run(
        _run_generation(
            job_id=job_id,
            artifact_id=artifact_id,
            merged_prompt=merged_prompt,
            subject_type=subject_type,
            reference_image_ids=reference_image_ids,
            count=count,
            format_name=format_name,
        )
    )
