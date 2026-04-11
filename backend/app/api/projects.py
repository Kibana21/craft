from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.enums import ProjectType
from app.schemas.project import ProjectListResponse
from app.services.project_service import list_user_projects

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=ProjectListResponse)
async def get_projects(
    type: ProjectType | None = Query(None, description="Filter by project type"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    items, total = await list_user_projects(
        db, current_user, project_type=type, page=page, per_page=per_page
    )
    return ProjectListResponse(items=items, total=total, page=page, per_page=per_page)
