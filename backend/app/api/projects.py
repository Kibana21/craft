import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.enums import ProjectType
from app.schemas.project import (
    ProjectListResponse,
    ProjectDetailResponse,
    ProjectResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
)
from app.services.project_service import (
    list_user_projects,
    create_project,
    get_project_detail,
    update_project,
    delete_project,
)
from app.services.suggestion_service import generate_suggestions

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=ProjectListResponse)
async def get_projects(
    type: ProjectType | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    items, total = await list_user_projects(db, current_user, project_type=type, page=page, per_page=per_page)
    return ProjectListResponse(items=items, total=total, page=page, per_page=per_page)


@router.post("", response_model=ProjectDetailResponse, status_code=201)
async def create_new_project(
    data: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    project = await create_project(db, current_user, data)
    # Generate CRAFT suggestions for the project
    await generate_suggestions(db, project)
    return await get_project_detail(db, current_user, project.id)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_project_detail(db, current_user, project_id)


@router.patch("/{project_id}", response_model=ProjectDetailResponse)
async def update_existing_project(
    project_id: uuid.UUID,
    data: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await update_project(db, current_user, project_id, data)
    return await get_project_detail(db, current_user, project_id)


@router.delete("/{project_id}", status_code=204)
async def delete_existing_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_project(db, current_user, project_id)
