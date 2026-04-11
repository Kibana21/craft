import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.project_member import InviteMemberRequest, ProjectMemberResponse
from app.services.project_member_service import list_members, invite_member, remove_member

router = APIRouter(prefix="/api/projects/{project_id}/members", tags=["project-members"])


@router.get("", response_model=list[ProjectMemberResponse])
async def get_members(
    project_id: uuid.UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await list_members(db, project_id)


@router.post("", response_model=ProjectMemberResponse, status_code=201)
async def add_member(
    project_id: uuid.UUID,
    data: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await invite_member(db, current_user, project_id, data.user_id)


@router.delete("/{user_id}", status_code=204)
async def delete_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await remove_member(db, current_user, project_id, user_id)
