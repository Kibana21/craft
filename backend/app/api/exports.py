import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.export import ExportRequest, ExportResponse, ExportStatusResponse
from app.services.export_service import get_export_status, run_export, trigger_export

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"

router = APIRouter(tags=["exports"])


@router.post("/api/artifacts/{artifact_id}/export", response_model=ExportResponse, status_code=202)
async def export_artifact(
    artifact_id: uuid.UUID,
    data: ExportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExportResponse:
    export_log = await trigger_export(db, current_user, artifact_id, data.format, data.aspect_ratio)
    background_tasks.add_task(run_export, export_log.id)

    # Award gamification points
    from app.api.artifacts import _award_points_bg
    from app.models.gamification import PointsAction
    background_tasks.add_task(_award_points_bg, current_user.id, PointsAction.EXPORT)

    return ExportResponse(export_id=export_log.id, status="processing")


@router.get("/api/exports/{export_id}/status", response_model=ExportStatusResponse)
async def check_export_status(
    export_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExportStatusResponse:
    log = await get_export_status(db, export_id)
    return ExportStatusResponse(
        export_id=log.id,
        status=log.status,
        download_url=log.download_url,
        format=log.format,
        aspect_ratio=log.aspect_ratio,
        exported_at=log.exported_at,
    )


@router.get("/api/exports/{export_id}/download")
async def download_export(
    export_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    log = await get_export_status(db, export_id)

    if log.status != "ready" or not log.download_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Export is not ready (status: {log.status})",
        )

    # download_url is like /uploads/exports/filename
    rel_path = log.download_url.lstrip("/")
    file_path = UPLOAD_DIR.parent / rel_path

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file not found")

    filename = file_path.name
    media_type = "video/mp4" if filename.endswith(".mp4") else (
        "image/jpeg" if filename.endswith(".jpg") else "image/png"
    )

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
