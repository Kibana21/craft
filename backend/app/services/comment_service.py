import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.artifact import Artifact
from app.models.comment import Comment
from app.models.enums import UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User

LEADER_ROLES = {UserRole.DISTRICT_LEADER, UserRole.AGENCY_LEADER, UserRole.BRAND_ADMIN}


async def _check_artifact_access(
    db: AsyncSession, user: User, artifact_id: uuid.UUID
) -> Artifact:
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    # Check project membership
    project = (
        await db.execute(select(Project).where(Project.id == artifact.project_id))
    ).scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if user.role not in LEADER_ROLES and project.owner_id != user.id:
        member = (
            await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if member is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return artifact


async def add_comment(
    db: AsyncSession, user: User, artifact_id: uuid.UUID, text: str
) -> Comment:
    if user.role not in LEADER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only leaders (district leader, agency leader, brand admin) can add comments",
        )

    await _check_artifact_access(db, user, artifact_id)

    comment = Comment(artifact_id=artifact_id, user_id=user.id, text=text)
    db.add(comment)
    await db.flush()

    # Reload with author
    result = await db.execute(
        select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.author))
    )
    return result.scalar_one()


async def list_comments(
    db: AsyncSession, user: User, artifact_id: uuid.UUID
) -> list[Comment]:
    await _check_artifact_access(db, user, artifact_id)

    result = await db.execute(
        select(Comment)
        .where(Comment.artifact_id == artifact_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc())
    )
    return list(result.scalars().all())
