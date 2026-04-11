import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.enums import UserRole
from app.schemas.suggestion import ArtifactSuggestionResponse, ToggleSuggestionRequest
from app.services.suggestion_service import (
    generate_suggestions,
    list_suggestions,
    toggle_suggestion,
)

router = APIRouter(prefix="/api/projects/{project_id}/suggestions", tags=["suggestions"])


@router.get("", response_model=list[ArtifactSuggestionResponse])
async def get_suggestions(
    project_id: uuid.UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ArtifactSuggestionResponse]:
    suggestions = await list_suggestions(db, project_id)
    return [ArtifactSuggestionResponse.model_validate(s) for s in suggestions]


@router.post("/generate", response_model=list[ArtifactSuggestionResponse], status_code=201)
async def regenerate_suggestions(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ArtifactSuggestionResponse]:
    project = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if current_user.role != UserRole.BRAND_ADMIN and project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    suggestions = await generate_suggestions(db, project)
    return [ArtifactSuggestionResponse.model_validate(s) for s in suggestions]


@router.patch("/{suggestion_id}", response_model=ArtifactSuggestionResponse)
async def update_suggestion(
    project_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    data: ToggleSuggestionRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ArtifactSuggestionResponse:
    suggestion = await toggle_suggestion(db, suggestion_id, data.selected)
    return ArtifactSuggestionResponse.model_validate(suggestion)
