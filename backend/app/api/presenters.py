import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.presenter import (
    GenerateAppearanceRequest,
    GenerateAppearanceResponse,
    PresenterCreate,
    PresenterResponse,
    PresenterUpdate,
    SuggestKeywordsRequest,
    SuggestKeywordsResponse,
)
from app.services import presenter_service
from app.services.ai_service import generate_presenter_appearance, suggest_appearance_keywords

router = APIRouter(tags=["presenters"])


@router.get("/api/presenters", response_model=list[PresenterResponse])
async def list_presenters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    return await presenter_service.list_for_user(db, current_user)


@router.post(
    "/api/presenters",
    response_model=PresenterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_presenter(
    data: PresenterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    presenter = await presenter_service.create(db, current_user, data)
    await db.commit()
    await db.refresh(presenter)
    return presenter


@router.get("/api/presenters/{presenter_id}", response_model=PresenterResponse)
async def get_presenter(
    presenter_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    return await presenter_service.get_by_id(db, presenter_id, current_user)


@router.patch("/api/presenters/{presenter_id}", response_model=PresenterResponse)
async def update_presenter(
    presenter_id: uuid.UUID,
    data: PresenterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    presenter = await presenter_service.update(db, presenter_id, current_user, data)
    await db.commit()
    await db.refresh(presenter)
    return presenter


@router.delete("/api/presenters/{presenter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_presenter(
    presenter_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await presenter_service.soft_delete(db, presenter_id, current_user)
    await db.commit()


@router.post(
    "/api/presenters/suggest-keywords",
    response_model=SuggestKeywordsResponse,
)
async def suggest_keywords(
    data: SuggestKeywordsRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        keywords = await suggest_appearance_keywords(
            data.name,
            data.age_range,
            data.speaking_style.value,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI keyword suggestion failed. Please try again.",
        )
    return {"appearance_keywords": keywords}


@router.post(
    "/api/presenters/generate-appearance",
    response_model=GenerateAppearanceResponse,
)
async def generate_appearance(
    data: GenerateAppearanceRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        description = await generate_presenter_appearance(
            data.appearance_keywords,
            data.speaking_style.value,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI appearance generation failed. Please try again.",
        )
    return {"full_appearance_description": description}
