"""Retention sweep jobs for the Poster Wizard + cross-feature orphan sweeps.

Sweeps:

  sweep_expired_reference_images(db)
      Hourly. Deletes PosterReferenceImage rows where expires_at < now()
      and removes the associated storage object.

  sweep_old_chat_turns(db)
      Daily. Soft-deletes PosterChatTurn rows older than 30 days.

  sweep_orphan_chat_turns(db)
      Daily. Soft-deletes PosterChatTurn rows whose variant_id no longer
      appears in artifact.content.generation.variants[] — handles users
      manually deleting variants from JSONB without cascading to turns
      (the variant_id column is a JSONB reference, not a real FK).

  sweep_stuck_exports(db)
      Hourly. Flips ExportLog rows stuck in 'processing' for > 24h to
      'failed'. Catches the case where the BackgroundTask crashed mid-render
      and never updated the row.

All functions return the count of rows affected and are designed to be called
from the admin API endpoints in api/poster.py (triggered by an external cron)
or from the FastAPI lifespan startup hook for orphan-recovery on boot.
Idempotent — safe to call multiple times.
"""
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.export_log import ExportLog
from app.models.poster import PosterChatTurn, PosterReferenceImage

logger = logging.getLogger(__name__)

# How long to retain chat turns before soft-deleting.
CHAT_TURN_RETENTION_DAYS = 30

# Local upload directory used as storage fallback in dev.
_UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"


async def sweep_expired_reference_images(db: AsyncSession) -> int:
    """Delete PosterReferenceImage rows whose TTL has elapsed.

    For each expired row:
    1. Remove the storage object (local file or S3 key).
    2. Hard-delete the DB row (these are temp rows — no soft-delete needed).

    Returns the number of rows deleted.
    """
    now = datetime.now(datetime.UTC)

    result = await db.execute(
        select(PosterReferenceImage).where(PosterReferenceImage.expires_at < now)
    )
    expired = result.scalars().all()

    if not expired:
        return 0

    deleted = 0
    for row in expired:
        try:
            _delete_storage_object(row.storage_url)
        except Exception as exc:
            # Log but don't abort — a failed file delete should not prevent DB cleanup.
            logger.warning(
                "poster_sweep: could not delete storage object %s for reference image %s: %s",
                row.storage_url,
                row.id,
                exc,
            )
        await db.delete(row)
        deleted += 1

    logger.info("poster_sweep: deleted %d expired reference image(s)", deleted)
    return deleted


async def sweep_old_chat_turns(db: AsyncSession) -> int:
    """Soft-delete PosterChatTurn rows older than CHAT_TURN_RETENTION_DAYS days.

    Uses the standard soft-delete convention: sets deleted_at = now().
    Hard deletion can be done by a separate quarterly job at the DB level.

    Returns the number of rows soft-deleted.
    """
    cutoff = datetime.now(datetime.UTC) - timedelta(days=CHAT_TURN_RETENTION_DAYS)

    result = await db.execute(
        update(PosterChatTurn)
        .where(
            PosterChatTurn.created_at < cutoff,
            PosterChatTurn.deleted_at.is_(None),
        )
        .values(deleted_at=datetime.now(datetime.UTC))
        .returning(PosterChatTurn.id)
    )
    affected = len(result.all())

    if affected:
        logger.info("poster_sweep: soft-deleted %d old chat turn(s)", affected)
    return affected


async def sweep_orphan_chat_turns(db: AsyncSession) -> int:
    """Soft-delete PosterChatTurn rows whose variant_id is no longer present in
    the parent artifact's generation.variants[] JSONB array.

    Why this exists: `PosterChatTurn.variant_id` is documented as a "JSONB
    reference, not FK" — so when a user (or admin) prunes variants from the
    JSONB, the associated turns become orphans that distort turn-count
    queries. This sweep keeps `count_turns()` honest.

    Returns the number of rows soft-deleted. Idempotent.
    """
    from app.models.artifact import Artifact

    # Pull all undeleted turns + their parent artifact in one query — small
    # tables for now, fine to materialise. Optimise later if it grows.
    stmt = (
        select(PosterChatTurn, Artifact.content)
        .join(Artifact, Artifact.id == PosterChatTurn.artifact_id)
        .where(PosterChatTurn.deleted_at.is_(None))
    )
    rows = (await db.execute(stmt)).all()

    now = datetime.now(timezone.utc)
    orphan_ids: list = []
    for turn, content in rows:
        variants = ((content or {}).get("generation") or {}).get("variants") or []
        live_ids = {v.get("id") for v in variants if isinstance(v, dict)}
        if str(turn.variant_id) not in live_ids:
            orphan_ids.append(turn.id)

    if not orphan_ids:
        return 0

    await db.execute(
        update(PosterChatTurn)
        .where(PosterChatTurn.id.in_(orphan_ids))
        .values(deleted_at=now)
    )
    logger.info("poster_sweep: soft-deleted %d orphan chat turn(s)", len(orphan_ids))
    return len(orphan_ids)


async def sweep_stuck_exports(db: AsyncSession, *, age_hours: int = 24) -> int:
    """Flip ExportLog rows stuck in 'processing' > age_hours to 'failed'.

    BackgroundTasks.add_task can swallow exceptions silently, leaving the row
    stuck 'processing' forever. The user polls and sees no progress. This
    sweep gives them a definitive failure they can retry.

    Returns the number of rows updated.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    result = await db.execute(
        update(ExportLog)
        .where(
            ExportLog.status == "processing",
            ExportLog.updated_at < cutoff,
        )
        .values(status="failed")
        .returning(ExportLog.id)
    )
    affected = len(result.all())
    if affected:
        logger.warning(
            "poster_sweep: marked %d stuck export(s) (>%dh in 'processing') as 'failed'",
            affected, age_hours,
        )
    return affected


# ── Storage helpers ───────────────────────────────────────────────────────────


def _delete_storage_object(storage_url: str) -> None:
    """Remove a stored file.

    Handles:
    - Local dev paths: /uploads/... → resolves to filesystem path
    - S3/R2 URLs: logs a warning (S3 delete not yet implemented)

    Raises OSError if the local file cannot be removed (caller decides how to handle).
    """
    if storage_url.startswith("/uploads/"):
        relative = storage_url[len("/uploads/"):]
        file_path = _UPLOAD_DIR / relative
        if file_path.exists():
            file_path.unlink()
            logger.debug("poster_sweep: removed local file %s", file_path)
        else:
            logger.debug("poster_sweep: local file %s already gone", file_path)
        return

    # S3 / R2 — not yet implemented (boto3 delete stub)
    logger.warning(
        "poster_sweep: S3 object deletion not implemented. "
        "Manually delete: %s",
        storage_url,
    )
