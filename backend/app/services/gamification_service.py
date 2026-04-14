"""Gamification: points, streaks, leaderboard (backed by PostgreSQL + Redis sorted sets)."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import UserPoints, PointsLog, PointsAction
from app.models.user import User
from app.schemas.gamification import GamificationStatsResponse, LeaderboardResponse, LeaderboardEntry, get_milestone

POINTS_MAP = {
    PointsAction.CREATE_ARTIFACT: 10,
    PointsAction.EXPORT: 20,
    PointsAction.REMIX: 15,
    PointsAction.STREAK_BONUS: 50,
    PointsAction.VIDEO_GENERATED: 50,
    PointsAction.MY_STUDIO_UPLOAD: 5,
    PointsAction.MY_STUDIO_ENHANCE: 10,
    PointsAction.MY_STUDIO_BATCH: 25,
}

LEADERBOARD_KEY = "leaderboard:global"


async def _get_redis():
    """Return an async Redis client (None if Redis unavailable).

    Fail-open by design — gamification doesn't block requests when Redis is
    down. But ALWAYS log so ops can tell when leaderboard / points sync are
    silently degraded (was a missed signal in prior incidents).
    """
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        await client.ping()
        return client
    except Exception as exc:  # noqa: BLE001 — fail-open with visible log
        import logging
        logging.getLogger(__name__).warning(
            "gamification Redis unreachable (leaderboard sync degraded): %s",
            exc, exc_info=False,
        )
        return None


async def _get_or_create_user_points(db: AsyncSession, user_id: uuid.UUID) -> UserPoints:
    result = await db.execute(select(UserPoints).where(UserPoints.user_id == user_id))
    up = result.scalar_one_or_none()
    if up is None:
        up = UserPoints(user_id=user_id, total_points=0, current_streak=0, longest_streak=0)
        db.add(up)
        await db.flush()
    return up


async def _update_streak(db: AsyncSession, user_id: uuid.UUID, up: UserPoints) -> bool:
    """Update streak. Returns True if a streak bonus should be awarded."""
    today = date.today()
    last = up.last_activity_date

    if last == today:
        return False  # Already counted

    if last == today - timedelta(days=1):
        up.current_streak += 1
    else:
        up.current_streak = 1

    up.longest_streak = max(up.longest_streak, up.current_streak)
    up.last_activity_date = today
    await db.flush()

    return up.current_streak == 7


async def award_points(db: AsyncSession, user_id: uuid.UUID, action: PointsAction) -> None:
    """Award points for an action, update streak, sync Redis leaderboard."""
    up = await _get_or_create_user_points(db, user_id)
    pts = POINTS_MAP.get(action, 0)

    # Add to log
    log = PointsLog(user_id=user_id, action=action, points=pts)
    db.add(log)

    up.total_points = up.total_points + pts

    # Update streak (only for user-initiated actions, not streak_bonus itself)
    if action != PointsAction.STREAK_BONUS:
        streak_bonus = await _update_streak(db, user_id, up)
        if streak_bonus:
            bonus_log = PointsLog(user_id=user_id, action=PointsAction.STREAK_BONUS, points=50)
            db.add(bonus_log)
            up.total_points = up.total_points + 50

    await db.flush()

    # Sync Redis sorted set
    redis = await _get_redis()
    if redis:
        try:
            await redis.zadd(LEADERBOARD_KEY, {str(user_id): up.total_points})
        except Exception:
            pass
        finally:
            await redis.aclose()


async def award_points_once(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: PointsAction,
    related_artifact_id: uuid.UUID,
) -> None:
    """Idempotent points award keyed on (user_id, action, related_artifact_id).
    If a PointsLog row already exists for this triple, no-ops silently.
    """
    existing = await db.execute(
        select(PointsLog).where(
            PointsLog.user_id == user_id,
            PointsLog.action == action.value,
            PointsLog.related_artifact_id == related_artifact_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return  # Already awarded — idempotent no-op

    up = await _get_or_create_user_points(db, user_id)
    pts = POINTS_MAP.get(action, 0)

    log_entry = PointsLog(
        user_id=user_id,
        action=action,
        points=pts,
        related_artifact_id=related_artifact_id,
    )
    db.add(log_entry)
    up.total_points = up.total_points + pts

    if action != PointsAction.STREAK_BONUS:
        streak_bonus = await _update_streak(db, user_id, up)
        if streak_bonus:
            bonus_log = PointsLog(user_id=user_id, action=PointsAction.STREAK_BONUS, points=50)
            db.add(bonus_log)
            up.total_points = up.total_points + 50

    await db.flush()

    redis = await _get_redis()
    if redis:
        try:
            await redis.zadd(LEADERBOARD_KEY, {str(user_id): up.total_points})
        except Exception:
            pass
        finally:
            await redis.aclose()


async def get_user_stats(db: AsyncSession, user: User) -> GamificationStatsResponse:
    up = await _get_or_create_user_points(db, user.id)

    rank: int | None = None
    percentile: float | None = None

    redis = await _get_redis()
    if redis:
        try:
            raw_rank = await redis.zrevrank(LEADERBOARD_KEY, str(user.id))
            total_count = await redis.zcard(LEADERBOARD_KEY)
            if raw_rank is not None and total_count and total_count > 0:
                rank = int(raw_rank) + 1
                percentile = round((rank / total_count) * 100, 1)
        except Exception:
            pass
        finally:
            await redis.aclose()

    # Fall back to DB rank if Redis unavailable
    if rank is None:
        higher = (
            await db.execute(
                select(func.count(UserPoints.id)).where(UserPoints.total_points > up.total_points)
            )
        ).scalar() or 0
        rank = int(higher) + 1
        total_db = (await db.execute(select(func.count(UserPoints.id)))).scalar() or 1
        percentile = round((rank / total_db) * 100, 1)

    current_level, _, next_milestone = get_milestone(up.total_points)

    return GamificationStatsResponse(
        total_points=up.total_points,
        current_streak=up.current_streak,
        longest_streak=up.longest_streak,
        rank=rank,
        percentile=percentile,
        current_level=current_level,
        next_milestone=next_milestone,
        last_activity_date=up.last_activity_date,
    )


async def get_leaderboard(
    db: AsyncSession,
    current_user: User,
    top_n: int = 10,
) -> LeaderboardResponse:
    """Build leaderboard from Redis (sorted set) with DB fallback."""
    redis = await _get_redis()

    if redis:
        try:
            raw_entries = await redis.zrevrange(LEADERBOARD_KEY, 0, top_n - 1, withscores=True)
            total_count = await redis.zcard(LEADERBOARD_KEY) or 0
            user_rank_raw = await redis.zrevrank(LEADERBOARD_KEY, str(current_user.id))
            user_rank = int(user_rank_raw) + 1 if user_rank_raw is not None else None

            # Fetch user details for the top entries
            user_ids = [uuid.UUID(uid) for uid, _ in raw_entries]
            users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
            users_map = {u.id: u for u in users_result.scalars().all()}

            # Fetch streaks
            up_result = await db.execute(select(UserPoints).where(UserPoints.user_id.in_(user_ids)))
            up_map = {up.user_id: up for up in up_result.scalars().all()}

            entries = []
            for i, (uid_str, score) in enumerate(raw_entries):
                uid = uuid.UUID(uid_str)
                u = users_map.get(uid)
                if u is None:
                    continue
                up = up_map.get(uid)
                entries.append(LeaderboardEntry(
                    rank=i + 1,
                    user_id=uid,
                    user_name=u.name,
                    user_avatar=u.avatar_url,
                    points=int(score),
                    streak=up.current_streak if up else 0,
                    is_current_user=(uid == current_user.id),
                ))

            # Build current user entry if not in top N
            user_entry: LeaderboardEntry | None = None
            if current_user.id not in {e.user_id for e in entries} and user_rank is not None:
                cu_up = await _get_or_create_user_points(db, current_user.id)
                user_entry = LeaderboardEntry(
                    rank=user_rank,
                    user_id=current_user.id,
                    user_name=current_user.name,
                    user_avatar=current_user.avatar_url,
                    points=cu_up.total_points,
                    streak=cu_up.current_streak,
                    is_current_user=True,
                )

            return LeaderboardResponse(
                entries=entries,
                user_rank=user_rank,
                user_entry=user_entry,
                total_members=int(total_count),
            )
        except Exception:
            pass
        finally:
            await redis.aclose()

    # DB fallback: ORDER BY total_points DESC
    up_result = await db.execute(
        select(UserPoints, User)
        .join(User, User.id == UserPoints.user_id)
        .order_by(UserPoints.total_points.desc())
        .limit(top_n)
    )
    rows = up_result.all()
    total_count = (await db.execute(select(func.count(UserPoints.id)))).scalar() or 0

    entries = []
    user_rank = None
    for i, (up, u) in enumerate(rows):
        is_current = u.id == current_user.id
        if is_current:
            user_rank = i + 1
        entries.append(LeaderboardEntry(
            rank=i + 1,
            user_id=u.id,
            user_name=u.name,
            user_avatar=u.avatar_url,
            points=up.total_points,
            streak=up.current_streak,
            is_current_user=is_current,
        ))

    user_entry = next((e for e in entries if e.is_current_user), None)

    return LeaderboardResponse(
        entries=entries,
        user_rank=user_rank,
        user_entry=user_entry,
        total_members=int(total_count),
    )
