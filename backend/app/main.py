from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.hierarchy import router as hierarchy_router
from app.api.projects import router as projects_router
from app.api.brand_library import router as brand_library_router
from app.api.project_members import router as project_members_router
from app.api.users import router as users_router
from app.api.suggestions import router as suggestions_router
from app.api.artifacts import router as artifacts_router
from app.api.ai import router as ai_router
from app.api.uploads import router as uploads_router
from app.api.compliance import router as compliance_router
from app.api.notifications import router as notifications_router
from app.api.brand_kit import router as brand_kit_router
from app.api.exports import router as exports_router
from app.api.gamification import router as gamification_router
from app.api.analytics import router as analytics_router
from app.api.comments import router as comments_router
from app.api.presenters import router as presenters_router
from app.api.video_sessions import router as video_sessions_router
from app.api.scenes import router as scenes_router
from app.api.generated_videos import router as generated_videos_router
from app.api.poster import router as poster_router
from app.api.poster_ai import router as poster_ai_router
from app.api.studio import router as studio_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    import asyncio
    import logging as _logging
    _log = _logging.getLogger(__name__)

    # Startup: warm up Vertex AI client before the event loop starts handling requests.
    # _get_vertex_client() reads a service-account key file synchronously. Running it now
    # (before connections arrive) avoids blocking the async event loop on the first AI call,
    # which would cause ECONNRESET on ALL concurrent requests during that blocking period.
    try:
        from app.services.ai_service import _get_vertex_client
        await asyncio.to_thread(_get_vertex_client)
        _log.info("Vertex AI client initialized at startup")
    except Exception as exc:
        _log.warning("Vertex AI client not available (AI features will be limited): %s", exc)

    # Startup: mark any orphaned QUEUED/RENDERING videos as FAILED
    from app.core.database import async_session
    from app.services.video_generation_service import mark_orphans_failed
    async with async_session() as db:
        count = await mark_orphans_failed(db)
        if count:
            _log.warning(
                "Startup sweep: marked %d orphaned video generation job(s) as FAILED", count
            )

    # Startup: same cleanup for My Studio workflow runs.
    from app.services.studio_generation_service import (
        mark_orphans_failed as studio_mark_orphans_failed,
    )
    try:
        flipped = await studio_mark_orphans_failed(async_session)
        if flipped:
            _log.warning(
                "Startup sweep: marked %d orphaned studio run(s) as FAILED", flipped
            )
    except Exception as exc:  # noqa: BLE001 — boot must not fail on sweep errors
        _log.warning("studio orphan sweep skipped: %s", exc)

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

# CORS — whitelist frontend origin.
# Also allow 127.0.0.1 variant so browsers that resolve localhost to IPv6 or
# navigate via the numeric address don't get blocked in development.
_allowed_origins = [settings.FRONTEND_URL]
_frontend_base = settings.FRONTEND_URL.replace("localhost", "127.0.0.1")
if _frontend_base not in _allowed_origins:
    _allowed_origins.append(_frontend_base)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(hierarchy_router)
app.include_router(projects_router)
app.include_router(brand_library_router)
app.include_router(project_members_router)
app.include_router(users_router)
app.include_router(suggestions_router)
app.include_router(artifacts_router)
app.include_router(ai_router)
app.include_router(uploads_router)
app.include_router(compliance_router)
app.include_router(notifications_router)
app.include_router(brand_kit_router)
app.include_router(exports_router)
app.include_router(gamification_router)
app.include_router(analytics_router)
app.include_router(comments_router)
app.include_router(presenters_router)
app.include_router(video_sessions_router)
app.include_router(scenes_router)
app.include_router(generated_videos_router)
app.include_router(poster_router)
app.include_router(poster_ai_router)
app.include_router(studio_router)

# Serve uploaded files in development
uploads_path = Path(__file__).parent.parent / "uploads"
uploads_path.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
