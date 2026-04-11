import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.artifact import Artifact
from app.models.artifact_suggestion import ArtifactSuggestion
from app.models.brand_kit import BrandKit
from app.models.enums import UserRole, ProjectType, ProjectMemberRole
from app.schemas.project import CreateProjectRequest, UpdateProjectRequest


async def list_user_projects(
    db: AsyncSession,
    user: User,
    project_type: ProjectType | None = None,
    status: str | None = "active",
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    base_query = (
        select(Project)
        .where(Project.deleted_at.is_(None))
        .options(selectinload(Project.owner))
    )

    if status is not None:
        base_query = base_query.where(Project.status == status)

    if user.role == UserRole.BRAND_ADMIN:
        query = base_query
    else:
        query = base_query.where(
            (Project.owner_id == user.id)
            | Project.id.in_(
                select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
            )
        )

    if project_type is not None:
        query = query.where(Project.type == project_type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Project.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    projects = (await db.execute(query)).scalars().all()

    items = []
    for project in projects:
        artifact_count = (
            await db.execute(
                select(func.count())
                .select_from(Artifact)
                .where(Artifact.project_id == project.id, Artifact.deleted_at.is_(None))
            )
        ).scalar() or 0

        member_count = (
            await db.execute(
                select(func.count())
                .select_from(ProjectMember)
                .where(ProjectMember.project_id == project.id)
            )
        ).scalar() or 0

        suggestion_count = (
            await db.execute(
                select(func.count())
                .select_from(ArtifactSuggestion)
                .where(ArtifactSuggestion.project_id == project.id)
            )
        ).scalar() or 0

        items.append({
            "id": project.id,
            "name": project.name,
            "type": project.type,
            "purpose": project.purpose,
            "owner": {
                "id": project.owner.id,
                "name": project.owner.name,
                "avatar_url": project.owner.avatar_url,
            },
            "product": project.product,
            "target_audience": project.target_audience,
            "campaign_period": project.campaign_period,
            "key_message": project.key_message,
            "status": project.status,
            "artifact_count": artifact_count,
            "member_count": member_count,
            "suggestion_count": suggestion_count,
            "created_at": project.created_at,
        })

    return items, total


async def create_project(
    db: AsyncSession,
    user: User,
    data: CreateProjectRequest,
) -> Project:
    # FSCs cannot create team projects
    if data.type == ProjectType.TEAM and user.role == UserRole.FSC:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FSCs cannot create team projects",
        )

    # If no brand kit specified, use the latest one
    brand_kit_id = data.brand_kit_id
    if brand_kit_id is None:
        result = await db.execute(
            select(BrandKit).order_by(BrandKit.created_at.desc()).limit(1)
        )
        brand_kit = result.scalar_one_or_none()
        if brand_kit:
            brand_kit_id = brand_kit.id

    project = Project(
        name=data.name,
        type=data.type,
        purpose=data.purpose,
        owner_id=user.id,
        product=data.product,
        target_audience=data.target_audience,
        campaign_period=data.campaign_period,
        key_message=data.key_message,
        brand_kit_id=brand_kit_id,
        brief=data.brief,
        status="active",
    )
    db.add(project)
    await db.flush()

    # Add owner as member
    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role=ProjectMemberRole.OWNER,
    )
    db.add(member)
    await db.flush()

    return project


async def get_project_detail(
    db: AsyncSession,
    user: User,
    project_id: uuid.UUID,
) -> dict:
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.deleted_at.is_(None))
        .options(selectinload(Project.owner))
    )
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Access check: owner, member, or brand_admin
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

    artifact_count = (
        await db.execute(
            select(func.count()).select_from(Artifact)
            .where(Artifact.project_id == project.id, Artifact.deleted_at.is_(None))
        )
    ).scalar() or 0

    member_count = (
        await db.execute(
            select(func.count()).select_from(ProjectMember)
            .where(ProjectMember.project_id == project.id)
        )
    ).scalar() or 0

    suggestion_count = (
        await db.execute(
            select(func.count()).select_from(ArtifactSuggestion)
            .where(ArtifactSuggestion.project_id == project.id)
        )
    ).scalar() or 0

    return {
        "id": project.id,
        "name": project.name,
        "type": project.type,
        "purpose": project.purpose,
        "owner": {
            "id": project.owner.id,
            "name": project.owner.name,
            "avatar_url": project.owner.avatar_url,
        },
        "product": project.product,
        "target_audience": project.target_audience,
        "campaign_period": project.campaign_period,
        "key_message": project.key_message,
        "brief": project.brief,
        "brand_kit_id": project.brand_kit_id,
        "status": project.status,
        "artifact_count": artifact_count,
        "member_count": member_count,
        "suggestion_count": suggestion_count,
        "created_at": project.created_at,
    }


async def update_project(
    db: AsyncSession,
    user: User,
    project_id: uuid.UUID,
    data: UpdateProjectRequest,
) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if user.role != UserRole.BRAND_ADMIN and project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.flush()
    return project


async def set_project_status(
    db: AsyncSession,
    user: User,
    project_id: uuid.UUID,
    new_status: str,
) -> None:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if user.role != UserRole.BRAND_ADMIN and project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    project.status = new_status
    await db.flush()


async def delete_project(
    db: AsyncSession,
    user: User,
    project_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if user.role != UserRole.BRAND_ADMIN and project.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    now = datetime.now(timezone.utc).isoformat()

    # Cascade soft-delete all artifacts in this project
    artifacts = (await db.execute(
        select(Artifact).where(Artifact.project_id == project_id, Artifact.deleted_at.is_(None))
    )).scalars().all()
    for artifact in artifacts:
        artifact.deleted_at = now

    # Hard-delete suggestions (no soft-delete on that model)
    suggestions = (await db.execute(
        select(ArtifactSuggestion).where(ArtifactSuggestion.project_id == project_id)
    )).scalars().all()
    for suggestion in suggestions:
        await db.delete(suggestion)

    # Hard-delete project members
    members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )).scalars().all()
    for member in members:
        await db.delete(member)

    project.deleted_at = now
    await db.flush()
