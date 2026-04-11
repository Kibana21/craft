from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_leader
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.user import UserSearchResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/search", response_model=list[UserSearchResponse])
async def search_users(
    q: str = Query(min_length=1),
    role: UserRole | None = Query(None),
    _current_user: User = Depends(require_leader),
    db: AsyncSession = Depends(get_db),
) -> list[UserSearchResponse]:
    query = select(User).where(
        (User.name.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%"))
    )

    if role:
        query = query.where(User.role == role)

    query = query.limit(20)
    result = await db.execute(query)
    users = result.scalars().all()

    return [UserSearchResponse.model_validate(u) for u in users]
