from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_password
from app.models.user import User


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user
