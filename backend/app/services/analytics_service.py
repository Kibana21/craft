"""Analytics service: aggregation queries with Redis caching (5-min TTL)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artifact import Artifact
from app.models.brand_library_item import BrandLibraryItem
from app.models.enums import ArtifactStatus, UserRole
from app.models.export_log import ExportLog
from app.models.user import User
from app.schemas.analytics import (
    OverviewResponse,
    TopRemixedResponse,
    TopRemixedItem,
    ContentGapResponse,
    ContentGap,
    ActivityResponse,
    ActivityDataPoint,
)

CACHE_TTL = 300  # 5 minutes


async def _get_redis():
    """Fail-open: returns None if Redis is down so analytics queries fall back
    to direct DB hits. Logs a warning so the degradation isn't silent."""
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        await client.ping()
        return client
    except Exception as exc:  # noqa: BLE001 — fail-open with visible log
        import logging
        logging.getLogger(__name__).warning(
            "analytics Redis cache unreachable (queries will hit DB directly): %s",
            exc, exc_info=False,
        )
        return None


async def _cached(redis, key: str, build_fn, ttl: int = CACHE_TTL):
    """Fetch from Redis cache or build and store."""
    if redis:
        try:
            raw = await redis.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass

    result = await build_fn()

    if redis:
        try:
            await redis.set(key, json.dumps(result, default=str), ex=ttl)
        except Exception:
            pass

    return result


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "week":
        return now - timedelta(days=7)
    elif period == "month":
        return now - timedelta(days=30)
    elif period == "quarter":
        return now - timedelta(days=90)
    return now - timedelta(days=7)


async def get_overview(
    db: AsyncSession,
    period: str = "week",
    district: str | None = None,
) -> OverviewResponse:
    redis = await _get_redis()
    cache_key = f"analytics:overview:{period}:{district or 'all'}"

    async def build():
        week_start = _period_start("week")
        month_start = _period_start("month")
        period_start = _period_start(period)

        # Assets created this week
        created_week = (
            await db.execute(
                select(func.count(Artifact.id)).where(
                    Artifact.deleted_at.is_(None),
                    Artifact.created_at >= week_start,
                )
            )
        ).scalar() or 0

        # Assets created this month
        created_month = (
            await db.execute(
                select(func.count(Artifact.id)).where(
                    Artifact.deleted_at.is_(None),
                    Artifact.created_at >= month_start,
                )
            )
        ).scalar() or 0

        # Total remixes
        total_remixes = (
            await db.execute(select(func.sum(BrandLibraryItem.remix_count)))
        ).scalar() or 0

        # Compliance rate: % of artifacts with score >= 70
        total_scored = (
            await db.execute(
                select(func.count(Artifact.id)).where(
                    Artifact.deleted_at.is_(None),
                    Artifact.compliance_score.isnot(None),
                )
            )
        ).scalar() or 0

        passing = (
            await db.execute(
                select(func.count(Artifact.id)).where(
                    Artifact.deleted_at.is_(None),
                    Artifact.compliance_score >= 70,
                )
            )
        ).scalar() or 0

        compliance_rate = round((passing / total_scored * 100), 1) if total_scored > 0 else 0.0

        # Active FSCs: distinct FSC users who created an artifact in the period
        active_fscs = (
            await db.execute(
                select(func.count(func.distinct(Artifact.creator_id)))
                .join(User, User.id == Artifact.creator_id)
                .where(
                    Artifact.deleted_at.is_(None),
                    Artifact.created_at >= period_start,
                    User.role == UserRole.FSC,
                )
            )
        ).scalar() or 0

        return {
            "assets_created_week": int(created_week),
            "assets_created_month": int(created_month),
            "total_remixes": int(total_remixes),
            "compliance_rate": compliance_rate,
            "active_fscs": int(active_fscs),
        }

    data = await _cached(redis, cache_key, build)
    if redis:
        await redis.aclose()
    return OverviewResponse(**data)


async def get_top_remixed(
    db: AsyncSession,
    limit: int = 10,
) -> TopRemixedResponse:
    redis = await _get_redis()
    cache_key = f"analytics:top_remixed:{limit}"

    async def build():
        result = await db.execute(
            select(BrandLibraryItem, Artifact)
            .join(Artifact, Artifact.id == BrandLibraryItem.artifact_id)
            .order_by(BrandLibraryItem.remix_count.desc())
            .limit(limit)
        )
        rows = result.all()
        return [
            {
                "item_id": str(item.id),
                "artifact_name": artifact.name,
                "artifact_type": artifact.type.value if artifact.type else "",
                "product": artifact.content.get("product") if artifact.content else None,
                "remix_count": item.remix_count,
            }
            for item, artifact in rows
        ]

    data = await _cached(redis, cache_key, build)
    if redis:
        await redis.aclose()
    return TopRemixedResponse(items=[TopRemixedItem(**d) for d in data])


async def get_content_gaps(db: AsyncSession) -> ContentGapResponse:
    redis = await _get_redis()
    cache_key = "analytics:content_gaps"

    async def build():
        # Find product+type combos created by FSCs that have no library equivalent
        sql = text("""
            SELECT
                a.content->>'product' AS product,
                a.type::text AS artifact_type,
                COUNT(*) AS fsc_count
            FROM artifacts a
            JOIN users u ON a.creator_id = u.id
            WHERE u.role = 'fsc'
              AND a.deleted_at IS NULL
            GROUP BY a.content->>'product', a.type
            HAVING NOT EXISTS (
                SELECT 1
                FROM brand_library_items bli
                JOIN artifacts ba ON bli.artifact_id = ba.id
                WHERE (ba.content->>'product') = (a.content->>'product')
                  AND ba.type = a.type
                  AND bli.status = 'published'
                  AND ba.deleted_at IS NULL
            )
            ORDER BY fsc_count DESC
            LIMIT 20
        """)
        result = await db.execute(sql)
        rows = result.fetchall()
        return [
            {"product": row.product, "artifact_type": row.artifact_type, "fsc_count": row.fsc_count}
            for row in rows
        ]

    data = await _cached(redis, cache_key, build)
    if redis:
        await redis.aclose()
    return ContentGapResponse(gaps=[ContentGap(**d) for d in data])


async def get_activity_timeseries(
    db: AsyncSession,
    period: str = "month",
    granularity: str = "day",
) -> ActivityResponse:
    redis = await _get_redis()
    cache_key = f"analytics:activity:{period}:{granularity}"

    async def build():
        start = _period_start(period)
        trunc = "day" if granularity in ("day", "daily") else "week"

        created_sql = text(f"""
            SELECT
                DATE_TRUNC('{trunc}', created_at AT TIME ZONE 'UTC')::date AS dt,
                COUNT(*) AS cnt
            FROM artifacts
            WHERE deleted_at IS NULL
              AND created_at >= :start
            GROUP BY dt
            ORDER BY dt
        """)
        exported_sql = text(f"""
            SELECT
                DATE_TRUNC('{trunc}', exported_at AT TIME ZONE 'UTC')::date AS dt,
                COUNT(*) AS cnt
            FROM export_logs
            WHERE exported_at >= :start
            GROUP BY dt
            ORDER BY dt
        """)

        created_rows = (await db.execute(created_sql, {"start": start})).fetchall()
        exported_rows = (await db.execute(exported_sql, {"start": start})).fetchall()

        created_map = {str(r.dt): int(r.cnt) for r in created_rows}
        exported_map = {str(r.dt): int(r.cnt) for r in exported_rows}

        all_dates = sorted(set(created_map) | set(exported_map))
        return [
            {"date": dt, "created": created_map.get(dt, 0), "exported": exported_map.get(dt, 0)}
            for dt in all_dates
        ]

    data = await _cached(redis, cache_key, build)
    if redis:
        await redis.aclose()
    return ActivityResponse(data=[ActivityDataPoint(**d) for d in data], granularity=granularity)
