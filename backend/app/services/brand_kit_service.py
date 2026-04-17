import logging
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_kit import BrandKit
from app.models.enums import UserRole
from app.models.notification import Notification
from app.models.user import User
from app.schemas.brand_kit import ActivatedByInfo, UpdateBrandKitRequest
from app.services.upload_service import upload_file

logger = logging.getLogger(__name__)

VALID_FONT_SLOTS = {"heading", "body", "disclaimer"}
SLOT_ALIASES = {"accent": "disclaimer"}


def _normalize_slot(slot: str) -> str:
    return SLOT_ALIASES.get(slot, slot)


async def get_brand_kit(db: AsyncSession) -> BrandKit:
    """Return the active brand kit row."""
    result = await db.execute(select(BrandKit).where(BrandKit.is_active == true()))
    kit = result.scalar_one_or_none()
    if kit is None:
        result = await db.execute(select(BrandKit).order_by(BrandKit.created_at.desc()).limit(1))
        kit = result.scalar_one_or_none()
    if kit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand kit not found")
    return kit


def _require_brand_admin(user: User) -> None:
    if user.role != UserRole.BRAND_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Brand admin role required")


def _snapshot_kit(source: BrandKit, **overrides) -> BrandKit:
    """Create a new BrandKit row by copying all values from source, with overrides applied."""
    new_kit = BrandKit(
        name=source.name,
        logo_url=source.logo_url,
        secondary_logo_url=source.secondary_logo_url,
        primary_color=source.primary_color,
        secondary_color=source.secondary_color,
        accent_color=source.accent_color,
        fonts=dict(source.fonts) if source.fonts else None,
        color_names=dict(source.color_names) if source.color_names else None,
        zone_roles=dict(source.zone_roles) if source.zone_roles else None,
        version=source.version,
        is_active=True,
    )
    for key, value in overrides.items():
        setattr(new_kit, key, value)
    return new_kit


async def _create_new_version(
    db: AsyncSession, active_kit: BrandKit, user: User, changelog: str | None = None, **field_overrides,
) -> BrandKit:
    """Deactivate the current kit and create a new active snapshot with overrides."""
    active_kit.is_active = False

    new_kit = _snapshot_kit(
        active_kit,
        version=active_kit.version + 1,
        is_active=True,
        changelog=changelog,
        activated_by=user.id,
        activated_at=func.now(),
        updated_by=user.id,
        **field_overrides,
    )
    db.add(new_kit)
    await db.flush()
    return new_kit


async def update_brand_kit(db: AsyncSession, user: User, data: UpdateBrandKitRequest) -> BrandKit:
    _require_brand_admin(user)
    kit = await get_brand_kit(db)

    update_fields = data.model_dump(exclude_unset=True)
    changelog = update_fields.pop("changelog", None)

    return await _create_new_version(db, kit, user, changelog=changelog, **update_fields)


async def upload_logo(db: AsyncSession, user: User, file: UploadFile, variant: str) -> BrandKit:
    _require_brand_admin(user)

    allowed_types = {"image/jpeg", "image/png", "image/svg+xml", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPEG, PNG, SVG, WebP",
        )

    url, _ = await upload_file(file, "brand-kit/logos")
    kit = await get_brand_kit(db)

    field = "secondary_logo_url" if variant == "secondary" else "logo_url"
    return await _create_new_version(
        db, kit, user,
        changelog=f"{'Secondary logo' if variant == 'secondary' else 'Primary logo'} updated",
        **{field: url},
    )


async def upload_font(db: AsyncSession, user: User, file: UploadFile, slot: str) -> BrandKit:
    _require_brand_admin(user)
    slot = _normalize_slot(slot)

    if slot not in VALID_FONT_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid font slot: {slot}")

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
    # Store the original filename as the display name, fall back to safe_filename
    fonts[slot] = file.filename or safe_filename
    if slot == "disclaimer":
        fonts["disclaimer_inherited"] = False

    return await _create_new_version(
        db, kit, user,
        changelog=f"{slot.title()} font updated",
        fonts=fonts,
    )


async def list_versions(db: AsyncSession) -> list[dict]:
    """Return all brand kit versions, newest first, with activated_by user info."""
    result = await db.execute(
        select(BrandKit, User.name.label("user_name"))
        .outerjoin(User, BrandKit.activated_by == User.id)
        .order_by(BrandKit.version.desc())
    )
    versions = []
    for kit, user_name in result.all():
        activated_by_info = None
        if kit.activated_by and user_name:
            activated_by_info = {"id": str(kit.activated_by), "name": user_name}
        versions.append({
            "id": kit.id,
            "version": kit.version,
            "name": kit.name,
            "changelog": kit.changelog,
            "activated_by_info": activated_by_info,
            "activated_at": kit.activated_at,
            "is_active": kit.is_active,
            "created_at": kit.created_at,
            "primary_color": kit.primary_color,
            "secondary_color": kit.secondary_color,
            "accent_color": kit.accent_color,
            "logo_url": kit.logo_url,
            "secondary_logo_url": kit.secondary_logo_url,
            "fonts": kit.fonts,
            "color_names": kit.color_names,
            "zone_roles": kit.zone_roles,
        })
    return versions


async def restore_version(db: AsyncSession, user: User, version_id: uuid.UUID) -> BrandKit:
    """Restore a past brand kit version. Creates a new active row with the source's values."""
    _require_brand_admin(user)

    source = await db.get(BrandKit, version_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    if source.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This version is already active")

    active = await get_brand_kit(db)
    source_version = source.version

    new_kit = await _create_new_version(
        db, active, user,
        changelog=f"Restored from v{source_version}",
        name=source.name,
        logo_url=source.logo_url,
        secondary_logo_url=source.secondary_logo_url,
        primary_color=source.primary_color,
        secondary_color=source.secondary_color,
        accent_color=source.accent_color,
        fonts=dict(source.fonts) if source.fonts else None,
        color_names=dict(source.color_names) if source.color_names else None,
    )

    await _notify_brand_admins_kit_restored(db, user, new_kit, source_version)
    return new_kit


async def _notify_brand_admins_kit_restored(
    db: AsyncSession, restoring_user: User, new_kit: BrandKit, source_version: int,
) -> None:
    result = await db.execute(select(User).where(User.role == UserRole.BRAND_ADMIN))
    admins = result.scalars().all()

    for admin in admins:
        notification = Notification(
            user_id=admin.id,
            type="BRAND_KIT_RESTORED",
            title="Brand Kit restored",
            message=f"{restoring_user.name} restored Brand Kit to v{source_version} (now v{new_kit.version}).",
            data={"brand_kit_id": str(new_kit.id), "version": new_kit.version},
        )
        db.add(notification)

    await db.flush()
    logger.info("Sent BRAND_KIT_RESTORED notification to %d admins for v%d", len(admins), new_kit.version)
