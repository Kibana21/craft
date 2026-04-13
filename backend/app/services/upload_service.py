import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

# Local upload directory (fallback when S3 is not configured)
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


async def upload_file(file: UploadFile, subfolder: str = "assets") -> tuple[str, str]:
    """Upload a file to S3 or local storage.
    Returns (url, filename).
    """
    ext = Path(file.filename or "file").suffix
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    folder_path = UPLOAD_DIR / subfolder
    folder_path.mkdir(parents=True, exist_ok=True)

    if settings.S3_BUCKET:
        # TODO: S3 upload with boto3
        pass

    # Local fallback
    file_path = folder_path / safe_filename
    content = await file.read()
    file_path.write_bytes(content)

    url = f"/uploads/{subfolder}/{safe_filename}"
    return url, safe_filename


async def upload_video_bytes(
    video_bytes: bytes,
    artifact_id: str,
    version: int,
) -> str:
    """Save final rendered MP4 and return its URL.
    Naming convention: videos/{artifact_id}/v{version}.mp4
    """
    subfolder = f"videos/{artifact_id}"
    filename = f"v{version}.mp4"
    folder_path = UPLOAD_DIR / subfolder
    folder_path.mkdir(parents=True, exist_ok=True)

    if settings.S3_BUCKET:
        try:
            import boto3
            from botocore.config import Config

            s3 = boto3.client(
                "s3",
                region_name=settings.S3_REGION,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                endpoint_url=settings.S3_ENDPOINT_URL or None,
                config=Config(multipart_threshold=8 * 1024 * 1024),
            )
            key = f"{subfolder}/{filename}"
            import io
            s3.upload_fileobj(io.BytesIO(video_bytes), settings.S3_BUCKET, key)
            base = settings.S3_ENDPOINT_URL or f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com"
            return f"{base}/{key}"
        except Exception as e:
            print(f"S3 video upload failed, falling back to local: {e}")

    # Local fallback
    file_path = folder_path / filename
    file_path.write_bytes(video_bytes)
    return f"/uploads/{subfolder}/{filename}"


async def upload_image_bytes(
    data: bytes,
    subfolder: str,
    extension: str = "png",
) -> str:
    """Upload raw image bytes to S3 or local storage. Returns the public URL."""
    safe_filename = f"{uuid.uuid4().hex}.{extension}"
    folder_path = UPLOAD_DIR / subfolder
    folder_path.mkdir(parents=True, exist_ok=True)

    if settings.S3_BUCKET:
        try:
            import io as _io

            import boto3
            from botocore.config import Config

            s3 = boto3.client(
                "s3",
                region_name=settings.S3_REGION,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                endpoint_url=settings.S3_ENDPOINT_URL or None,
                config=Config(multipart_threshold=8 * 1024 * 1024),
            )
            key = f"{subfolder}/{safe_filename}"
            s3.upload_fileobj(_io.BytesIO(data), settings.S3_BUCKET, key)
            base = (
                settings.S3_ENDPOINT_URL
                or f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com"
            )
            return f"{base}/{key}"
        except Exception as exc:
            print(f"S3 image bytes upload failed, falling back to local: {exc}")

    # Local fallback
    file_path = folder_path / safe_filename
    file_path.write_bytes(data)
    return f"/uploads/{subfolder}/{safe_filename}"


async def process_headshot(file: UploadFile) -> tuple[str, str]:
    """Process and upload a headshot: crop to square, resize to 400x400."""
    try:
        from PIL import Image
        import io

        content = await file.read()
        img = Image.open(io.BytesIO(content))

        # Crop to square (center crop)
        w, h = img.size
        size = min(w, h)
        left = (w - size) // 2
        top = (h - size) // 2
        img = img.crop((left, top, left + size, top + size))

        # Resize to 400x400
        img = img.resize((400, 400), Image.Resampling.LANCZOS)

        # Save
        safe_filename = f"{uuid.uuid4().hex}.jpg"
        folder_path = UPLOAD_DIR / "photos"
        folder_path.mkdir(parents=True, exist_ok=True)
        file_path = folder_path / safe_filename
        img.save(file_path, "JPEG", quality=90)

        url = f"/uploads/photos/{safe_filename}"
        return url, safe_filename
    except ImportError:
        # Pillow not available — just save raw
        return await upload_file(file, "photos")
