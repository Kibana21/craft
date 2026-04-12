import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.scene import SceneResponse, SceneUpdate, SceneAiDialogueResponse, SceneAiSettingResponse
from app.services import video_service
from app.services.ai_service import refine_scene_dialogue, suggest_scene_setting

router = APIRouter(tags=["scenes"])


@router.patch("/api/scenes/{scene_id}", response_model=SceneResponse)
async def update_scene(
    scene_id: uuid.UUID,
    data: SceneUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    scene = await video_service.update_scene(
        db,
        scene_id,
        data.model_dump(exclude_unset=True),
    )
    await db.commit()
    await db.refresh(scene)
    return SceneResponse.from_scene(scene)


@router.delete("/api/scenes/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(
    scene_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await video_service.delete_scene(db, scene_id)
    await db.commit()


@router.post("/api/scenes/{scene_id}/refine-dialogue", response_model=SceneAiDialogueResponse)
async def refine_dialogue(
    scene_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Use AI to tighten and improve the scene's current dialogue."""
    scene = await video_service.get_scene(db, scene_id)
    try:
        refined = await refine_scene_dialogue(scene.dialogue, scene.name)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI dialogue refinement failed. Please try again.",
        )
    return {"dialogue": refined}


@router.post("/api/scenes/{scene_id}/suggest-setting", response_model=SceneAiSettingResponse)
async def suggest_setting(
    scene_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Use AI to suggest a vivid visual setting for the scene based on its dialogue."""
    scene = await video_service.get_scene(db, scene_id)
    try:
        setting = await suggest_scene_setting(scene.dialogue, scene.name)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI setting suggestion failed. Please try again.",
        )
    return {"setting": setting}
