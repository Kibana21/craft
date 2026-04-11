import uuid
import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.artifact_suggestion import ArtifactSuggestion
from app.models.enums import ArtifactType, SuggestionAudience, ProjectPurpose

# Fallback suggestions when Gemini is not configured
FALLBACK_SUGGESTIONS: dict[ProjectPurpose, list[dict]] = {
    ProjectPurpose.PRODUCT_LAUNCH: [
        {"type": ArtifactType.VIDEO, "name": "Agent training video (60s)", "description": "Internal — agents must know the product", "audience": SuggestionAudience.INTERNAL},
        {"type": ArtifactType.VIDEO, "name": "Customer explainer video (30s)", "description": "External — social + WhatsApp", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.POSTER, "name": "Instagram launch poster (1:1)", "description": "External — social media", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.WHATSAPP_CARD, "name": "WhatsApp agent broadcast card", "description": "Both — agent sends to clients", "audience": SuggestionAudience.BOTH},
        {"type": ArtifactType.SLIDE_DECK, "name": "Product fact sheet deck", "description": "Internal — reference material for agents", "audience": SuggestionAudience.INTERNAL},
    ],
    ProjectPurpose.CAMPAIGN: [
        {"type": ArtifactType.POSTER, "name": "Instagram campaign poster (1:1)", "description": "External — social media", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.WHATSAPP_CARD, "name": "WhatsApp promotional card", "description": "External — client outreach", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.REEL, "name": "Campaign reel (9:16)", "description": "External — Instagram/TikTok", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.STORY, "name": "Social media story", "description": "External — Instagram stories", "audience": SuggestionAudience.EXTERNAL},
    ],
    ProjectPurpose.SEASONAL: [
        {"type": ArtifactType.POSTER, "name": "Festive greeting poster", "description": "External — seasonal social media", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.WHATSAPP_CARD, "name": "Greeting card (WhatsApp)", "description": "External — personal client greeting", "audience": SuggestionAudience.EXTERNAL},
        {"type": ArtifactType.REEL, "name": "Seasonal reel (9:16)", "description": "External — festive social content", "audience": SuggestionAudience.EXTERNAL},
    ],
    ProjectPurpose.AGENT_ENABLEMENT: [
        {"type": ArtifactType.VIDEO, "name": "Training video (60s)", "description": "Internal — agent onboarding", "audience": SuggestionAudience.INTERNAL},
        {"type": ArtifactType.INFOGRAPHIC, "name": "Product knowledge infographic", "description": "Internal — quick reference", "audience": SuggestionAudience.INTERNAL},
        {"type": ArtifactType.SLIDE_DECK, "name": "Agent training slide deck", "description": "Internal — presentation material", "audience": SuggestionAudience.INTERNAL},
    ],
}


async def generate_suggestions(
    db: AsyncSession,
    project: Project,
) -> list[ArtifactSuggestion]:
    """Generate artifact suggestions for a project.
    Uses Gemini when configured, falls back to preset suggestions.
    """
    # TODO: When GOOGLE_API_KEY is set, call Gemini to generate contextual suggestions
    # For now, use fallback suggestions based on purpose type
    templates = FALLBACK_SUGGESTIONS.get(project.purpose, FALLBACK_SUGGESTIONS[ProjectPurpose.CAMPAIGN])

    suggestions = []
    for template in templates:
        suggestion = ArtifactSuggestion(
            project_id=project.id,
            artifact_type=template["type"],
            artifact_name=template["name"],
            description=template["description"],
            audience=template["audience"],
            selected=True,
        )
        db.add(suggestion)
        suggestions.append(suggestion)

    await db.flush()
    return suggestions


async def list_suggestions(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> list[ArtifactSuggestion]:
    result = await db.execute(
        select(ArtifactSuggestion)
        .where(ArtifactSuggestion.project_id == project_id)
        .order_by(ArtifactSuggestion.created_at)
    )
    return list(result.scalars().all())


async def toggle_suggestion(
    db: AsyncSession,
    suggestion_id: uuid.UUID,
    selected: bool,
) -> ArtifactSuggestion:
    result = await db.execute(
        select(ArtifactSuggestion).where(ArtifactSuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()

    if suggestion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")

    suggestion.selected = selected
    await db.flush()
    return suggestion
