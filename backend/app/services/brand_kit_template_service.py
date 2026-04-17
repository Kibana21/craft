import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_kit_template import BrandKitTemplate
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.brand_kit import CreateTemplateRequest, UpdateTemplateRequest
from app.services.brand_kit_service import get_brand_kit


def _require_brand_admin(user: User) -> None:
    if user.role != UserRole.BRAND_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Brand admin role required")


async def list_templates(db: AsyncSession) -> list[BrandKitTemplate]:
    # Templates are org-wide layouts — not scoped to a specific kit version.
    # The brand_kit_id FK records which kit row originally created the template,
    # but all templates are available regardless of which kit version is active.
    result = await db.execute(
        select(BrandKitTemplate)
        .order_by(BrandKitTemplate.is_default.desc(), BrandKitTemplate.name)
    )
    return list(result.scalars().all())


async def create_template(
    db: AsyncSession, user: User, data: CreateTemplateRequest,
) -> BrandKitTemplate:
    _require_brand_admin(user)
    active_kit = await get_brand_kit(db)
    template = BrandKitTemplate(
        brand_kit_id=active_kit.id,
        name=data.name,
        layout_key=data.layout_key,
        zones=[z.model_dump() for z in data.zones],
        is_default=False,
        created_by=user.id,
    )
    db.add(template)
    await db.flush()
    return template


async def update_template(
    db: AsyncSession, user: User, template_id: uuid.UUID, data: UpdateTemplateRequest,
) -> BrandKitTemplate:
    _require_brand_admin(user)
    template = await db.get(BrandKitTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "zones" and value is not None:
            value = [z.model_dump() if hasattr(z, "model_dump") else z for z in value]
        setattr(template, field, value)
    await db.flush()
    return template


async def delete_template(
    db: AsyncSession, user: User, template_id: uuid.UUID,
) -> None:
    _require_brand_admin(user)
    template = await db.get(BrandKitTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if template.is_default:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete a default template")
    await db.delete(template)
    await db.flush()
