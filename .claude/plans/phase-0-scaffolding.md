# Phase 0: Monorepo Scaffolding & Dev Environment

**Goal:** Runnable baseline with both frontend and backend skeletons, Docker Compose for local dev.

**User stories:** None (infrastructure only)

**Dependencies:** None — this is the foundation.

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/__init__.py` | Package init |
| `backend/app/main.py` | FastAPI app factory; mounts routers, CORS, lifespan events |
| `backend/app/core/__init__.py` | Package init |
| `backend/app/core/config.py` | Pydantic `Settings` (DATABASE_URL, REDIS_URL, S3_BUCKET, GOOGLE_API_KEY, JWT_SECRET) |
| `backend/app/core/database.py` | Async SQLAlchemy engine, sessionmaker, `get_db` dependency |
| `backend/app/core/redis.py` | Redis connection pool, `get_redis` dependency |
| `backend/app/api/__init__.py` | Package init |
| `backend/app/api/health.py` | `GET /api/health` with DB + Redis status |
| `backend/app/models/__init__.py` | Package init; re-exports all models for Alembic auto-detect |
| `backend/app/models/base.py` | Declarative base with UUID id, created_at, updated_at |
| `backend/app/schemas/__init__.py` | Package init |
| `backend/app/services/__init__.py` | Package init |
| `backend/alembic.ini` | Alembic config pointing at `backend/alembic/` |
| `backend/alembic/env.py` | Alembic env referencing `app.models` metadata, async driver |
| `backend/alembic/script.py.mako` | Migration template |
| `backend/requirements.txt` | fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic-settings, redis, python-jose[cryptography], passlib[bcrypt], boto3, pillow, cairosvg, ffmpeg-python, google-generativeai, google-cloud-aiplatform, langchain, langchain-community, pgvector, httpx, pytest, pytest-asyncio, mypy |
| `backend/Dockerfile` | Python 3.12 slim, pip install, uvicorn entrypoint |
| `backend/pyproject.toml` | mypy + ruff config |
| `backend/tests/__init__.py` | Test package init |
| `backend/tests/conftest.py` | pytest fixtures: test DB session, test client (httpx.AsyncClient) |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/package.json` | next 15, react 19, typescript, tailwindcss, @tailwindcss/postcss, shadcn deps, scripts: dev, build, typecheck, lint |
| `frontend/tsconfig.json` | Strict TypeScript config with path aliases (`@/` → `src/`) |
| `frontend/next.config.ts` | Next.js config; rewrites `/api/*` to backend in dev |
| `frontend/postcss.config.mjs` | PostCSS with `@tailwindcss/postcss` plugin |
| `frontend/src/app/globals.css` | Tailwind directives + AIA brand CSS vars (--aia-red: #D0103A, --aia-dark: #1A1A18, --aia-warm-gray: #F0EDE6, --aia-green: #1B9D74, --aia-purple: #534AB7) |
| `frontend/src/app/layout.tsx` | Root layout with font loading (Inter or Geist), metadata |
| `frontend/src/app/page.tsx` | Redirect to `/login` if unauthenticated, otherwise `/home` |
| `frontend/src/lib/api-client.ts` | Typed fetch wrapper: base URL from env, auto-attaches JWT, handles 401 redirect |
| `frontend/src/lib/utils.ts` | shadcn `cn()` utility |
| `frontend/src/types/index.ts` | Shared TypeScript types (grows per phase) |
| `frontend/src/components/ui/button.tsx` | shadcn button (first component to validate setup) |
| `frontend/components.json` | shadcn/ui config |
| `frontend/.env.local.example` | NEXT_PUBLIC_API_URL=http://localhost:8000 |
| `frontend/Dockerfile` | Node 20, next build, next start |

## Root-level files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Services: postgres (pgvector image), redis, backend, frontend. Volumes for DB persistence. Ports 3000, 8000 |
| `.gitignore` | Python (__pycache__, .venv), Node (node_modules, .next), env files |
| `CLAUDE.md` | Updated with project structure, build commands, conventions |
| `Makefile` | Convenience targets: `make dev`, `make migrate`, `make seed`, `make test` |

## Key implementation details

- PostgreSQL must use the `pgvector/pgvector` Docker image so the `vector` extension is available from Phase 1.
- FastAPI must use lifespan context manager (not deprecated `on_event`) to init/teardown DB engine and Redis pool.
- `api-client.ts` should be a thin wrapper around `fetch` (not axios) to minimize bundle size. Returns typed responses via generics: `apiClient.get<Project[]>("/api/projects")`.
- shadcn/ui: initialize with "new-york" style, map AIA brand colors into CSS variables in `globals.css`.

## Verification

- `cd backend && uvicorn app.main:app --reload` starts without errors
- `GET http://localhost:8000/api/health` returns 200
- `cd frontend && npm run dev` starts without errors
- `http://localhost:3000` loads the root page
- `docker-compose up` brings up all services
