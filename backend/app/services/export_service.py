"""Export service: validates compliance, dispatches rendering, logs export."""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artifact import Artifact
from app.models.export_log import ExportLog
from app.models.user import User
from app.schemas.export import ExportFormat, ExportAspectRatio

# Local upload directory used by upload_service
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"

MIN_COMPLIANCE_SCORE = 70.0


async def trigger_export(
    db: AsyncSession,
    user: User,
    artifact_id: uuid.UUID,
    fmt: ExportFormat,
    aspect_ratio: ExportAspectRatio | None,
) -> ExportLog:
    """Validate and create an ExportLog with status='processing'. Rendering happens in background."""
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    # Compliance gate
    if artifact.compliance_score is None or artifact.compliance_score < MIN_COMPLIANCE_SCORE:
        score = artifact.compliance_score
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Compliance score {score} is below the minimum required {MIN_COMPLIANCE_SCORE}",
        )

    # Derive default aspect ratio from artifact type
    if aspect_ratio is None:
        from app.models.enums import ArtifactType
        if artifact.type == ArtifactType.WHATSAPP_CARD:
            aspect_ratio = "800x800"
        elif artifact.type == ArtifactType.REEL:
            aspect_ratio = "9:16"
        else:
            aspect_ratio = "1:1"

    export_log = ExportLog(
        artifact_id=artifact_id,
        user_id=user.id,
        format=fmt,
        aspect_ratio=aspect_ratio,
        status="processing",
        compliance_score=artifact.compliance_score,
    )
    db.add(export_log)
    await db.flush()
    return export_log


async def get_export_status(db: AsyncSession, export_id: uuid.UUID) -> ExportLog:
    result = await db.execute(select(ExportLog).where(ExportLog.id == export_id))
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found")
    return log


async def run_export(export_id: uuid.UUID) -> None:
    """Background task: render the artifact and update export_log with result."""
    from app.core.database import async_session as AsyncSessionLocal
    from app.services.brand_kit_service import get_brand_kit
    from app.services.render_service import render_poster, render_whatsapp_card, render_reel
    from app.services.watermark_service import apply_watermark
    from app.models.enums import ArtifactType

    async with AsyncSessionLocal() as db:
        async with db.begin():
            try:
                result = await db.execute(select(ExportLog).where(ExportLog.id == export_id))
                export_log = result.scalar_one_or_none()
                if export_log is None:
                    return

                artifact_result = await db.execute(
                    select(Artifact).where(Artifact.id == export_log.artifact_id)
                )
                artifact = artifact_result.scalar_one_or_none()
                if artifact is None:
                    export_log.status = "failed"
                    return

                brand_kit = await get_brand_kit(db)

                fmt = export_log.format
                aspect_ratio = export_log.aspect_ratio or "1:1"

                # Determine watermark type based on artifact origin
                content = artifact.content or {}
                is_library_sourced = bool(content.get("library_item_id") or content.get("from_library"))
                watermark_type = "aia_official" if is_library_sourced else "crafted_with"

                # Get agent name for personal watermark
                from app.models.user import User
                user_res = await db.execute(
                    select(User).where(User.id == export_log.user_id)
                )
                export_user = user_res.scalar_one_or_none()
                user_name = export_user.name if export_user else None

                loop = asyncio.get_event_loop()
                if fmt == "mp4":
                    # Reel
                    rendered_bytes = await loop.run_in_executor(
                        None, lambda: render_reel(artifact, brand_kit)
                    )
                    ext = "mp4"
                elif artifact.type == ArtifactType.WHATSAPP_CARD:
                    rendered_bytes = await loop.run_in_executor(
                        None, lambda: render_whatsapp_card(artifact, brand_kit)
                    )
                    _wm_type = watermark_type
                    _wm_name = user_name
                    _raw = rendered_bytes
                    rendered_bytes = await loop.run_in_executor(
                        None, lambda: apply_watermark(_raw, _wm_type, _wm_name)
                    )
                    ext = "png"
                else:
                    _ar = aspect_ratio
                    _fmt = fmt
                    rendered_bytes = await loop.run_in_executor(
                        None, lambda: render_poster(artifact, brand_kit, _ar, _fmt)
                    )
                    if fmt != "mp4":
                        _wm_type = watermark_type
                        _wm_name = user_name
                        _raw2 = rendered_bytes
                        rendered_bytes = await loop.run_in_executor(
                            None, lambda: apply_watermark(_raw2, _wm_type, _wm_name)
                        )
                    ext = fmt

                # Generate filename per convention: {product}_{audience}_{type}_{format}.{ext}
                artifact_content = artifact.content or {}
                product = (artifact_content.get("product") or "Content").replace(" ", "_")
                audience = (artifact_content.get("audience") or "General").replace(" ", "_")
                art_type = artifact.type.value if artifact.type else "artifact"
                ar_slug = aspect_ratio.replace(":", "x")
                filename = f"{product}_{audience}_{art_type}_{ar_slug}.{ext}"

                # Save to local uploads/exports/
                exports_dir = UPLOAD_DIR / "exports"
                exports_dir.mkdir(parents=True, exist_ok=True)
                file_path = exports_dir / f"{export_id}_{filename}"
                file_path.write_bytes(rendered_bytes)

                download_url = f"/uploads/exports/{export_id}_{filename}"
                export_log.download_url = download_url
                export_log.status = "ready"

                # Update artifact status to exported
                artifact.status = "exported"  # type: ignore

            except Exception:
                if export_log:
                    export_log.status = "failed"
