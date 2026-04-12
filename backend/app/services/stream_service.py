"""
HTTP Range-aware MP4 streaming for generated videos.

Supports both local file storage (dev) and S3 (prod).
Returns a StreamingResponse with 206 Partial Content when a Range header
is present, or a full 200 response otherwise.
"""
import re
from pathlib import Path
from typing import AsyncIterator

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

from app.services.upload_service import UPLOAD_DIR
from app.core.config import settings

CHUNK_SIZE = 1024 * 1024  # 1 MB


def _parse_range(range_header: str, total: int) -> tuple[int, int]:
    """Parse 'bytes=start-end' and clamp to [0, total-1]."""
    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Invalid Range header",
        )
    start_str, end_str = match.group(1), match.group(2)
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else total - 1
    end = min(end, total - 1)
    if start > end or start >= total:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail=f"Range {start}-{end} out of bounds for file of size {total}",
        )
    return start, end


def _local_path_from_url(file_url: str) -> Path | None:
    """Convert a /uploads/... URL to an absolute local path, or None if it's an HTTP URL."""
    if file_url.startswith("/uploads/"):
        relative = file_url.removeprefix("/uploads/")
        return UPLOAD_DIR / relative
    return None


async def _stream_local(path: Path, start: int, end: int) -> AsyncIterator[bytes]:
    """Yield file bytes between start and end (inclusive) in CHUNK_SIZE chunks."""
    remaining = end - start + 1
    with open(path, "rb") as f:
        f.seek(start)
        while remaining > 0:
            chunk = f.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


async def _stream_s3(key: str, start: int, end: int) -> AsyncIterator[bytes]:
    """Yield S3 object bytes for the given byte range."""
    import boto3

    s3 = boto3.client(
        "s3",
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        endpoint_url=settings.S3_ENDPOINT_URL or None,
    )
    response = s3.get_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Range=f"bytes={start}-{end}",
    )
    body = response["Body"]
    while True:
        chunk = body.read(CHUNK_SIZE)
        if not chunk:
            break
        yield chunk


def _s3_key_from_url(file_url: str) -> str | None:
    """Extract the S3 key from a full S3 URL, or None if not an S3 URL."""
    if not settings.S3_BUCKET:
        return None
    # URL shape: https://<bucket>.s3.<region>.amazonaws.com/<key>  OR  <endpoint>/<key>
    for prefix in [
        f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com/",
        (settings.S3_ENDPOINT_URL or "") + "/",
    ]:
        if prefix and file_url.startswith(prefix):
            return file_url.removeprefix(prefix)
    return None


async def stream_video(
    file_url: str,
    range_header: str | None,
) -> StreamingResponse:
    """
    Stream an MP4 from local or S3 storage.
    Handles Range requests (206) and full downloads (200).
    """
    local_path = _local_path_from_url(file_url)

    if local_path is not None:
        # ── Local file ────────────────────────────────────────────────────────
        if not local_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found")

        total = local_path.stat().st_size
        if range_header:
            start, end = _parse_range(range_header, total)
            content_length = end - start + 1
            headers = {
                "Content-Range": f"bytes {start}-{end}/{total}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": "video/mp4",
                "Cache-Control": "no-cache",
            }
            return StreamingResponse(
                _stream_local(local_path, start, end),
                status_code=206,
                headers=headers,
                media_type="video/mp4",
            )
        else:
            headers = {
                "Accept-Ranges": "bytes",
                "Content-Length": str(total),
                "Content-Type": "video/mp4",
                "Cache-Control": "no-cache",
            }
            return StreamingResponse(
                _stream_local(local_path, 0, total - 1),
                status_code=200,
                headers=headers,
                media_type="video/mp4",
            )

    # ── S3 ───────────────────────────────────────────────────────────────────
    s3_key = _s3_key_from_url(file_url)
    if s3_key is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cannot resolve video file location",
        )

    try:
        import boto3

        s3 = boto3.client(
            "s3",
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL or None,
        )
        head = s3.head_object(Bucket=settings.S3_BUCKET, Key=s3_key)
        total = head["ContentLength"]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found in storage",
        ) from exc

    if range_header:
        start, end = _parse_range(range_header, total)
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{total}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": "video/mp4",
            "Cache-Control": "no-cache",
        }
        return StreamingResponse(
            _stream_s3(s3_key, start, end),
            status_code=206,
            headers=headers,
            media_type="video/mp4",
        )
    else:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(total),
            "Content-Type": "video/mp4",
            "Cache-Control": "no-cache",
        }
        return StreamingResponse(
            _stream_s3(s3_key, 0, total - 1),
            status_code=200,
            headers=headers,
            media_type="video/mp4",
        )
