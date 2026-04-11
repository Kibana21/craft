"""Background task for async compliance scoring."""
import asyncio
import uuid

from app.core.database import async_session
from app.services.compliance_scorer import score_artifact


def run_compliance_scoring(artifact_id: uuid.UUID) -> None:
    """Run compliance scoring as a background task.
    Creates its own DB session since BackgroundTasks runs after response.
    """
    asyncio.run(_score(artifact_id))


async def _score(artifact_id: uuid.UUID) -> None:
    async with async_session() as db:
        try:
            await score_artifact(db, artifact_id)
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Compliance scoring failed for artifact {artifact_id}: {e}")
