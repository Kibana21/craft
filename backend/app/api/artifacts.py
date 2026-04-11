import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.artifact import Artifact
from app.models.enums import ArtifactType, ArtifactStatus, UserRole
from app.schemas.artifact import (
    ArtifactListResponse,
    ArtifactResponse,
    ArtifactDetailResponse,
    CreateArtifactRequest,
    UpdateArtifactRequest,
)
from app.services.artifact_service import list_project_artifacts

router = APIRouter(tags=["artifacts"])


def _award_points_bg(user_id: uuid.UUID, action: object) -> None:
    """Fire-and-forget gamification points from a BackgroundTask."""
    import asyncio
    from app.core.database import async_session
    from app.services.gamification_service import award_points

    async def _run() -> None:
        async with async_session() as db:
            try:
                await award_points(db, user_id, action)  # type: ignore[arg-type]
                await db.commit()
            except Exception:
                pass

    asyncio.run(_run())


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


def _artifact_to_detail(artifact: Artifact, user: User) -> dict:
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

    # Reload with creator relationship
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact.id).options(selectinload(Artifact.creator))
    )
    artifact = result.scalar_one()

    # Trigger async compliance scoring
    from app.services.scoring_task import run_compliance_scoring
    background_tasks.add_task(run_compliance_scoring, artifact.id)

    # Award gamification points
    from app.services.gamification_service import award_points
    from app.models.gamification import PointsAction
    background_tasks.add_task(_award_points_bg, current_user.id, PointsAction.CREATE_ARTIFACT)

    return _artifact_to_detail(artifact, current_user)


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
    return _artifact_to_detail(artifact, current_user)


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

    update_data = data.model_dump(exclude_unset=True)
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

    artifact.deleted_at = datetime.now(timezone.utc).isoformat()
    await db.flush()
