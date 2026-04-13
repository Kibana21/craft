"""Poster Wizard API router.

Phase A endpoints:
  POST /api/poster/sweep/reference-images   — trigger expired-image sweep (admin only)
  POST /api/poster/sweep/chat-turns         — trigger old-chat-turn sweep (admin only)

Both endpoints are designed to be called by an external cron job. They return
the number of affected rows and a timestamp.

Phase B will add: generate-brief, generate-appearance-paragraph, copy-draft-all, etc.
Phase C will add: generate-poster-variants.
Phase D will add: refine-chat, inpaint.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_brand_admin
from app.models.user import User
from app.schemas.poster import SweepResultResponse
from app.services.poster_sweep_service import (
    sweep_expired_reference_images,
    sweep_old_chat_turns,
)

router = APIRouter(prefix="/api/poster", tags=["poster"])


@router.post(
    "/sweep/reference-images",
    response_model=SweepResultResponse,
    summary="Sweep expired poster reference images",
    description=(
        "Deletes PosterReferenceImage rows whose `expires_at` has passed and removes "
        "the associated storage objects. Intended to be called hourly by an external cron. "
        "Requires BRAND_ADMIN role."
    ),
)
async def trigger_reference_image_sweep(
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> SweepResultResponse:
    deleted = await sweep_expired_reference_images(db)
    await db.commit()
    return SweepResultResponse(deleted_count=deleted, swept_at=datetime.now(datetime.UTC))


@router.post(
    "/sweep/chat-turns",
    response_model=SweepResultResponse,
    summary="Sweep old poster chat turns",
    description=(
        "Soft-deletes PosterChatTurn rows older than 30 days. "
        "Intended to be called daily by an external cron. "
        "Requires BRAND_ADMIN role."
    ),
)
async def trigger_chat_turn_sweep(
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> SweepResultResponse:
    soft_deleted = await sweep_old_chat_turns(db)
    await db.commit()
    return SweepResultResponse(deleted_count=soft_deleted, swept_at=datetime.now(datetime.UTC))
