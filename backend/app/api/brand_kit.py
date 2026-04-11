from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.brand_kit import BrandKitResponse, UpdateBrandKitRequest
from app.services.brand_kit_service import get_brand_kit, update_brand_kit, upload_font, upload_logo

router = APIRouter(prefix="/api/brand-kit", tags=["brand-kit"])


@router.get("", response_model=BrandKitResponse)
async def get_brand_kit_endpoint(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await get_brand_kit(db)
    return BrandKitResponse.model_validate(kit)


@router.patch("", response_model=BrandKitResponse)
async def update_brand_kit_endpoint(
    data: UpdateBrandKitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await update_brand_kit(db, current_user, data)
    return BrandKitResponse.model_validate(kit)


@router.post("/logo", response_model=BrandKitResponse)
async def upload_logo_endpoint(
    file: UploadFile = File(...),
    variant: str = Query("primary", pattern="^(primary|secondary)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await upload_logo(db, current_user, file, variant)
    return BrandKitResponse.model_validate(kit)


@router.post("/font", response_model=BrandKitResponse)
async def upload_font_endpoint(
    file: UploadFile = File(...),
    slot: str = Query("heading", pattern="^(heading|body|accent)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await upload_font(db, current_user, file, slot)
    return BrandKitResponse.model_validate(kit)
