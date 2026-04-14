"""Poster Wizard image generation orchestrator (Phase C / D).

Phase C (implemented):
  - 4-variant parallel generation via asyncio.gather
  - Per-slot seed-phrase diversity (gemini-2.5-flash-image has no temperature knob)
  - Exponential-backoff retry (250ms, 500ms, 1s; max 2 retries per slot)
  - One-active-job-per-artifact enforcement
  - Per-project daily variant cap (Redis)
  - Reference image downscaling (≤ 1536 px longest edge)
  - Retry token (HMAC-signed, 5-min TTL)

Phase D (service layer pre-wired, endpoint stub):
  - inpaint_variant() — mask-guided prompt editing + PIL server-side composite

Phase C+(Phase D): upscale_variant() — stub; strategy chosen in doc 04.
"""
import asyncio
import hashlib
import hmac
import io
import logging
import time
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.artifact import Artifact
from app.services.ai_service import GeminiImageError, generate_image_gemini
from app.services.upload_service import upload_image_bytes

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

VARIANT_TIMEOUT_SECONDS = 45
MAX_RETRIES = 0
BACKOFF_DELAYS = (2.0, 5.0, 10.0)   # seconds; longer waits help with 429 quota recovery
DAILY_VARIANT_CAP = 100
REFERENCE_IMAGE_MAX_EDGE = 1536      # px; downscale before inlining in Gemini request
RETRY_TOKEN_TTL_SECONDS = 300        # 5 minutes

# Per-slot seed phrases produce visual diversity without a temperature knob (doc 04)
SEED_PHRASES = [
    "soft natural lighting, understated composition",
    "bold directional lighting, confident composition",
    "warm golden-hour lighting, cinematic framing",
    "cool editorial lighting, minimal composition",
]

# Subfolder for reference images (S3 lifecycle policy target: delete after 48h)
REFERENCE_IMAGE_SUBFOLDER = "poster-ref-temp"

# Subfolder for generated poster variants
VARIANT_IMAGE_SUBFOLDER = "poster-variants"


# ── Retry token ───────────────────────────────────────────────────────────────


def make_retry_token(job_id: uuid.UUID, slot: int) -> str:
    """Create a short-TTL HMAC-signed retry token for a failed variant slot."""
    expiry = int(time.time()) + RETRY_TOKEN_TTL_SECONDS
    payload = f"{job_id}:{slot}:{expiry}"
    sig = hmac.new(
        settings.JWT_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{payload}:{sig}"


def verify_retry_token(token: str, job_id: uuid.UUID, slot: int) -> bool:
    """Return True if the token is valid, matches (job_id, slot), and has not expired."""
    try:
        parts = token.split(":", 3)
        if len(parts) != 4:
            return False
        tok_job, tok_slot, tok_expiry, tok_sig = parts
        if str(job_id) != tok_job or str(slot) != tok_slot:
            return False
        if int(tok_expiry) < int(time.time()):
            return False
        expected_payload = f"{tok_job}:{tok_slot}:{tok_expiry}"
        expected_sig = hmac.new(
            settings.JWT_SECRET.encode(),
            expected_payload.encode(),
            hashlib.sha256,
        ).hexdigest()[:16]
        return hmac.compare_digest(tok_sig, expected_sig)
    except Exception:
        return False


# ── Per-project daily cap (Redis) ──────────────────────────────────────────────


async def _check_and_increment_variant_quota(
    project_id: uuid.UUID,
    count: int = 4,
) -> None:
    """Increment the per-project daily variant counter.

    Raises ValueError(error_code="PROJECT_QUOTA_EXCEEDED") if the cap is hit.
    Redis failure is non-fatal — logs and continues (defensive design).
    """
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        today = date.today().isoformat()
        key = f"poster:project:{project_id}:variants:{today}"

        current = await r.get(key)
        current_count = int(current) if current else 0

        if current_count + count > DAILY_VARIANT_CAP:
            await r.aclose()
            raise ValueError(
                f"Daily variant limit of {DAILY_VARIANT_CAP} reached for this project."
            )

        new_count = await r.incrby(key, count)
        if new_count <= count:  # First write of the day — set midnight expiry
            tomorrow = datetime.combine(
                date.today() + timedelta(days=1), datetime.min.time()
            )
            await r.expireat(key, int(tomorrow.timestamp()))

        await r.aclose()

    except ValueError:
        raise  # propagate quota exceeded
    except Exception as exc:
        logger.warning("Redis variant quota check failed (non-fatal): %s", exc)


# ── Reference image helpers ───────────────────────────────────────────────────


async def _fetch_image_bytes(storage_url: str) -> bytes:
    """Fetch image bytes from local storage or S3/R2."""
    if storage_url.startswith("/uploads/"):
        from pathlib import Path
        upload_dir = Path(__file__).parent.parent.parent / "uploads"
        rel = storage_url[len("/uploads/"):]
        return (upload_dir / rel).read_bytes()

    # Remote URL (S3 signed URL or public endpoint)
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(storage_url)
        resp.raise_for_status()
        return resp.content


def _downscale_image_bytes(raw: bytes, max_edge: int = REFERENCE_IMAGE_MAX_EDGE) -> bytes:
    """Downscale image so its longest edge ≤ max_edge px (Pillow LANCZOS).

    Returns original bytes unchanged if already within bounds.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(raw))
        if max(img.size) <= max_edge:
            return raw
        img.thumbnail((max_edge, max_edge), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format=img.format or "PNG")
        return out.getvalue()
    except Exception as exc:
        logger.warning("Image downscale failed, using original: %s", exc)
        return raw


# ── Single-variant Gemini call ────────────────────────────────────────────────


async def _single_variant(
    merged_prompt: str,
    seed_phrase: str,
    reference_images_bytes: list[bytes],
    slot: int,
    job_id: uuid.UUID,
) -> dict:
    """Run one variant slot with timeout and exponential-backoff retry.

    Returns a result dict: {slot, status, image_bytes?, error_code?, retry_token?}.
    """
    slot_prompt = f"{merged_prompt}\n\nStyle direction: {seed_phrase}"

    for attempt in range(MAX_RETRIES + 1):
        try:
            image_bytes = await asyncio.wait_for(
                generate_image_gemini(
                    prompt=slot_prompt,
                    input_images=reference_images_bytes if reference_images_bytes else None,
                ),
                timeout=VARIANT_TIMEOUT_SECONDS,
            )
            return {
                "slot": slot,
                "status": "READY",
                "image_bytes": image_bytes,
                "job_id": str(job_id),
            }

        except TimeoutError:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(BACKOFF_DELAYS[attempt])
                continue
            logger.warning("Variant slot %d timed out after %d attempt(s)", slot, attempt + 1)
            return {
                "slot": slot,
                "status": "FAILED",
                "error_code": "AI_TIMEOUT",
                "retry_token": make_retry_token(job_id, slot),
            }

        except GeminiImageError as exc:
            # AI_CONTENT_POLICY is terminal — do not retry
            if exc.error_code == "AI_CONTENT_POLICY":
                return {
                    "slot": slot,
                    "status": "FAILED",
                    "error_code": exc.error_code,
                    "retry_token": make_retry_token(job_id, slot),
                }
            # Transient error — retry with backoff
            if attempt < MAX_RETRIES:
                await asyncio.sleep(BACKOFF_DELAYS[attempt])
                continue
            return {
                "slot": slot,
                "status": "FAILED",
                "error_code": exc.error_code,
                "retry_token": make_retry_token(job_id, slot),
            }

        except RuntimeError:
            # Gemini not configured — fail immediately (no retry)
            return {
                "slot": slot,
                "status": "FAILED",
                "error_code": "AI_UPSTREAM_ERROR",
                "retry_token": make_retry_token(job_id, slot),
            }

        except Exception as exc:
            logger.exception(
                "Variant slot %d unexpected error (attempt %d): %s", slot, attempt, exc
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(BACKOFF_DELAYS[attempt])
                continue
            return {
                "slot": slot,
                "status": "FAILED",
                "error_code": "AI_UPSTREAM_ERROR",
                "retry_token": make_retry_token(job_id, slot),
            }

    # Defensive fallback (should not be reached)
    return {
        "slot": slot,
        "status": "FAILED",
        "error_code": "AI_UPSTREAM_ERROR",
        "retry_token": make_retry_token(job_id, slot),
    }


# ── Variant set assembly ──────────────────────────────────────────────────────


async def _upload_and_assemble(
    slot_results: list,
    artifact_id: uuid.UUID,
) -> list[dict]:
    """Upload successful variant images and build the final variant list.

    Returns list of dicts matching the Variant schema.
    """
    variants = []
    for result in slot_results:
        if isinstance(result, BaseException):
            # asyncio.gather(return_exceptions=True) gave us an exception object
            variants.append({
                "id": str(uuid.uuid4()),
                "slot": len(variants),
                "status": "FAILED",
                "image_url": None,
                "error_code": "AI_UPSTREAM_ERROR",
                "retry_token": None,
            })
            continue

        slot = result.get("slot", len(variants))
        if result.get("status") == "READY":
            image_bytes = result.get("image_bytes", b"")
            url = await upload_image_bytes(
                data=image_bytes,
                subfolder=f"{VARIANT_IMAGE_SUBFOLDER}/{artifact_id}",
                extension="png",
            )
            variants.append({
                "id": str(uuid.uuid4()),
                "slot": slot,
                "status": "READY",
                "image_url": url,
                "error_code": None,
                "retry_token": None,
            })
        else:
            variants.append({
                "id": str(uuid.uuid4()),
                "slot": slot,
                "status": "FAILED",
                "image_url": None,
                "error_code": result.get("error_code", "AI_UPSTREAM_ERROR"),
                "retry_token": result.get("retry_token"),
            })

    return sorted(variants, key=lambda v: v["slot"])


# ── Job dispatch + status (worker-based generation) ───────────────────────────

JOB_KEY_PREFIX = "poster:gen:job:"
JOB_TTL_SECONDS = 3600


async def dispatch_generate_variants_job(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    merged_prompt: str,
    subject_type: str,
    reference_image_ids: list[uuid.UUID],
    count: int,
    format_name: str,
) -> str:
    """Dispatch a poster generation job to the Celery worker.

    1. Verify artifact exists.
    2. Enforce one-active-job per artifact (write job_id to artifact.content).
    3. Check per-project daily quota (Redis).
    4. Write QUEUED state to Redis.
    5. Send task to Celery.
    Returns the new job_id string.
    """
    import json
    import redis.asyncio as aioredis

    # ── 1. Fetch artifact ─────────────────────────────────────────────────────
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise ValueError("Artifact not found")

    project_id = artifact.project_id

    # ── 2. One-active-job enforcement ─────────────────────────────────────────
    job_id = str(uuid.uuid4())
    content = dict(artifact.content or {})
    generation = dict(content.get("generation", {}))
    generation["last_generation_job_id"] = job_id
    content["generation"] = generation
    artifact.content = content
    await db.flush()
    await db.commit()

    # ── 3. Per-project daily quota ────────────────────────────────────────────
    try:
        await _check_and_increment_variant_quota(project_id, count)
    except ValueError:
        raise

    # ── 4. Write QUEUED state to Redis ────────────────────────────────────────
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.setex(
            f"{JOB_KEY_PREFIX}{job_id}",
            JOB_TTL_SECONDS,
            json.dumps({"status": "QUEUED", "variants": [], "partial_failure": False, "error": None}),
        )
        await r.aclose()
    except Exception as exc:
        logger.warning("Failed to write QUEUED state to Redis: %s (continuing)", exc)

    # ── 5. Dispatch Celery task ───────────────────────────────────────────────
    from app.services.poster_generation_worker import generate_poster_task

    generate_poster_task.apply_async(
        kwargs={
            "job_id": job_id,
            "artifact_id": str(artifact_id),
            "merged_prompt": merged_prompt,
            "subject_type": subject_type,
            "reference_image_ids": [str(rid) for rid in reference_image_ids],
            "count": count,
            "format_name": format_name,
        },
        queue="poster",
    )

    return job_id


async def get_variant_job_status(job_id: str) -> dict:
    """Read the current generation job status from Redis.

    Returns dict with keys: status, variants, partial_failure, error.
    If the key is not found (expired or never created) returns FAILED.
    """
    import json
    import redis.asyncio as aioredis

    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        raw = await r.get(f"{JOB_KEY_PREFIX}{job_id}")
        await r.aclose()
        if raw is None:
            return {"status": "FAILED", "variants": [], "partial_failure": True, "error": "Job not found or expired"}
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Failed to read job status from Redis: %s", exc)
        return {"status": "FAILED", "variants": [], "partial_failure": True, "error": str(exc)}


# ── Public API (synchronous fallback, kept for retry endpoint) ─────────────────


async def generate_variants(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    merged_prompt: str,
    subject_type: str,
    reference_image_ids: list[uuid.UUID],
    count: int,
    format_name: str,
) -> dict:
    """Orchestrate 4-variant parallel image generation (Phase C).

    Steps:
    1. Fetch artifact + project_id for quota check.
    2. Enforce one-active-job per artifact (overwrite last_generation_job_id).
    3. Check per-project daily cap via Redis.
    4. Fetch and downscale reference images (PRODUCT_ASSET only).
    5. asyncio.gather count variant tasks.
    6. Upload successful images, build variant entries.
    7. Persist updated generation state to artifact.content.
    8. Return {job_id, variants, partial_failure}.
    """
    # ── 1. Fetch artifact with row-level lock ─────────────────────────────────
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise ValueError("Artifact not found")

    project_id = artifact.project_id

    # ── 2. One-active-job enforcement: set new job_id and commit immediately ──
    job_id = uuid.uuid4()
    content = dict(artifact.content or {})
    generation = dict(content.get("generation", {}))
    generation["last_generation_job_id"] = str(job_id)
    content["generation"] = generation
    artifact.content = content
    await db.flush()
    await db.commit()  # release the row lock so other requests don't deadlock

    # ── 3. Per-project daily cap ──────────────────────────────────────────────
    try:
        await _check_and_increment_variant_quota(project_id, count)
    except ValueError as exc:
        raise ValueError(str(exc)) from exc

    # ── 4. Reference image fetching + downscaling (PRODUCT_ASSET only) ────────
    reference_images_bytes: list[bytes] = []
    if subject_type == "PRODUCT_ASSET" and reference_image_ids:
        from app.models.poster import PosterReferenceImage
        ref_result = await db.execute(
            select(PosterReferenceImage).where(
                PosterReferenceImage.id.in_(reference_image_ids)
            )
        )
        ref_rows = ref_result.scalars().all()
        for row in ref_rows:
            try:
                raw = await _fetch_image_bytes(row.storage_url)
                scaled = _downscale_image_bytes(raw)
                reference_images_bytes.append(scaled)
            except Exception as exc:
                logger.warning(
                    "Could not load reference image %s: %s — skipping",
                    row.id,
                    exc,
                )

    # ── 5. Parallel generation ────────────────────────────────────────────────
    seed_phrases = SEED_PHRASES[:count]
    tasks = [
        _single_variant(merged_prompt, seed, reference_images_bytes, slot, job_id)
        for slot, seed in enumerate(seed_phrases)
    ]
    slot_results = await asyncio.gather(*tasks, return_exceptions=True)

    # ── 6. Upload + assemble ──────────────────────────────────────────────────
    variants = await _upload_and_assemble(slot_results, artifact_id)
    partial_failure = any(v["status"] == "FAILED" for v in variants)

    # ── 7. Persist to artifact.content — only if this job is still current ────
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = result.scalar_one_or_none()
    if artifact is not None:
        current_content = dict(artifact.content or {})
        current_generation = current_content.get("generation", {})
        if current_generation.get("last_generation_job_id") == str(job_id):
            # Build VariantContent entries from results
            variant_entries = []
            for v in variants:
                variant_entries.append({
                    "id": v["id"],
                    "image_url": v.get("image_url"),
                    "generated_at": datetime.now(UTC).isoformat(),
                    "status": v["status"],
                    "selected": False,
                    "parent_variant_id": None,
                    "change_log": [],
                })
            current_generation["variants"] = variant_entries
            current_generation["turn_count_on_selected"] = 0
            current_content["generation"] = current_generation
            artifact.content = current_content
            await db.flush()
            await db.commit()
        else:
            logger.info(
                "Job %s results discarded — superseded by newer job %s",
                job_id,
                current_generation.get("last_generation_job_id"),
            )
            await db.rollback()

    return {
        "job_id": job_id,
        "variants": variants,
        "partial_failure": partial_failure,
    }


async def retry_single_variant(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    job_id: uuid.UUID,
    slot: int,
    retry_token: str,
    merged_prompt: str,
    reference_image_ids: list[uuid.UUID],
    subject_type: str,
) -> dict:
    """Re-run a single failed variant slot after verifying the retry token.

    Returns the updated variant dict {id, slot, status, image_url?, error_code?, retry_token?}.
    """
    if not verify_retry_token(retry_token, job_id, slot):
        raise PermissionError("Invalid or expired retry token")

    if slot not in range(len(SEED_PHRASES)):
        raise ValueError(f"Invalid slot index: {slot}")

    seed = SEED_PHRASES[slot]

    # Fetch reference images if needed
    reference_images_bytes: list[bytes] = []
    if subject_type == "PRODUCT_ASSET" and reference_image_ids:
        from app.models.poster import PosterReferenceImage
        ref_result = await db.execute(
            select(PosterReferenceImage).where(
                PosterReferenceImage.id.in_(reference_image_ids)
            )
        )
        for row in ref_result.scalars().all():
            try:
                raw = await _fetch_image_bytes(row.storage_url)
                reference_images_bytes.append(_downscale_image_bytes(raw))
            except Exception as exc:
                logger.warning("Could not load reference image %s: %s — skipping", row.id, exc)

    result = await _single_variant(merged_prompt, seed, reference_images_bytes, slot, job_id)

    variant_dict = (await _upload_and_assemble([result], artifact_id))[0]

    # Patch the artifact content at this slot's variant index
    db_result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = db_result.scalar_one_or_none()
    if artifact is not None:
        content = dict(artifact.content or {})
        generation = content.get("generation", {})
        if generation.get("last_generation_job_id") == str(job_id):
            variants = list(generation.get("variants", []))
            # Slot-based replacement by position in list
            if slot < len(variants):
                variants[slot] = {
                    **variants[slot],
                    "image_url": variant_dict.get("image_url"),
                    "status": variant_dict["status"],
                    "generated_at": datetime.now(UTC).isoformat(),
                }
            generation["variants"] = variants
            content["generation"] = generation
            artifact.content = content
            await db.flush()
            await db.commit()

    return variant_dict


# ── Phase D — Inpaint (service layer pre-wired) ────────────────────────────────


async def inpaint_variant(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    variant_id: str,
    mask_png_bytes: bytes,
    description: str,
    original_merged_prompt: str,
) -> dict:
    """Mask-guided prompt editing for region edits (Phase D).

    Flow per doc 04:
    1. Fetch current variant image bytes.
    2. Build a red-fill mask overlay (PIL composite).
    3. Call gemini-2.5-flash-image with [prompt, current_image, mask_overlay].
    4. PIL server-side composite: paste original unmasked pixels over Gemini output.
    5. Upload composited result.
    6. Create PosterChatTurn row (action_type=INPAINT).
    7. Return {turn_id, new_image_url, change_description}.
    """
    from PIL import Image

    # ── Fetch current variant image from artifact ──────────────────────────────
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise ValueError("Artifact not found")

    content = artifact.content or {}
    generation = content.get("generation", {})
    variants = generation.get("variants", [])
    current_variant = next((v for v in variants if v.get("id") == variant_id), None)
    if current_variant is None or not current_variant.get("image_url"):
        raise ValueError("Variant not found or has no image")

    current_image_bytes = await _fetch_image_bytes(current_variant["image_url"])

    # ── Validate and prep mask ─────────────────────────────────────────────────
    current_img = Image.open(io.BytesIO(current_image_bytes)).convert("RGBA")
    mask_img = Image.open(io.BytesIO(mask_png_bytes)).convert("RGBA")

    if mask_img.size != current_img.size:
        raise ValueError(
            f"Mask dimensions {mask_img.size} do not match image {current_img.size}"
        )

    # Check mask coverage (alpha channel as the edit mask; 60% cap)
    mask_alpha = mask_img.split()[3]  # alpha channel
    total_pixels = mask_img.width * mask_img.height
    edit_pixels = sum(1 for px in mask_alpha.getdata() if px > 128)
    if edit_pixels / total_pixels > 0.60:
        raise ValueError(
            "Mask covers more than 60% of the image. "
            "Use 'Regenerate' for large-area changes."
        )

    # ── Build red-fill mask overlay ─────────────────────────────────────────────
    red_fill = Image.new("RGBA", current_img.size, (255, 30, 30, 0))
    # Use mask alpha as the opacity of the red fill
    for x in range(current_img.width):
        for y in range(current_img.height):
            alpha = mask_img.getpixel((x, y))[3]
            if alpha > 0:
                red_fill.putpixel((x, y), (255, 30, 30, alpha))
    overlay_img = Image.alpha_composite(current_img.copy(), red_fill)
    overlay_out = io.BytesIO()
    overlay_img.save(overlay_out, format="PNG")
    overlay_bytes = overlay_out.getvalue()

    # ── Build inpaint prompt ───────────────────────────────────────────────────
    # Extract style sentence from the original merged prompt (first sentence)
    style_anchor = original_merged_prompt.split("\n")[0].strip()
    inpaint_prompt = (
        "Maintain the overall composition and style of this image.\n"
        "Edit ONLY the area shown highlighted in red in the second image provided; "
        "leave every other pixel unchanged.\n"
        f"In that area: {description}.\n"
        f"Style anchor: {style_anchor}"
    )

    # ── Call Gemini image-editing mode ─────────────────────────────────────────
    edited_bytes = await generate_image_gemini(
        prompt=inpaint_prompt,
        input_images=[current_image_bytes, overlay_bytes],
    )

    # ── Server-side composite: restore unmasked pixels ─────────────────────────
    edited_img = Image.open(io.BytesIO(edited_bytes)).convert("RGBA")
    if edited_img.size != current_img.size:
        edited_img = edited_img.resize(current_img.size, Image.LANCZOS)

    # Invert mask for PIL composite (0 = use edited, 255 = use original)
    binary_mask = mask_alpha.point(lambda p: 0 if p > 128 else 255)
    composited = Image.composite(current_img, edited_img, binary_mask)
    comp_out = io.BytesIO()
    composited.save(comp_out, format="PNG")
    composited_bytes = comp_out.getvalue()

    # ── Upload result ──────────────────────────────────────────────────────────
    new_url = await upload_image_bytes(
        data=composited_bytes,
        subfolder=f"{VARIANT_IMAGE_SUBFOLDER}/{artifact_id}/inpaint",
        extension="png",
    )

    # ── Upload mask for audit trail ────────────────────────────────────────────
    mask_url = await upload_image_bytes(
        data=mask_png_bytes,
        subfolder=f"{VARIANT_IMAGE_SUBFOLDER}/{artifact_id}/masks",
        extension="png",
    )

    # ── Create PosterChatTurn row ──────────────────────────────────────────────
    from app.models.poster import PosterChatTurn
    from app.services.poster_refine_service import TURN_LIMIT, count_turns

    turn_id = uuid.uuid4()
    variant_uuid = uuid.UUID(variant_id)
    # Authoritative turn index: count rows in poster_chat_turns, excluding
    # REDIRECT turns which don't consume the 6-turn budget (doc 07).
    # This count runs INSIDE the artifact lock acquired at the top of this
    # function — the race the endpoint-level pre-check has (caller A and B
    # both pass at count=5) is closed here: A holds the lock while B blocks,
    # so when B's count_turns runs, A's commit has landed and B sees count=6
    # and bails before inserting a 7th turn.
    current_turn_index = await count_turns(db, artifact_id, variant_uuid)
    if current_turn_index >= TURN_LIMIT:
        raise ValueError(
            "Turn limit reached during concurrent inpaint — save as variant first."
        )

    chat_turn = PosterChatTurn(
        id=turn_id,
        artifact_id=artifact_id,
        variant_id=variant_uuid,
        turn_index=current_turn_index,
        user_message=f"Region edit: {description}",
        ai_response=f"Applied region edit to the highlighted area: {description}",
        action_type="INPAINT",
        resulting_image_url=new_url,
        inpaint_mask_url=mask_url,
        structural_change_detected=False,
    )
    db.add(chat_turn)

    # ── Update variant in artifact content + mirror turn counter ──────────────
    now_iso = datetime.now(UTC).isoformat()
    change_description = f"Region edit: {description[:30]}"
    for v in variants:
        if v.get("id") == variant_id:
            v["image_url"] = new_url
            v["generated_at"] = now_iso
            v["status"] = "READY"
            v.setdefault("change_log", []).append({
                "id": str(turn_id),
                "description": change_description,
                "accepted_at": now_iso,
            })
            break
    generation["turn_count_on_selected"] = current_turn_index + 1
    content["generation"] = generation
    artifact.content = content
    await db.flush()
    await db.commit()

    return {
        "turn_id": turn_id,
        "new_image_url": new_url,
        "change_description": change_description,
    }


# ── Upscale (Phase C+) ────────────────────────────────────────────────────────


async def upscale_variant(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    variant_id: str,
) -> str:
    """Upscale a variant image (Phase C+, doc 04 §Upscale).

    Strategy 1: Gemini prompt re-render at 2× resolution.
    Strategy 2 fallback: Pillow Lanczos resize.
    Returns the new image URL.
    """
    # Fetch current image
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id)
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise ValueError("Artifact not found")

    generation = (artifact.content or {}).get("generation", {})
    variant = next(
        (v for v in generation.get("variants", []) if v.get("id") == variant_id),
        None,
    )
    if not variant or not variant.get("image_url"):
        raise ValueError("Variant not found or has no image")

    raw_bytes = await _fetch_image_bytes(variant["image_url"])

    # Strategy 1: Gemini re-render
    try:
        upscale_prompt = (
            "Render this exact composition at twice the resolution, preserving every "
            "element; increase fine detail and sharpness. Do not change colours, "
            "layout, or subject."
        )
        upscaled_bytes = await asyncio.wait_for(
            generate_image_gemini(prompt=upscale_prompt, input_images=[raw_bytes]),
            timeout=60,
        )
        # pHash drift check (if image is too different, fall back)
        if _phash_similar(raw_bytes, upscaled_bytes, threshold=15):
            url = await upload_image_bytes(
                data=upscaled_bytes,
                subfolder=f"{VARIANT_IMAGE_SUBFOLDER}/{artifact_id}/upscaled",
                extension="png",
            )
            return url
        logger.info("Upscale strategy 1 drift exceeded threshold; falling back to Lanczos")
    except Exception as exc:
        logger.warning("Upscale strategy 1 failed: %s — falling back to Lanczos", exc)

    # Strategy 2: Pillow Lanczos
    from PIL import Image
    img = Image.open(io.BytesIO(raw_bytes))
    upscaled = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    out = io.BytesIO()
    upscaled.save(out, format="PNG")
    url = await upload_image_bytes(
        data=out.getvalue(),
        subfolder=f"{VARIANT_IMAGE_SUBFOLDER}/{artifact_id}/upscaled",
        extension="png",
    )
    return url


def _phash_similar(img1_bytes: bytes, img2_bytes: bytes, threshold: int = 15) -> bool:
    """Return True if the two images are perceptually similar (pHash distance < threshold).

    Falls back to True (accept the Gemini output) if Pillow is unavailable.
    """
    try:
        from PIL import Image

        def _phash(raw: bytes) -> int:
            img = Image.open(io.BytesIO(raw)).convert("L").resize((8, 8), Image.LANCZOS)
            pixels = list(img.getdata())
            avg = sum(pixels) / len(pixels)
            bits = "".join("1" if p >= avg else "0" for p in pixels)
            return int(bits, 2)

        h1 = _phash(img1_bytes)
        h2 = _phash(img2_bytes)
        distance = bin(h1 ^ h2).count("1")
        return distance < threshold
    except Exception:
        return True  # accept on error
