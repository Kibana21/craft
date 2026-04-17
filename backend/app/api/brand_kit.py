import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rbac import require_brand_admin
from app.models.user import User
from app.schemas.brand_kit import (
    ActivatedByInfo,
    BrandKitResponse,
    BrandKitTemplateResponse,
    BrandKitVersionSummary,
    CreateTemplateRequest,
    UpdateBrandKitRequest,
    UpdateTemplateRequest,
)
from app.services.brand_kit_service import (
    get_brand_kit,
    list_versions,
    restore_version,
    update_brand_kit,
    upload_font,
    upload_logo,
)
from app.services.brand_kit_template_service import (
    create_template,
    delete_template,
    list_templates,
    update_template,
)

router = APIRouter(prefix="/api/brand-kit", tags=["brand-kit"])


async def _enrich_response(db: AsyncSession, kit) -> BrandKitResponse:
    """Build BrandKitResponse with activated_by user name joined."""
    # Refresh so server-default columns (activated_at, updated_at) are loaded
    # after flush — async SQLAlchemy cannot lazy-load them outside a greenlet.
    await db.refresh(kit)

    activated_by_info = None
    if kit.activated_by:
        result = await db.execute(select(User).where(User.id == kit.activated_by))
        ab_user = result.scalar_one_or_none()
        if ab_user:
            activated_by_info = ActivatedByInfo(id=ab_user.id, name=ab_user.name)

    return BrandKitResponse(
        id=kit.id,
        name=kit.name,
        logo_url=kit.logo_url,
        secondary_logo_url=kit.secondary_logo_url,
        primary_color=kit.primary_color,
        secondary_color=kit.secondary_color,
        accent_color=kit.accent_color,
        fonts=kit.fonts,
        version=kit.version,
        updated_by=kit.updated_by,
        updated_at=kit.updated_at,
        is_active=kit.is_active,
        changelog=kit.changelog,
        activated_by_info=activated_by_info,
        activated_at=kit.activated_at,
        color_names=kit.color_names,
        zone_roles=kit.zone_roles,
    )


@router.get("", response_model=BrandKitResponse)
async def get_brand_kit_endpoint(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await get_brand_kit(db)
    return await _enrich_response(db, kit)


@router.patch("", response_model=BrandKitResponse)
async def update_brand_kit_endpoint(
    data: UpdateBrandKitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await update_brand_kit(db, current_user, data)
    return await _enrich_response(db, kit)


@router.post("/logo", response_model=BrandKitResponse)
async def upload_logo_endpoint(
    file: UploadFile = File(...),
    variant: str = Query("primary", pattern="^(primary|secondary)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await upload_logo(db, current_user, file, variant)
    return await _enrich_response(db, kit)


@router.post("/font", response_model=BrandKitResponse)
async def upload_font_endpoint(
    file: UploadFile = File(...),
    slot: str = Query("heading", pattern="^(heading|body|disclaimer|accent)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandKitResponse:
    kit = await upload_font(db, current_user, file, slot)
    return await _enrich_response(db, kit)


@router.get("/versions")
async def list_brand_kit_versions(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_brand_admin),
) -> list[dict]:
    return await list_versions(db)


@router.post("/versions/{version_id}/restore", response_model=BrandKitResponse)
async def restore_brand_kit_version(
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
) -> BrandKitResponse:
    kit = await restore_version(db, current_user, version_id)
    await db.commit()
    return await _enrich_response(db, kit)


# ── Templates ─────────────────────────────────────────────────────────────────


@router.get("/templates", response_model=list[BrandKitTemplateResponse])
async def list_templates_endpoint(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[BrandKitTemplateResponse]:
    return await list_templates(db)


@router.post("/templates", response_model=BrandKitTemplateResponse, status_code=201)
async def create_template_endpoint(
    data: CreateTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
) -> BrandKitTemplateResponse:
    template = await create_template(db, current_user, data)
    await db.commit()
    return template


@router.patch("/templates/{template_id}", response_model=BrandKitTemplateResponse)
async def update_template_endpoint(
    template_id: uuid.UUID,
    data: UpdateTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
) -> BrandKitTemplateResponse:
    template = await update_template(db, current_user, template_id, data)
    await db.commit()
    return template


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template_endpoint(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
) -> None:
    await delete_template(db, current_user, template_id)
    await db.commit()
