from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status

from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.upload import UploadResponse
from app.services.upload_service import upload_file, process_headshot

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

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
    return UploadResponse(url=url, filename=filename, content_type=file.content_type or "image/jpeg")


@router.post("/asset", response_model=UploadResponse)
async def upload_asset(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
) -> UploadResponse:
    url, filename = await upload_file(file, "assets")
    return UploadResponse(url=url, filename=filename, content_type=file.content_type or "application/octet-stream")
