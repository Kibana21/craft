"""Background task for async compliance scoring."""
import logging
import uuid

from app.core.database import async_session
from app.services.compliance_scorer import score_artifact

logger = logging.getLogger(__name__)


async def run_compliance_scoring(artifact_id: uuid.UUID) -> None:
    """Run compliance scoring as a background task.

    Must be async so FastAPI BackgroundTasks awaits it directly in the main
    event loop — keeping the asyncpg connection pool on the correct loop.
    Calling asyncio.run() from a thread (the old sync approach) creates a
    second event loop that conflicts with the pool's loop, causing
    'Future attached to a different loop' errors that corrupt the connection
    and reset the HTTP response before the client reads it.
    """
    async with async_session() as db:
        try:
            await score_artifact(db, artifact_id)
            await db.commit()
        except Exception as exc:  # noqa: BLE001 — background must not crash
            await db.rollback()
            # Use structured logging instead of print() so failures land in
            # the same stream as everything else and include a stack trace.
            logger.warning(
                "compliance_scoring_failed",
                extra={"artifact_id": str(artifact_id)},
                exc_info=True,
            )
