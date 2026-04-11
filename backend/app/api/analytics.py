from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.analytics import (
    ActivityResponse,
    ContentGapResponse,
    OverviewResponse,
    TopRemixedResponse,
)
from app.services.analytics_service import (
    get_activity_timeseries,
    get_content_gaps,
    get_overview,
    get_top_remixed,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.BRAND_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Brand admin only")


@router.get("/overview", response_model=OverviewResponse)
async def analytics_overview(
    period: str = Query("week", pattern="^(week|month|quarter)$"),
    district: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OverviewResponse:
    _require_admin(current_user)
    return await get_overview(db, period=period, district=district)


@router.get("/top-remixed", response_model=TopRemixedResponse)
async def analytics_top_remixed(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopRemixedResponse:
    _require_admin(current_user)
    return await get_top_remixed(db, limit=limit)


@router.get("/content-gaps", response_model=ContentGapResponse)
async def analytics_content_gaps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentGapResponse:
    _require_admin(current_user)
    return await get_content_gaps(db)


@router.get("/activity", response_model=ActivityResponse)
async def analytics_activity(
    period: str = Query("month", pattern="^(week|month|quarter)$"),
    granularity: str = Query("day", pattern="^(day|week)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityResponse:
    _require_admin(current_user)
    return await get_activity_timeseries(db, period=period, granularity=granularity)
