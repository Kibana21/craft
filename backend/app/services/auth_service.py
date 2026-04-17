import asyncio

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

    # bcrypt is CPU-bound and synchronous — run it in a thread pool so it
    # doesn't block the asyncio event loop (especially critical at cold start
    # when lifespan tasks are competing for the loop).
    password_ok = await asyncio.to_thread(verify_password, password, user.hashed_password)
    if not password_ok:
        return None

    return user
