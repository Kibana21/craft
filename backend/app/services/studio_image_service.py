"""My Studio — library CRUD (Phase A).

Uses the existing `upload_image_bytes` helper for storage and mirrors the
soft-delete / ownership patterns already present in the codebase. AI-output
creation happens in `studio_generation_worker` (Phase B+); this module only
handles user-driven library operations.
"""
from __future__ import annotations

import io
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StudioImageType
from app.models.gamification import PointsAction
from app.models.studio import StudioImage
from app.services.gamification_service import award_points
from app.services.upload_service import upload_image_bytes

logger = logging.getLogger(__name__)

# ── Validation knobs ─────────────────────────────────────────────────────────

MAX_BYTES = 25 * 1024 * 1024  # 25 MB per PRD §14.1
ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp", "image/heic"}
THUMBNAIL_MAX_EDGE = 256      # px; WebP thumbs for grid render
LIBRARY_SOFT_CAP = 500        # PRD §14.1


# ── Internal helpers ─────────────────────────────────────────────────────────


def _ext_from_mime(mime: str) -> str:
    return {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/heic": "heic",
    }.get(mime, "png")


async def _build_thumbnail_bytes(raw: bytes) -> bytes | None:
    """Return a 256px-wide WebP thumbnail. None on any failure (not fatal)."""
    try:
        from PIL import Image
    except Exception:  # pragma: no cover — Pillow is a hard dep
        return None

    try:
        img = Image.open(io.BytesIO(raw))
        img.thumbnail((THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE * 4))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=82, method=4)
        return buf.getvalue()
    except Exception as exc:  # noqa: BLE001 — thumbnail is best-effort
        logger.warning("studio thumbnail build failed: %s", exc)
        return None


def _image_dimensions(raw: bytes) -> tuple[int | None, int | None]:
    """Return (width, height) via Pillow; (None, None) on any failure."""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(raw))
        return img.width, img.height
    except Exception:
        return None, None


# ── Public API ────────────────────────────────────────────────────────────────


async def create_from_upload(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    upload: UploadFile,
) -> StudioImage:
    """Validate, upload, thumbnail, insert a PHOTO row, award points."""
    mime = (upload.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "detail": "Unsupported format — use PNG, JPG, WEBP, or HEIC.",
                "error_code": "STUDIO_UPLOAD_BAD_MIME",
            },
        )

    raw = await upload.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "detail": "File too large — max 25 MB.",
                "error_code": "STUDIO_UPLOAD_TOO_LARGE",
            },
        )

    ext = _ext_from_mime(mime)
    subfolder = f"studio/{user_id}"
    storage_url = await upload_image_bytes(data=raw, subfolder=subfolder, extension=ext)

    # Best-effort thumbnail — don't fail the upload if it can't be generated.
    thumb_bytes = await _build_thumbnail_bytes(raw)
    thumbnail_url: str | None = None
    if thumb_bytes is not None:
        thumbnail_url = await upload_image_bytes(
            data=thumb_bytes, subfolder=f"{subfolder}/thumbs", extension="webp"
        )

    width, height = _image_dimensions(raw)

    name = upload.filename or f"Upload {datetime.now(timezone.utc).strftime('%d %b %Y')}"
    # Cap filename length to the column bound and strip the extension for display.
    display_name = name.rsplit("/", 1)[-1][:200]

    row = StudioImage(
        id=uuid.uuid4(),
        user_id=user_id,
        name=display_name,
        type=StudioImageType.PHOTO.value,
        storage_url=storage_url,
        thumbnail_url=thumbnail_url,
        mime_type=mime,
        size_bytes=len(raw),
        width_px=width,
        height_px=height,
    )
    db.add(row)
    await db.flush()

    # Each upload is a distinct row, so plain (non-idempotent) award is correct
    # here. `award_points_once` keys on `related_artifact_id` which has a FK into
    # artifacts(id); passing a studio-image UUID would violate that FK.
    try:
        await award_points(db, user_id, PointsAction.MY_STUDIO_UPLOAD)
    except Exception as exc:  # noqa: BLE001 — gamification failure must never block uploads
        logger.warning("points award failed on studio upload: %s", exc)

    return row


async def list_for_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    image_type: str | None = None,
    q: str | None = None,
    page: int = 1,
    per_page: int = 24,
) -> tuple[list[StudioImage], int]:
    """Paginated, type-filtered, search-able library list for the owner."""
    page = max(page, 1)
    per_page = max(min(per_page, 100), 1)

    base_conditions = [
        StudioImage.user_id == user_id,
        StudioImage.deleted_at.is_(None),
    ]
    if image_type:
        base_conditions.append(StudioImage.type == image_type)
    if q:
        like = f"%{q.strip()}%"
        base_conditions.append(StudioImage.name.ilike(like))

    total_stmt = select(func.count(StudioImage.id)).where(and_(*base_conditions))
    total = int((await db.execute(total_stmt)).scalar_one())

    items_stmt = (
        select(StudioImage)
        .where(and_(*base_conditions))
        .order_by(StudioImage.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = list((await db.execute(items_stmt)).scalars().all())
    return items, total


async def get_owned(
    db: AsyncSession, *, image_id: uuid.UUID, user_id: uuid.UUID
) -> StudioImage:
    """Fetch an image; 404 if missing, 403 if not owned. No BRAND_ADMIN bypass
    on purpose — My Studio is strictly personal (PRD §1.1)."""
    row = (
        await db.execute(
            select(StudioImage).where(
                StudioImage.id == image_id,
                StudioImage.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Image not found")
    if row.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail={
                "detail": "Not authorized",
                "error_code": "STUDIO_IMAGE_NOT_OWNED",
            },
        )
    return row


async def rename(
    db: AsyncSession,
    *,
    image_id: uuid.UUID,
    user_id: uuid.UUID,
    name: str,
    tags: list[str] | None = None,
) -> StudioImage:
    row = await get_owned(db, image_id=image_id, user_id=user_id)
    row.name = name.strip()[:200]
    if tags is not None:
        row.tags = tags
    await db.flush()
    return row


async def soft_delete(
    db: AsyncSession, *, image_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    row = await get_owned(db, image_id=image_id, user_id=user_id)
    row.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def count_active(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    """Total active (non-deleted) images for the user — used to surface the
    soft-cap banner at 450 and hard-block at 500 (PRD §14.1)."""
    stmt = select(func.count(StudioImage.id)).where(
        StudioImage.user_id == user_id,
        StudioImage.deleted_at.is_(None),
    )
    return int((await db.execute(stmt)).scalar_one())


def to_detail_response(
    row: StudioImage, *, source: StudioImage | None, run_summary: dict | None
):
    """Shape an ORM row into StudioImageDetailResponse-compatible dict.
    Kept here (not in schemas) so Phase B can reuse it after adding run nesting.
    """
    # Lazy import to avoid circularity with schemas during Alembic autogen.
    from app.schemas.studio import StudioImageDetailResponse, StudioImageResponse

    source_payload = (
        StudioImageResponse.model_validate(source) if source is not None else None
    )
    return StudioImageDetailResponse(
        id=row.id,
        name=row.name,
        type=row.type,  # type: ignore[arg-type]
        storage_url=row.storage_url,
        thumbnail_url=row.thumbnail_url,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        width_px=row.width_px,
        height_px=row.height_px,
        source_image_id=row.source_image_id,
        workflow_run_id=row.workflow_run_id,
        created_at=row.created_at,
        source_image=source_payload,
        workflow_run=None if run_summary is None else run_summary,  # type: ignore[arg-type]
        prompt_used=row.prompt_used,
    )
