import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.artifact import Artifact
from app.models.video_session import VideoSession
from app.schemas.video_session import AssignPresenterRequest, BriefImproveRequest, VideoSessionResponse
from app.schemas.video_script import (
    ScriptResponse,
    ScriptUpdateRequest,
    ScriptDraftRequest,
    ScriptRewriteRequest,
    ScriptVersionResponse,
)
from app.schemas.scene import SceneResponse, SceneListResponse, SceneInsertRequest
from app.schemas.generated_video import GeneratedVideoResponse, GeneratedVideoListResponse
from app.services import presenter_service, video_session_service
from app.services import video_script_service
from app.services import video_service
from app.services import video_generation_service

router = APIRouter(tags=["video-sessions"])


@router.get("/api/video-sessions/{session_id}", response_model=VideoSessionResponse)
async def get_video_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    return await video_session_service.get_by_id(db, session_id)


@router.patch(
    "/api/video-sessions/{session_id}/presenter",
    response_model=VideoSessionResponse,
)
async def assign_presenter(
    session_id: uuid.UUID,
    data: AssignPresenterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    # Validate request: must supply either presenter_id OR inline fields
    if data.presenter_id is None and data.name is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either presenter_id (library) or presenter fields (inline create)",
        )

    if data.presenter_id is not None:
        # Library path: verify presenter is accessible to the user
        await presenter_service.get_by_id(db, data.presenter_id, current_user)
        presenter_id = data.presenter_id
    else:
        # Inline-create path: requires all fields
        required = ["name", "age_range", "appearance_keywords", "full_appearance_description", "speaking_style"]
        missing = [f for f in required if getattr(data, f) is None]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing fields for inline presenter creation: {missing}",
            )

        from app.schemas.presenter import PresenterCreate

        create_data = PresenterCreate(
            name=data.name,  # type: ignore[arg-type]
            age_range=data.age_range,  # type: ignore[arg-type]
            appearance_keywords=data.appearance_keywords,  # type: ignore[arg-type]
            full_appearance_description=data.full_appearance_description,  # type: ignore[arg-type]
            speaking_style=data.speaking_style,  # type: ignore[arg-type]
            is_library=data.save_to_library,
        )
        presenter = await presenter_service.create(db, current_user, create_data)
        presenter_id = presenter.id

    session = await video_session_service.assign_presenter(db, session_id, presenter_id)
    await db.commit()
    await db.refresh(session)
    return session


# ── Script endpoints ─────────────────────────────────────────────────────────

@router.get("/api/video-sessions/{session_id}/script", response_model=ScriptResponse)
async def get_script(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    script = await video_script_service.get_or_create_script(db, session_id)
    await db.commit()
    return script


@router.patch("/api/video-sessions/{session_id}/script", response_model=ScriptResponse)
async def update_script(
    session_id: uuid.UUID,
    data: ScriptUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    script = await video_script_service.update_content(db, session_id, data.content)
    await db.commit()
    await db.refresh(script)
    return script


@router.post(
    "/api/video-sessions/{session_id}/script/draft",
    response_model=ScriptResponse,
)
async def draft_script(
    session_id: uuid.UUID,
    data: ScriptDraftRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    overrides = data.model_dump(exclude_none=True) if data else None
    try:
        script = await video_script_service.draft_from_brief(db, session_id, overrides)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI script generation failed. Please try again.",
        )
    await db.commit()
    await db.refresh(script)
    return script


@router.post(
    "/api/video-sessions/{session_id}/script/rewrite",
    response_model=ScriptResponse,
)
async def rewrite_script(
    session_id: uuid.UUID,
    data: ScriptRewriteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    try:
        script = await video_script_service.rewrite(db, session_id, data.tone)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI rewrite failed. Please try again.",
        )
    await db.commit()
    await db.refresh(script)
    return script


@router.get(
    "/api/video-sessions/{session_id}/script-versions",
    response_model=list[ScriptVersionResponse],
)
async def list_script_versions(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    versions = await video_script_service.list_versions(db, session_id)
    return [ScriptVersionResponse.from_version(v) for v in versions]


@router.post(
    "/api/video-sessions/{session_id}/script-versions/{version_id}/restore",
    response_model=ScriptResponse,
)
async def restore_script_version(
    session_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    script = await video_script_service.restore(db, session_id, version_id)
    await db.commit()
    await db.refresh(script)
    return script


# ── Scene endpoints ───────────────────────────────────────────────────────────

@router.post(
    "/api/video-sessions/{session_id}/scenes/generate",
    response_model=list[SceneResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_scenes(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    try:
        scenes = await video_service.generate_scenes(db, session_id)
        # Serialize BEFORE commit — objects are expired after commit in async SQLAlchemy
        response = [SceneResponse.from_scene(s) for s in scenes]
        await db.commit()
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI scene generation failed. Please try again.",
        )
    return response


@router.post(
    "/api/video-sessions/{session_id}/scenes/regenerate",
    response_model=list[SceneResponse],
)
async def regenerate_scenes(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    try:
        scenes = await video_service.regenerate_scenes(db, session_id)
        # Serialize BEFORE commit — objects are expired after commit in async SQLAlchemy
        response = [SceneResponse.from_scene(s) for s in scenes]
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI scene regeneration failed. Please try again.",
        )
    await db.commit()
    return response


@router.get(
    "/api/video-sessions/{session_id}/scenes",
    response_model=SceneListResponse,
)
async def list_scenes(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = await video_service.list_scenes(db, session_id)
    return {
        "scenes": [SceneResponse.from_scene(s) for s in data["scenes"]],
        "scenes_script_version_id": data["scenes_script_version_id"],
        "current_script_version_id": data["current_script_version_id"],
    }


@router.post(
    "/api/video-sessions/{session_id}/scenes",
    response_model=SceneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def insert_scene(
    session_id: uuid.UUID,
    data: SceneInsertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    scene = await video_service.insert_scene(
        db,
        session_id,
        position=data.position,
        name=data.name,
        dialogue=data.dialogue,
        setting=data.setting,
        camera_framing=data.camera_framing,
    )
    await db.commit()
    await db.refresh(scene)
    return SceneResponse.from_scene(scene)


# ── Video generation endpoints ────────────────────────────────────────────────

@router.post(
    "/api/video-sessions/{session_id}/generate",
    response_model=GeneratedVideoResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_generation(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    # Resolve project_id from session → artifact
    vs_result = await db.execute(
        select(VideoSession).where(VideoSession.id == session_id)
    )
    vs = vs_result.scalar_one_or_none()
    if vs is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video session not found")

    art_result = await db.execute(
        select(Artifact.project_id).where(Artifact.id == vs.artifact_id)
    )
    project_id = art_result.scalar_one_or_none()
    if project_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    generated_video = await video_generation_service.trigger(db, session_id, project_id)
    await db.commit()
    await db.refresh(generated_video)

    from app.services.video_generation_worker import generate_video_task
    background_tasks.add_task(generate_video_task, generated_video.id)

    return generated_video


@router.get(
    "/api/video-sessions/{session_id}/videos",
    response_model=GeneratedVideoListResponse,
)
async def list_generated_videos(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = await video_generation_service.list_for_session(db, session_id)
    return {
        "videos": data["videos"],
        "any_active": data["any_active"],
    }


@router.post("/api/video-sessions/{session_id}/brief/draft")
async def draft_brief(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate AI-suggested brief content using the project brief as context."""
    from app.models.project import Project

    vs = await video_session_service.get_by_id(db, session_id)

    art_result = await db.execute(select(Artifact).where(Artifact.id == vs.artifact_id))
    artifact = art_result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    proj_result = await db.execute(select(Project).where(Project.id == artifact.project_id))
    project = proj_result.scalar_one_or_none()
    project_brief = (project.brief or {}) if project else {}

    from app.services.ai_service import generate_video_brief
    return await generate_video_brief(project_brief=project_brief, video_name=artifact.name)


@router.post("/api/video-sessions/{session_id}/brief/improve")
async def improve_brief_field(
    session_id: uuid.UUID,
    data: BriefImproveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Improve a single brief field (or generate the narrative brief) using the full form as context."""
    await video_session_service.get_by_id(db, session_id)  # auth / existence check
    from app.services.ai_service import improve_brief_field as ai_improve
    value = await ai_improve(field=data.field, context=data.model_dump())
    return {"value": value}
