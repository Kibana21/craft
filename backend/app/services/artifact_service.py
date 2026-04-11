import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.artifact import Artifact
from app.models.enums import UserRole, ArtifactType


async def list_project_artifacts(
    db: AsyncSession,
    user: User,
    project_id: uuid.UUID,
    creator_id: uuid.UUID | None = None,
    artifact_type: ArtifactType | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    # Verify access to project
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

    query = (
        select(Artifact)
        .where(Artifact.project_id == project_id, Artifact.deleted_at.is_(None))
        .options(selectinload(Artifact.creator))
    )

    if creator_id:
        query = query.where(Artifact.creator_id == creator_id)
    if artifact_type:
        query = query.where(Artifact.type == artifact_type)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    query = query.order_by(Artifact.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    artifacts = (await db.execute(query)).scalars().all()

    items = [
        {
            "id": a.id,
            "project_id": a.project_id,
            "creator": {
                "id": a.creator.id,
                "name": a.creator.name,
                "avatar_url": a.creator.avatar_url,
            },
            "type": a.type,
            "name": a.name,
            "channel": a.channel,
            "format": a.format,
            "thumbnail_url": a.thumbnail_url,
            "compliance_score": a.compliance_score,
            "status": a.status,
            "version": a.version,
            "created_at": a.created_at,
        }
        for a in artifacts
    ]

    return items, total
