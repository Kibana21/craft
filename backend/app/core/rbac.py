from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_user
from app.models.user import User
from app.models.enums import UserRole


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
