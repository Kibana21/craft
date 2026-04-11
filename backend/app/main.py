from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.hierarchy import router as hierarchy_router
from app.api.projects import router as projects_router
from app.api.brand_library import router as brand_library_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

# CORS — whitelist frontend origin only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
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
