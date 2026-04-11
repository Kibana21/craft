from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.brand_library import BrandLibraryListResponse
from app.services.brand_library_service import list_library_items

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
