import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.artifact import Artifact
from app.models.brand_library_item import BrandLibraryItem
from app.models.enums import (
    UserRole,
    LibraryItemStatus,
    ProjectType,
    ProjectPurpose,
    ProjectMemberRole,
    ArtifactStatus,
)


async def list_library_items(
    db: AsyncSession,
    user: User,
    search: str | None = None,
    product: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    query = select(BrandLibraryItem).options(
        selectinload(BrandLibraryItem.artifact),
        selectinload(BrandLibraryItem.publisher),
    )

    if user.role != UserRole.BRAND_ADMIN:
        query = query.where(BrandLibraryItem.status == LibraryItemStatus.PUBLISHED)

    if search:
        query = query.join(BrandLibraryItem.artifact).where(
            Artifact.name.ilike(f"%{search}%")
        )

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    query = query.order_by(BrandLibraryItem.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    items = (await db.execute(query)).scalars().all()

    return [
        {
            "id": item.id,
            "artifact": {
                "id": item.artifact.id,
                "name": item.artifact.name,
                "type": item.artifact.type,
                "thumbnail_url": item.artifact.thumbnail_url,
                "product": item.artifact.content.get("product") if item.artifact.content else None,
            },
            "published_by": {"id": item.publisher.id, "name": item.publisher.name},
            "status": item.status,
            "remix_count": item.remix_count,
            "published_at": item.published_at,
            "created_at": item.created_at,
        }
        for item in items
    ], total


async def get_library_item_detail(
    db: AsyncSession,
    item_id: uuid.UUID,
    user: User,
) -> dict:
    result = await db.execute(
        select(BrandLibraryItem)
        .where(BrandLibraryItem.id == item_id)
        .options(
            selectinload(BrandLibraryItem.artifact),
            selectinload(BrandLibraryItem.publisher),
        )
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found")

    # Non-admins can only see published items
    if user.role != UserRole.BRAND_ADMIN and item.status != LibraryItemStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found")

    return {
        "id": item.id,
        "artifact": {
            "id": item.artifact.id,
            "name": item.artifact.name,
            "type": item.artifact.type,
            "thumbnail_url": item.artifact.thumbnail_url,
            "product": item.artifact.content.get("product") if item.artifact.content else None,
            "content": item.artifact.content,
            "compliance_score": item.artifact.compliance_score,
            "status": item.artifact.status,
        },
        "published_by": {"id": item.publisher.id, "name": item.publisher.name},
        "status": item.status,
        "remix_count": item.remix_count,
        "rejection_reason": item.rejection_reason,
        "published_at": item.published_at,
        "created_at": item.created_at,
    }


async def publish_to_library(
    db: AsyncSession,
    user: User,
    artifact_id: uuid.UUID,
) -> BrandLibraryItem:
    if user.role != UserRole.BRAND_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only brand admins can publish")

    artifact = (
        await db.execute(select(Artifact).where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None)))
    ).scalar_one_or_none()

    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    # Check not already published
    existing = (
        await db.execute(
            select(BrandLibraryItem).where(BrandLibraryItem.artifact_id == artifact_id)
        )
    ).scalar_one_or_none()

    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Artifact already in library")

    item = BrandLibraryItem(
        artifact_id=artifact_id,
        published_by=user.id,
        status=LibraryItemStatus.PENDING_REVIEW,
    )
    db.add(item)
    await db.flush()
    return item


async def review_library_item(
    db: AsyncSession,
    user: User,
    item_id: uuid.UUID,
    action: str,
    reason: str | None = None,
) -> BrandLibraryItem:
    if user.role != UserRole.BRAND_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only brand admins can review")

    item = (
        await db.execute(select(BrandLibraryItem).where(BrandLibraryItem.id == item_id))
    ).scalar_one_or_none()

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found")

    if action == "approve":
        item.status = LibraryItemStatus.PUBLISHED
        item.published_at = datetime.now(timezone.utc)
        item.rejection_reason = None
    elif action == "reject":
        item.status = LibraryItemStatus.REJECTED
        item.rejection_reason = reason
    elif action == "unpublish":
        item.status = LibraryItemStatus.REJECTED
        item.rejection_reason = reason or "Unpublished by admin"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")

    await db.flush()
    return item


async def remix_library_item(
    db: AsyncSession,
    user: User,
    item_id: uuid.UUID,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Remix a library item: creates a new personal project with a copy of the artifact.
    Returns (project_id, artifact_id).
    """
    result = await db.execute(
        select(BrandLibraryItem)
        .where(BrandLibraryItem.id == item_id)
        .options(selectinload(BrandLibraryItem.artifact))
    )
    item = result.scalar_one_or_none()

    if item is None or item.status != LibraryItemStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Library item not found or not published")

    original = item.artifact

    # Get the original project's brief fields
    original_project = (
        await db.execute(select(Project).where(Project.id == original.project_id))
    ).scalar_one_or_none()

    # Create new personal project
    project = Project(
        name=f"{original.name} — Remix",
        type=ProjectType.PERSONAL,
        purpose=original_project.purpose if original_project else ProjectPurpose.CAMPAIGN,
        owner_id=user.id,
        product=original_project.product if original_project else None,
        target_audience=original_project.target_audience if original_project else None,
        campaign_period=original_project.campaign_period if original_project else None,
        key_message=original_project.key_message if original_project else None,
        brand_kit_id=original_project.brand_kit_id if original_project else None,
        status="active",
    )
    db.add(project)
    await db.flush()

    # Add owner membership
    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role=ProjectMemberRole.OWNER,
    )
    db.add(member)

    # Copy artifact with locked regions
    content = dict(original.content) if original.content else {}
    content["locks"] = ["brand_colors", "logo_position", "disclaimer"]
    content["remixed_from"] = str(item.id)

    artifact = Artifact(
        project_id=project.id,
        creator_id=user.id,
        type=original.type,
        name=original.name,
        content=content,
        channel=original.channel,
        format=original.format,
        thumbnail_url=original.thumbnail_url,
        compliance_score=original.compliance_score,
        status=ArtifactStatus.DRAFT,
    )
    db.add(artifact)

    # Increment remix count
    item.remix_count = item.remix_count + 1

    await db.flush()
    return project.id, artifact.id
