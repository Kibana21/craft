"""My Studio API surface (Phase A — library CRUD).

Routes:
- POST   /api/studio/images                 (multipart, 1-20 files)
- GET    /api/studio/images                 (?type=&q=&page=&per_page=)
- GET    /api/studio/images/{image_id}      (detail view, nested source+run)
- PATCH  /api/studio/images/{image_id}      (rename / retag)
- DELETE /api/studio/images/{image_id}      (soft delete)

All routes enforce per-user ownership (no BRAND_ADMIN bypass — PRD §1.1).

Generation endpoints (/workflows/*) land in Phase B and will be added to this
same router.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from app.core.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.studio import (
    DiscardOutputsResponse,
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
    PromptBuilderRequest,
    PromptBuilderResponse,
    RenameImageRequest,
    RetrySlotRequest,
    RetrySlotResponse,
    StudioImageDetailResponse,
    StudioImageListResponse,
    StudioImageResponse,
    WorkflowRunStatusResponse,
    WorkflowRunSummary,
    validate_style_inputs,
)
from app.services import studio_generation_service, studio_image_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["studio"])

MAX_UPLOAD_FILES = 20  # PRD §7.2


@router.post("/api/studio/images", status_code=status.HTTP_201_CREATED)
async def upload_images(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StudioImageResponse]:
    """Upload 1–20 images to the user's library.

    Each file is validated (MIME + size), uploaded, thumbnailed, and inserted
    as a PHOTO row. Returns the created rows. Per-file failures raise — we
    don't do partial-success uploads for v1.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files — max {MAX_UPLOAD_FILES} per request.",
        )

    created: list[StudioImageResponse] = []
    for upload in files:
        row = await studio_image_service.create_from_upload(
            db, user_id=current_user.id, upload=upload
        )
        created.append(StudioImageResponse.model_validate(row))

    await db.commit()
    return created


@router.get("/api/studio/images", response_model=StudioImageListResponse)
async def list_images(
    type: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=24, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudioImageListResponse:
    rows, total = await studio_image_service.list_for_user(
        db,
        user_id=current_user.id,
        image_type=type,
        q=q,
        page=page,
        per_page=per_page,
    )
    return StudioImageListResponse(
        items=[StudioImageResponse.model_validate(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/api/studio/images/{image_id}",
    response_model=StudioImageDetailResponse,
)
async def get_image(
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudioImageDetailResponse:
    row = await studio_image_service.get_owned(
        db, image_id=image_id, user_id=current_user.id
    )

    # Lazy-load the source image (if this is an AI output).
    source = None
    if row.source_image_id is not None:
        source = await studio_image_service.get_owned(
            db, image_id=row.source_image_id, user_id=current_user.id
        )

    # Workflow-run nesting lands in Phase B.
    return studio_image_service.to_detail_response(row, source=source, run_summary=None)


@router.patch(
    "/api/studio/images/{image_id}",
    response_model=StudioImageResponse,
)
async def rename_image(
    image_id: uuid.UUID,
    data: RenameImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudioImageResponse:
    row = await studio_image_service.rename(
        db,
        image_id=image_id,
        user_id=current_user.id,
        name=data.name,
        tags=data.tags,
    )
    await db.commit()
    return StudioImageResponse.model_validate(row)


@router.delete("/api/studio/images/{image_id}", status_code=204, response_model=None)
async def delete_image(
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await studio_image_service.soft_delete(
        db, image_id=image_id, user_id=current_user.id
    )
    await db.commit()


# ── Workflow endpoints (Phase B) ──────────────────────────────────────────────


@router.post(
    "/api/studio/workflows/prompt-builder",
    response_model=PromptBuilderResponse,
)
async def prompt_builder(
    data: PromptBuilderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PromptBuilderResponse:
    """Construct the AI-enriched generation prompt from the user's intent +
    style inputs. Deterministic skeleton + one Gemini-flash JSON call.
    """
    from pydantic import ValidationError

    from app.services.studio_prompt_service import (
        analyze_source_subject,
        build_prompt,
    )

    # Per-intent validation of the style_inputs dict.
    try:
        style = validate_style_inputs(data.intent, data.style_inputs)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Optional subject analysis for Image→Image flows. Best-effort — an empty
    # string means the skeleton falls back to its generic "Subject:" line.
    subject_description: str | None = None
    if data.source_image_id is not None:
        src = await studio_image_service.get_owned(
            db, image_id=data.source_image_id, user_id=current_user.id
        )
        try:
            from app.services.studio_generation_worker import _fetch_image_bytes

            src_bytes = await _fetch_image_bytes(src.storage_url)
            subject_description = await analyze_source_subject(
                src_bytes, mime_type=src.mime_type
            )
        except Exception:  # noqa: BLE001 — subject analysis is best-effort
            subject_description = None

    merged_prompt, enrichments = await build_prompt(
        style=style,
        subject_description=subject_description or None,
        variation_count=data.variation_count,
    )
    return PromptBuilderResponse(merged_prompt=merged_prompt, ai_enrichments=enrichments)


@router.post(
    "/api/studio/workflows/generate",
    response_model=GenerateWorkflowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("10/minute")
async def generate_workflow(
    request: Request,  # noqa: ARG001 — required by slowapi for rate-limit keying
    data: GenerateWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateWorkflowResponse:
    """Dispatch a new enhancement run. Returns 202 immediately with a run_id;
    the client polls `/workflows/{run_id}/status` for completion."""
    run = await studio_generation_service.enqueue_run(
        db, user_id=current_user.id, request=data
    )
    await db.commit()
    return GenerateWorkflowResponse(run_id=run.id, status=run.status)  # type: ignore[arg-type]


@router.get(
    "/api/studio/workflows/{run_id}/status",
    response_model=WorkflowRunStatusResponse,
)
async def workflow_status(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowRunStatusResponse:
    return await studio_generation_service.fetch_status(
        db, run_id=run_id, user_id=current_user.id
    )


@router.post(
    "/api/studio/workflows/{run_id}/retry-slot",
    response_model=RetrySlotResponse,
)
async def workflow_retry_slot(
    run_id: uuid.UUID,
    data: RetrySlotRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RetrySlotResponse:
    new_row = await studio_generation_service.retry_slot(
        db,
        run_id=run_id,
        user_id=current_user.id,
        source_image_id=data.source_image_id,
        slot=data.slot,
    )
    await db.commit()
    return RetrySlotResponse(output=StudioImageResponse.model_validate(new_row))


@router.get(
    "/api/studio/workflows/recent",
    response_model=list[WorkflowRunSummary],
)
async def workflow_recent(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowRunSummary]:
    return await studio_generation_service.list_recent_runs(
        db, user_id=current_user.id, limit=10
    )


@router.post(
    "/api/studio/workflows/{run_id}/discard-outputs",
    response_model=DiscardOutputsResponse,
)
async def workflow_discard_outputs(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiscardOutputsResponse:
    """Soft-delete every output image produced by this run.

    Used by the Generate screen when the user clicks "Discard" instead of
    "Save to library" — the outputs are already in the library (writes happen
    incrementally), so this reverses those writes in one call.
    """
    count = await studio_generation_service.discard_outputs(
        db, run_id=run_id, user_id=current_user.id
    )
    await db.commit()
    return DiscardOutputsResponse(discarded_count=count)
