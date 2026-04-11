import uuid
from datetime import date

from pydantic import BaseModel


MILESTONES = [
    (0, "Bronze Creator"),
    (500, "Silver Creator"),
    (2000, "Gold Creator"),
    (5000, "Platinum Creator"),
    (10000, "Diamond Creator"),
]


def get_milestone(points: int) -> tuple[str, int, int]:
    """Return (current_level, current_threshold, next_threshold)."""
    current = MILESTONES[0]
    for threshold, name in MILESTONES:
        if points >= threshold:
            current = (threshold, name)
    idx = next((i for i, (t, _) in enumerate(MILESTONES) if t == current[0]), 0)
    if idx + 1 < len(MILESTONES):
        next_threshold = MILESTONES[idx + 1][0]
    else:
        next_threshold = current[0]
    return current[1], current[0], next_threshold


class GamificationStatsResponse(BaseModel):
    total_points: int
    current_streak: int
    longest_streak: int
    rank: int | None = None
    percentile: float | None = None
    current_level: str
    next_milestone: int
    last_activity_date: date | None = None


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    user_name: str
    user_avatar: str | None = None
    points: int
    streak: int
    is_current_user: bool = False


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    user_rank: int | None = None
    user_entry: LeaderboardEntry | None = None
    total_members: int
