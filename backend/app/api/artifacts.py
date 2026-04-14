import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.artifact import Artifact
from app.models.enums import ArtifactStatus, ArtifactType, UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.schemas.artifact import (
    ArtifactDetailResponse,
    ArtifactListResponse,
    CreateArtifactRequest,
    UpdateArtifactRequest,
)
from app.schemas.poster import (
    PosterContent,
    RestoreTurnRequest,
    RestoreTurnResponse,
    SaveAsVariantRequest,
    SaveAsVariantResponse,
    Variant,
    VariantTurnItem,
    VariantTurnsResponse,
)
from app.services.artifact_service import list_project_artifacts

router = APIRouter(tags=["artifacts"])


def _validate_poster_content(content: dict) -> None:
    """Validate artifact content against the PosterContent schema.

    Raises HTTPException 422 if the content does not match the expected shape.
    Called at the API boundary whenever a POSTER artifact's content is written.
    """
    from pydantic import ValidationError
    try:
        PosterContent.model_validate(content)
    except ValidationError as exc:
        raise HTTPException(  # noqa: B904
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "POSTER_CONTENT_INVALID",
                "message": "Poster content does not match the expected schema.",
                "errors": exc.errors(include_url=False),
            },
        )


async def _award_points_bg(user_id: uuid.UUID, action: object) -> None:
    """Fire-and-forget gamification points from a BackgroundTask.

    Async so FastAPI awaits it in the main event loop — avoids the
    'Future attached to a different loop' asyncpg error that occurs
    when asyncio.run() is called from a thread-pool background task.
    """
    from app.core.database import async_session
    from app.services.gamification_service import award_points

    async with async_session() as db:
        try:
            await award_points(db, user_id, action)  # type: ignore[arg-type]
            await db.commit()
        except Exception as exc:  # noqa: BLE001 — gamification must never
            # Don't crash the request that triggered this background task —
            # but DO log the failure so we know when points stop being awarded.
            # Previously we swallowed silently and only noticed via user reports.
            import logging
            logging.getLogger(__name__).warning(
                "background points award failed for user=%s action=%s: %s",
                user_id, action, exc, exc_info=True,
            )


async def _check_project_access(
    db: AsyncSession, user: User, project_id: uuid.UUID
) -> Project:
    project = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if user.role != UserRole.BRAND_ADMIN and project.owner_id != user.id:
        is_member = (
            await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if is_member is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _artifact_to_detail(
    artifact: Artifact,
    user: User,
    video_session_id: uuid.UUID | None = None,
) -> dict:
    content = artifact.content or {}
    locks = content.get("locks", []) if isinstance(content, dict) else []
    return {
        "id": artifact.id,
        "project_id": artifact.project_id,
        "creator": {
            "id": artifact.creator.id,
            "name": artifact.creator.name,
            "avatar_url": artifact.creator.avatar_url,
        },
        "type": artifact.type,
        "name": artifact.name,
        "content": content,
        "locks": locks,
        "channel": artifact.channel,
        "format": artifact.format,
        "thumbnail_url": artifact.thumbnail_url,
        "compliance_score": artifact.compliance_score,
        "status": artifact.status,
        "version": artifact.version,
        "created_at": artifact.created_at,
        "video_session_id": video_session_id,
    }


@router.get("/api/projects/{project_id}/artifacts", response_model=ArtifactListResponse)
async def get_project_artifacts(
    project_id: uuid.UUID,
    creator_id: uuid.UUID | None = Query(None),
    type: ArtifactType | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ArtifactListResponse:
    items, total = await list_project_artifacts(
        db, current_user, project_id,
        creator_id=creator_id, artifact_type=type,
        page=page, per_page=per_page,
    )
    return ArtifactListResponse(items=items, total=total, page=page, per_page=per_page)


@router.post("/api/projects/{project_id}/artifacts", response_model=ArtifactDetailResponse, status_code=201)
async def create_artifact(
    project_id: uuid.UUID,
    data: CreateArtifactRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _check_project_access(db, current_user, project_id)

    # Validate poster content at the API boundary
    if data.type == ArtifactType.POSTER and data.content:
        _validate_poster_content(data.content)

    artifact = Artifact(
        project_id=project_id,
        creator_id=current_user.id,
        type=data.type,
        name=data.name,
        content=data.content,
        channel=data.channel,
        format=data.format,
        status=ArtifactStatus.DRAFT,
    )
    db.add(artifact)
    await db.flush()

    # Auto-create a VideoSession for VIDEO and REEL artifacts (same transaction)
    video_session_id: uuid.UUID | None = None
    if data.type in (ArtifactType.VIDEO, ArtifactType.REEL):
        from app.services.video_session_service import create_for_artifact
        duration = data.target_duration_seconds or 60
        video_session = await create_for_artifact(db, artifact.id, duration)
        video_session_id = video_session.id

    # Reload with creator relationship
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact.id).options(selectinload(Artifact.creator))
    )
    artifact = result.scalar_one()

    # Trigger async compliance scoring
    from app.services.scoring_task import run_compliance_scoring
    background_tasks.add_task(run_compliance_scoring, artifact.id)

    # Award gamification points
    from app.models.gamification import PointsAction
    background_tasks.add_task(_award_points_bg, current_user.id, PointsAction.CREATE_ARTIFACT)

    return _artifact_to_detail(artifact, current_user, video_session_id=video_session_id)


@router.get("/api/artifacts/{artifact_id}", response_model=ArtifactDetailResponse)
async def get_artifact_detail(
    artifact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .options(selectinload(Artifact.creator))
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    # Verify project access
    await _check_project_access(db, current_user, artifact.project_id)

    # Include video_session_id for VIDEO/REEL artifacts; lazy-create if missing (legacy artifacts)
    from app.models.video_session import VideoSession
    vs_result = await db.execute(
        select(VideoSession.id).where(VideoSession.artifact_id == artifact_id)
    )
    video_session_id = vs_result.scalar_one_or_none()

    if video_session_id is None and artifact.type in (ArtifactType.VIDEO, ArtifactType.REEL):
        from sqlalchemy.exc import IntegrityError

        from app.services.video_session_service import create_for_artifact
        try:
            video_session = await create_for_artifact(db, artifact.id)
            await db.commit()
            video_session_id = video_session.id
        except IntegrityError:
            # Concurrent request already created the session (e.g. React StrictMode double-invoke)
            await db.rollback()
            vs_retry = await db.execute(
                select(VideoSession.id).where(VideoSession.artifact_id == artifact_id)
            )
            video_session_id = vs_retry.scalar_one_or_none()

    return _artifact_to_detail(artifact, current_user, video_session_id=video_session_id)


@router.patch("/api/artifacts/{artifact_id}", response_model=ArtifactDetailResponse)
async def update_artifact(
    artifact_id: uuid.UUID,
    data: UpdateArtifactRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .options(selectinload(Artifact.creator))
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    if current_user.role != UserRole.BRAND_ADMIN and artifact.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Validate poster content at the API boundary
    if artifact.type == ArtifactType.POSTER and data.content is not None:
        _validate_poster_content(data.content)

    update_data = data.model_dump(exclude_unset=True)

    # Poster content is sectioned (brief/subject/copy/composition/generation). Wizard steps
    # send the full content object each time, so a plain replace would wipe later-section data
    # if that section still holds in-memory defaults from a step the user hasn't visited yet.
    # Shallow-merge at the top level so unsent/empty sections can't clobber persisted ones.
    if (
        artifact.type == ArtifactType.POSTER
        and "content" in update_data
        and isinstance(update_data["content"], dict)
    ):
        existing = artifact.content if isinstance(artifact.content, dict) else {}
        update_data["content"] = {**existing, **update_data["content"]}

    for key, value in update_data.items():
        setattr(artifact, key, value)

    await db.flush()

    # Re-trigger compliance scoring
    from app.services.scoring_task import run_compliance_scoring
    background_tasks.add_task(run_compliance_scoring, artifact.id)

    return _artifact_to_detail(artifact, current_user)


@router.delete("/api/artifacts/{artifact_id}", status_code=204)
async def delete_artifact(
    artifact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    if current_user.role != UserRole.BRAND_ADMIN and artifact.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # `artifacts.deleted_at` is VARCHAR in this schema (legacy decision —
    # other models use TIMESTAMPTZ). Send an ISO-8601 string to match.
    # Fixing the column type would need a migration; tracked under reliability
    # plan as a future schema-cleanup item.
    artifact.deleted_at = datetime.now(timezone.utc).isoformat()
    await db.flush()
    await db.commit()


@router.post(
    "/api/artifacts/{artifact_id}/save-as-variant",
    response_model=SaveAsVariantResponse,
    summary="Snapshot current selected variant (Phase D)",
)
async def save_as_variant(
    artifact_id: uuid.UUID,
    data: SaveAsVariantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaveAsVariantResponse:
    """Clone the selected variant into a new entry so the user can branch their
    refinement history. Resets `turn_count_on_selected` to 0 and sets
    `parent_variant_id` for lineage (doc 07 §Save as Variant).
    """
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if current_user.role != UserRole.BRAND_ADMIN and artifact.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if artifact.type != ArtifactType.POSTER:
        raise HTTPException(status_code=400, detail="save-as-variant is poster-only")

    source_variant_id = str(data.variant_id)
    content = dict(artifact.content or {})
    generation = dict(content.get("generation") or {})
    variants = list(generation.get("variants") or [])

    source = next((v for v in variants if v.get("id") == source_variant_id), None)
    if source is None:
        raise HTTPException(status_code=404, detail="Variant not found on this artifact")

    new_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Deselect every existing variant; the newly-cloned one becomes current.
    for v in variants:
        v["selected"] = False

    import copy as _copy
    cloned = {
        "id": str(new_id),
        "image_url": source.get("image_url"),
        "generated_at": now_iso,
        "status": source.get("status") or "READY",
        "selected": True,
        "parent_variant_id": source_variant_id,
        # Snapshot the change log onto the new variant so the pill strip is
        # preserved as the starting state of this branch.
        "change_log": _copy.deepcopy(source.get("change_log") or []),
    }
    variants.append(cloned)
    generation["variants"] = variants
    generation["turn_count_on_selected"] = 0
    content["generation"] = generation
    artifact.content = content

    await db.flush()
    await db.commit()

    # Slot index mirrors the variants array position (matches how the generation
    # worker seeds slot in poster_image_service).
    new_slot = len(variants) - 1
    return SaveAsVariantResponse(
        new_variant=Variant(
            id=new_id,
            slot=new_slot,
            status="READY",
            image_url=source.get("image_url"),
            error_code=None,
            retry_token=None,
        ),
    )


# ── Phase D — Variant refinement history ──────────────────────────────────────


@router.get(
    "/api/artifacts/{artifact_id}/variants/{variant_id}/turns",
    response_model=VariantTurnsResponse,
    summary="List refinement turns for a variant (Phase D)",
)
async def list_variant_turns(
    artifact_id: uuid.UUID,
    variant_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VariantTurnsResponse:
    """Return every image-producing turn for this variant in chronological order.

    REDIRECT turns are omitted — they have no resulting image and exist only
    for audit. The caller gets a pure "version history" suitable for a
    thumbnail strip or dialog.
    """
    from app.models.poster import PosterChatTurn

    # Ownership check (also validates artifact exists).
    artifact = await _load_owned_artifact(db, artifact_id, current_user)
    if artifact.type != ArtifactType.POSTER:
        raise HTTPException(status_code=400, detail="Turns are poster-only")

    result = await db.execute(
        select(PosterChatTurn)
        .where(
            PosterChatTurn.artifact_id == artifact_id,
            PosterChatTurn.variant_id == variant_id,
            PosterChatTurn.deleted_at.is_(None),
            PosterChatTurn.action_type != "REDIRECT",
            PosterChatTurn.resulting_image_url.is_not(None),
        )
        .order_by(PosterChatTurn.turn_index.asc(), PosterChatTurn.created_at.asc())
    )
    rows = result.scalars().all()
    items = [
        VariantTurnItem(
            turn_id=row.id,
            turn_index=row.turn_index,
            action_type=row.action_type,  # type: ignore[arg-type]
            user_message=row.user_message,
            ai_response=row.ai_response,
            resulting_image_url=row.resulting_image_url,  # type: ignore[arg-type]
            created_at=row.created_at,
        )
        for row in rows
    ]
    return VariantTurnsResponse(turns=items)


@router.post(
    "/api/artifacts/{artifact_id}/variants/{variant_id}/restore-turn",
    response_model=RestoreTurnResponse,
    summary="Restore a variant's image to a previous turn (Phase D)",
)
async def restore_variant_turn(
    artifact_id: uuid.UUID,
    variant_id: uuid.UUID,
    data: RestoreTurnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RestoreTurnResponse:
    """Swap the variant's current image URL back to that of an earlier turn.

    Leaves the turn counter and change log untouched on purpose: restoring is
    a view swap, not a cheat for the 6-turn cap. If the user wants to branch
    from the restored state, they can Save-as-variant (which resets the cap).
    """
    from app.models.poster import PosterChatTurn

    artifact = await _load_owned_artifact(db, artifact_id, current_user, lock=True)
    if artifact.type != ArtifactType.POSTER:
        raise HTTPException(status_code=400, detail="Turns are poster-only")

    turn = (
        await db.execute(
            select(PosterChatTurn).where(
                PosterChatTurn.id == data.turn_id,
                PosterChatTurn.artifact_id == artifact_id,
                PosterChatTurn.variant_id == variant_id,
                PosterChatTurn.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if turn is None or not turn.resulting_image_url:
        raise HTTPException(status_code=404, detail="Turn not found or has no image")

    variant_id_str = str(variant_id)
    content = dict(artifact.content or {})
    generation = dict(content.get("generation") or {})
    variants = list(generation.get("variants") or [])
    idx = next((i for i, v in enumerate(variants) if v.get("id") == variant_id_str), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Variant not found on this artifact")

    variant = dict(variants[idx])
    variant["image_url"] = turn.resulting_image_url
    variant["generated_at"] = datetime.now(timezone.utc).isoformat()
    variants[idx] = variant
    generation["variants"] = variants
    content["generation"] = generation
    artifact.content = content

    await db.flush()
    await db.commit()

    return RestoreTurnResponse(image_url=turn.resulting_image_url)


async def _load_owned_artifact(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    current_user: User,
    *,
    lock: bool = False,
) -> Artifact:
    """Fetch an artifact (optionally `SELECT … FOR UPDATE`) and enforce
    creator/BRAND_ADMIN ownership. 404 if missing, 403 if unauthorised.
    """
    stmt = select(Artifact).where(
        Artifact.id == artifact_id, Artifact.deleted_at.is_(None)
    )
    if lock:
        stmt = stmt.with_for_update()
    artifact = (await db.execute(stmt)).scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if current_user.role != UserRole.BRAND_ADMIN and artifact.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return artifact
