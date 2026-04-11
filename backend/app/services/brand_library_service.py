from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.brand_library_item import BrandLibraryItem
from app.models.artifact import Artifact
from app.models.enums import UserRole, LibraryItemStatus


async def list_library_items(
    db: AsyncSession,
    user: User,
    search: str | None = None,
    product: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List brand library items. Admins see all statuses; others see only published."""

    query = (
        select(BrandLibraryItem)
        .options(
            selectinload(BrandLibraryItem.artifact),
            selectinload(BrandLibraryItem.publisher),
        )
    )

    # Non-admins only see published items
    if user.role != UserRole.BRAND_ADMIN:
        query = query.where(BrandLibraryItem.status == LibraryItemStatus.PUBLISHED)

    # Search by artifact name
    if search:
        query = query.join(Artifact).where(Artifact.name.ilike(f"%{search}%"))

    # Filter by product (stored on the artifact's project)
    if product:
        query = query.join(Artifact).where(
            Artifact.content["product"].astext == product
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(BrandLibraryItem.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    items = result.scalars().all()

    response_items = []
    for item in items:
        response_items.append({
            "id": item.id,
            "artifact": {
                "id": item.artifact.id,
                "name": item.artifact.name,
                "type": item.artifact.type,
                "thumbnail_url": item.artifact.thumbnail_url,
                "product": item.artifact.content.get("product") if item.artifact.content else None,
            },
            "published_by": {
                "id": item.publisher.id,
                "name": item.publisher.name,
            },
            "status": item.status,
            "remix_count": item.remix_count,
            "published_at": item.published_at,
            "created_at": item.created_at,
        })

    return response_items, total
