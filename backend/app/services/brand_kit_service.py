import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_kit import BrandKit
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.brand_kit import UpdateBrandKitRequest
from app.services.upload_service import upload_file


async def get_brand_kit(db: AsyncSession) -> BrandKit:
    """Return the singleton brand kit row (first row, always seeded)."""
    result = await db.execute(select(BrandKit).order_by(BrandKit.created_at).limit(1))
    kit = result.scalar_one_or_none()
    if kit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand kit not found")
    return kit


def _require_brand_admin(user: User) -> None:
    if user.role != UserRole.BRAND_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Brand admin role required")


async def update_brand_kit(db: AsyncSession, user: User, data: UpdateBrandKitRequest) -> BrandKit:
    _require_brand_admin(user)
    kit = await get_brand_kit(db)

    update_fields = data.model_dump(exclude_unset=True)
    for key, value in update_fields.items():
        setattr(kit, key, value)

    kit.version = (kit.version or 1) + 1
    kit.updated_by = user.id
    await db.flush()
    return kit


async def upload_logo(db: AsyncSession, user: User, file: UploadFile, variant: str) -> BrandKit:
    """variant: 'primary' | 'secondary'"""
    _require_brand_admin(user)

    allowed_types = {"image/jpeg", "image/png", "image/svg+xml", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: JPEG, PNG, SVG, WebP",
        )

    url, _ = await upload_file(file, "brand-kit/logos")
    kit = await get_brand_kit(db)

    if variant == "secondary":
        kit.secondary_logo_url = url
    else:
        kit.logo_url = url

    kit.version = (kit.version or 1) + 1
    kit.updated_by = user.id
    await db.flush()
    return kit


async def upload_font(db: AsyncSession, user: User, file: UploadFile, slot: str) -> BrandKit:
    """slot: 'heading' | 'body' | 'accent'"""
    _require_brand_admin(user)

    allowed_types = {"font/ttf", "font/otf", "font/woff", "font/woff2", "application/octet-stream"}
    # Accept by extension too since content-type is unreliable for fonts
    filename = file.filename or ""
    if not any(filename.lower().endswith(ext) for ext in [".ttf", ".otf", ".woff", ".woff2"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid font file. Allowed: TTF, OTF, WOFF, WOFF2",
        )

    url, safe_filename = await upload_file(file, "brand-kit/fonts")
    kit = await get_brand_kit(db)

    fonts = dict(kit.fonts or {})
    fonts[f"{slot}_url"] = url
    fonts[slot] = safe_filename
    kit.fonts = fonts

    kit.version = (kit.version or 1) + 1
    kit.updated_by = user.id
    await db.flush()
    return kit
