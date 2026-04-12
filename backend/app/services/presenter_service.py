import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.presenter import Presenter
from app.models.user import User
from app.schemas.presenter import PresenterCreate, PresenterUpdate


async def list_for_user(db: AsyncSession, current_user: User) -> list[Presenter]:
    """Return all non-deleted presenters visible to the user.
    Library presenters (is_library=True) are visible to all.
    Non-library presenters are visible only to their creator.
    """
    result = await db.execute(
        select(Presenter).where(
            Presenter.deleted_at.is_(None),
            (Presenter.is_library == True) | (Presenter.created_by_id == current_user.id),  # noqa: E712
        ).order_by(Presenter.created_at.desc())
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    current_user: User,
    data: PresenterCreate,
) -> Presenter:
    presenter = Presenter(
        name=data.name,
        age_range=data.age_range,
        appearance_keywords=data.appearance_keywords,
        full_appearance_description=data.full_appearance_description,
        speaking_style=data.speaking_style,
        is_library=data.is_library,
        created_by_id=current_user.id,
    )
    db.add(presenter)
    await db.flush()
    await db.refresh(presenter)
    return presenter


async def get_by_id(
    db: AsyncSession,
    presenter_id: uuid.UUID,
    current_user: User,
) -> Presenter:
    result = await db.execute(
        select(Presenter).where(
            Presenter.id == presenter_id,
            Presenter.deleted_at.is_(None),
        )
    )
    presenter = result.scalar_one_or_none()
    if presenter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presenter not found")
    # Non-library presenters are private to their creator
    if not presenter.is_library and presenter.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return presenter


async def update(
    db: AsyncSession,
    presenter_id: uuid.UUID,
    current_user: User,
    data: PresenterUpdate,
) -> Presenter:
    presenter = await get_by_id(db, presenter_id, current_user)
    if presenter.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can update this presenter",
        )
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(presenter, field, value)
    await db.flush()
    await db.refresh(presenter)
    return presenter


async def soft_delete(
    db: AsyncSession,
    presenter_id: uuid.UUID,
    current_user: User,
) -> None:
    presenter = await get_by_id(db, presenter_id, current_user)
    if presenter.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can delete this presenter",
        )
    presenter.deleted_at = datetime.now(timezone.utc)
    await db.flush()
