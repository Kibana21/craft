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
