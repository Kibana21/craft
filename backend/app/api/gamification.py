from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.gamification import GamificationStatsResponse, LeaderboardResponse
from app.services.gamification_service import get_user_stats, get_leaderboard

router = APIRouter(prefix="/api/gamification", tags=["gamification"])


@router.get("/me", response_model=GamificationStatsResponse)
async def get_my_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GamificationStatsResponse:
    return await get_user_stats(db, current_user)


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    return await get_leaderboard(db, current_user)
