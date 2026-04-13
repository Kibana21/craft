import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User


def require_role(*allowed_roles: str):
    """Dependency factory: returns 403 if user's role is not in allowed_roles."""

    async def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return _check_role


# Convenience dependencies for common role checks
require_brand_admin = require_role(UserRole.BRAND_ADMIN.value)

require_leader = require_role(
    UserRole.BRAND_ADMIN.value,
    UserRole.DISTRICT_LEADER.value,
    UserRole.AGENCY_LEADER.value,
)

require_any_authenticated = require_role(
    UserRole.BRAND_ADMIN.value,
    UserRole.DISTRICT_LEADER.value,
    UserRole.AGENCY_LEADER.value,
    UserRole.FSC.value,
)


async def require_artifact_access(
    artifact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> "Artifact":  # type: ignore[name-defined]  # avoid circular import
    """FastAPI dependency: returns the Artifact or raises 403/404.

    Access is granted when the requesting user is:
    - a BRAND_ADMIN, OR
    - the artifact creator, OR
    - a member of the artifact's project.
    """
    from app.models.artifact import Artifact
    from app.models.project_member import ProjectMember

    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    if current_user.role == UserRole.BRAND_ADMIN or artifact.creator_id == current_user.id:
        return artifact

    member = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == artifact.project_id,
                ProjectMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": "You do not have access to this artifact",
                "error_code": "RBAC_DENIED",
            },
        )
    return artifact
