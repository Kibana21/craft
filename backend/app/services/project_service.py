from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.artifact import Artifact
from app.models.enums import UserRole, ProjectType


async def list_user_projects(
    db: AsyncSession,
    user: User,
    project_type: ProjectType | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List projects accessible to the user, with artifact and member counts."""

    # Base query — always load owner
    base_query = (
        select(Project)
        .where(Project.deleted_at.is_(None))
        .options(selectinload(Project.owner))
    )

    # Role-based scoping
    if user.role == UserRole.BRAND_ADMIN:
        # Brand admins see all projects
        query = base_query
    else:
        # Others see: projects they own + projects they're a member of
        query = base_query.where(
            (Project.owner_id == user.id)
            | Project.id.in_(
                select(ProjectMember.project_id).where(
                    ProjectMember.user_id == user.id
                )
            )
        )

    # Filter by type if specified
    if project_type is not None:
        query = query.where(Project.type == project_type)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(Project.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    projects = result.scalars().all()

    # Get artifact and member counts for each project
    items = []
    for project in projects:
        artifact_count_result = await db.execute(
            select(func.count())
            .select_from(Artifact)
            .where(Artifact.project_id == project.id, Artifact.deleted_at.is_(None))
        )
        artifact_count = artifact_count_result.scalar() or 0

        member_count_result = await db.execute(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project.id)
        )
        member_count = member_count_result.scalar() or 0

        items.append({
            "id": project.id,
            "name": project.name,
            "type": project.type,
            "purpose": project.purpose,
            "owner": {
                "id": project.owner.id,
                "name": project.owner.name,
                "avatar_url": project.owner.avatar_url,
            },
            "product": project.product,
            "target_audience": project.target_audience,
            "campaign_period": project.campaign_period,
            "key_message": project.key_message,
            "status": project.status,
            "artifact_count": artifact_count,
            "member_count": member_count,
            "created_at": project.created_at,
        })

    return items, total
