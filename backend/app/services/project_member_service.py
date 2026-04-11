import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.enums import UserRole, ProjectType, ProjectMemberRole


async def list_members(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> list[dict]:
    result = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at)
    )
    rows = result.all()

    return [
        {
            "id": member.id,
            "user_id": user.id,
            "user_name": user.name,
            "user_email": user.email,
            "user_role": user.role,
            "user_avatar_url": user.avatar_url,
            "role": member.role,
            "joined_at": member.joined_at,
        }
        for member, user in rows
    ]


async def invite_member(
    db: AsyncSession,
    inviter: User,
    project_id: uuid.UUID,
    target_user_id: uuid.UUID,
) -> dict:
    # Check project exists and is team type
    project = (
        await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if project.type != ProjectType.TEAM:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only invite members to team projects",
        )

    # Check inviter is owner or brand_admin
    if inviter.role != UserRole.BRAND_ADMIN and project.owner_id != inviter.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to invite")

    # Check target user exists
    target_user = (
        await db.execute(select(User).where(User.id == target_user_id))
    ).scalar_one_or_none()

    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Check not already a member
    existing = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == target_user_id,
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")

    member = ProjectMember(
        project_id=project_id,
        user_id=target_user_id,
        role=ProjectMemberRole.MEMBER,
    )
    db.add(member)
    await db.flush()

    return {
        "id": member.id,
        "user_id": target_user.id,
        "user_name": target_user.name,
        "user_email": target_user.email,
        "user_role": target_user.role,
        "user_avatar_url": target_user.avatar_url,
        "role": member.role,
        "joined_at": member.joined_at,
    }


async def remove_member(
    db: AsyncSession,
    remover: User,
    project_id: uuid.UUID,
    target_user_id: uuid.UUID,
) -> None:
    project = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if remover.role != UserRole.BRAND_ADMIN and project.owner_id != remover.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    member = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == target_user_id,
            )
        )
    ).scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role == ProjectMemberRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the project owner",
        )

    await db.delete(member)
    await db.flush()
