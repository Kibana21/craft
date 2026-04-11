import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.brand_library import (
    BrandLibraryListResponse,
    BrandLibraryDetailResponse,
    BrandLibraryItemResponse,
    PublishToLibraryRequest,
    ReviewLibraryItemRequest,
    RemixResponse,
)
from app.services.brand_library_service import (
    list_library_items,
    get_library_item_detail,
    publish_to_library,
    review_library_item,
    remix_library_item,
)

router = APIRouter(prefix="/api/brand-library", tags=["brand-library"])


@router.get("", response_model=BrandLibraryListResponse)
async def get_library_items(
    search: str | None = Query(None),
    product: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandLibraryListResponse:
    items, total = await list_library_items(
        db, current_user, search=search, product=product, page=page, per_page=per_page
    )
    return BrandLibraryListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{item_id}", response_model=BrandLibraryDetailResponse)
async def get_library_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_library_item_detail(db, item_id, current_user)


@router.post("", response_model=BrandLibraryItemResponse, status_code=201)
async def publish_artifact(
    data: PublishToLibraryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    item = await publish_to_library(db, current_user, data.artifact_id)
    # Re-fetch with relationships for response
    return await get_library_item_detail(db, item.id, current_user)


@router.patch("/{item_id}", response_model=BrandLibraryDetailResponse)
async def review_item(
    item_id: uuid.UUID,
    data: ReviewLibraryItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await review_library_item(db, current_user, item_id, data.action, data.reason)
    return await get_library_item_detail(db, item_id, current_user)


@router.post("/{item_id}/remix", response_model=RemixResponse, status_code=201)
async def remix_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RemixResponse:
    project_id, artifact_id = await remix_library_item(db, current_user, item_id)
    return RemixResponse(project_id=project_id, artifact_id=artifact_id)
