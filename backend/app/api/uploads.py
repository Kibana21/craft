import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.poster import RefImageUploadResponse
from app.schemas.upload import UploadResponse
from app.services.upload_service import process_headshot, upload_file

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Reference image temp-tier constants
REFERENCE_IMAGE_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
REFERENCE_IMAGE_MAX_SIZE = 20 * 1024 * 1024  # 20 MB (per doc 02)
REFERENCE_IMAGE_PER_ARTIFACT_CAP = 3
REFERENCE_IMAGE_TTL_HOURS = 24

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/photo", response_model=UploadResponse)
async def upload_photo(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
) -> UploadResponse:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, WebP, GIF",
        )

    url, filename = await process_headshot(file)
    ct = file.content_type or "image/jpeg"
    return UploadResponse(url=url, filename=filename, content_type=ct)


@router.post("/asset", response_model=UploadResponse)
async def upload_asset(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
) -> UploadResponse:
    url, filename = await upload_file(file, "assets")
    ct = file.content_type or "application/octet-stream"
    return UploadResponse(url=url, filename=filename, content_type=ct)


# ── Poster Wizard reference-image temp tier ───────────────────────────────────


@router.post(
    "/reference-image-temp",
    response_model=RefImageUploadResponse,
    status_code=201,
    summary="Upload a temporary poster reference image (Phase C)",
)
async def upload_reference_image_temp(
    file: UploadFile = File(...),
    artifact_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RefImageUploadResponse:
    """Upload a reference image for PRODUCT_ASSET subject type.

    Enforces:
    - MIME whitelist (PNG / JPG / WebP)
    - 20 MB file-size cap
    - Max 3 reference images per artifact
    Sets expires_at = now + 24h.
    """
    from app.models.poster import PosterReferenceImage

    # MIME check
    content_type = file.content_type or ""
    if content_type not in REFERENCE_IMAGE_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": f"Unsupported file type: {content_type}. Allowed: PNG, JPEG, WebP.",
                "error_code": "VALIDATION_ERROR",
            },
        )

    # Size check — read into memory (20 MB cap is reasonable for images)
    data = await file.read()
    if len(data) > REFERENCE_IMAGE_MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "File exceeds 20 MB limit.", "error_code": "FILE_TOO_LARGE"},
        )

    # Per-artifact cap
    if artifact_id is not None:
        existing_count = (
            await db.execute(
                select(PosterReferenceImage).where(
                    PosterReferenceImage.artifact_id == artifact_id,
                )
            )
        ).scalars().all()
        if len(existing_count) >= REFERENCE_IMAGE_PER_ARTIFACT_CAP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": (
                        f"Artifact already has {REFERENCE_IMAGE_PER_ARTIFACT_CAP} reference images."
                    ),
                    "error_code": "REFERENCE_LIMIT_EXCEEDED",
                },
            )

    # Persist file
    from io import BytesIO

    file.file = BytesIO(data)  # type: ignore[assignment]
    file.size = len(data)
    storage_url, _ = await upload_file(file, "poster-ref-temp")

    # DB row
    expires_at = datetime.now(UTC) + timedelta(hours=REFERENCE_IMAGE_TTL_HOURS)
    ref_image = PosterReferenceImage(
        uploader_id=current_user.id,
        artifact_id=artifact_id,
        storage_url=storage_url,
        mime_type=content_type,
        size_bytes=len(data),
        expires_at=expires_at,
    )
    db.add(ref_image)
    await db.flush()
    await db.refresh(ref_image)
    return RefImageUploadResponse(
        id=ref_image.id,
        storage_url=ref_image.storage_url,
        expires_at=ref_image.expires_at,
    )


@router.delete(
    "/reference-image-temp/{image_id}",
    status_code=204,
    summary="Delete a temporary reference image (Phase C)",
)
async def delete_reference_image_temp(
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Owner-only deletion. Removes DB row and storage object."""
    from app.models.poster import PosterReferenceImage
    from app.services.poster_sweep_service import _delete_storage_object

    result = await db.execute(
        select(PosterReferenceImage).where(PosterReferenceImage.id == image_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reference image not found"
        )

    if row.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "You do not own this reference image.", "error_code": "RBAC_DENIED"},
        )

    try:
        _delete_storage_object(row.storage_url)
    except Exception as exc:
        logging.getLogger(__name__).warning("Storage delete failed (non-fatal): %s", exc)

    await db.delete(row)
