"""Background task for async compliance scoring."""
import uuid

from app.core.database import async_session
from app.services.compliance_scorer import score_artifact


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
        except Exception as e:
            await db.rollback()
            print(f"Compliance scoring failed for artifact {artifact_id}: {e}")
