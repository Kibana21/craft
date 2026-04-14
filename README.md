# CRAFT

AI-powered content creation platform for AIA Singapore. Two audiences from one app: internal staff (Creator mode) and Financial Service Consultants (Agent mode).

**Tech stack**: Next.js 16 + React 19 + MUI v9 + TanStack Query (frontend) · FastAPI 0.115 + SQLAlchemy 2.0 async + PostgreSQL + Redis + Celery (backend) · Google Gemini + Vertex AI (Veo) for AI.

## Quick start

```bash
# 1. Backend deps
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in GOOGLE_API_KEY, JWT_SECRET, etc.

# 2. Infrastructure (Postgres + Redis)
cd ..
docker-compose up -d

# 3. Database
make migrate                  # apply Alembic migrations
make seed                     # 8 test users + brand kit + compliance rules

# 4. Frontend deps
cd frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local

# 5. Run the app (each in its own terminal)
make backend                  # uvicorn dev server (--reload)
make frontend                 # Next dev server
make worker                   # Celery worker for video/poster/studio queues
```

Open <http://localhost:3000> → log in with `sarah.lim@aia.com.sg` / `craft2026`.

> **Demo day?** Run `make backend-demo` instead of `make backend` (no `--reload`, no ECONNRESET on file save). Walk through `docs/PRE_DEMO_CHECKLIST.md` first.

## Make targets

| Target | What it does |
|---|---|
| `make backend` | Dev server with auto-reload (don't use during a live demo) |
| `make backend-demo` | Stable server, no reload — use for presentations |
| `make frontend` | Next.js dev server on :3000 |
| `make worker` | Celery worker on `video,poster,studio,celery` queues |
| `make flower` | Flower task monitor on :5555 |
| `make migrate` | Alembic upgrade head |
| `make migrate-new MSG="..."` | Generate a new migration |
| `make seed` | Reset + seed test data |
| `make test` | Backend pytest + frontend tsc |
| `make lint` | ruff + mypy + eslint |
| `make clean-uploads` | Wipe `backend/uploads/poster-variants/*` and `studio/*` (pre-demo hygiene) |

## Architecture at a glance

- **Frontend**: App Router pages under `(authenticated)/`. Server state via TanStack Query. Wizards (poster, video, studio) live under `projects/[id]/artifacts/`. My Studio at `/my-studio`.
- **Backend**: FastAPI app in `backend/app/` with 22+ routers and ~36 services. Models in `app/models/`, Pydantic in `app/schemas/`. Async SQLAlchemy throughout.
- **AI**: Gemini 2.5 Flash for text + image. Vertex AI Veo for video. All AI calls happen server-side; no API keys reach the browser.
- **Background work**: Celery on three queues — `video` for Veo scene gen, `poster` for poster image gen, `studio` for My Studio enhancement runs. Frontend polls the run row for status.

## Documentation

- `CLAUDE.md` — root: project overview, conventions, models, API surface
- `backend/CLAUDE.md` — backend conventions, services, routes, security checklist
- `frontend/CLAUDE.md` — frontend patterns (TanStack Query, error banners, components, design tokens)
- `.claude/specs/POSTER_WIZARD_PRD.md` — poster wizard product spec
- `.claude/specs/CRAFT_MY_STUDIO_PRD.md` — My Studio product spec
- `.claude/plans/poster-generation/` — poster wizard implementation plans (Phase A–E)
- `.claude/plans/my_studio/` — My Studio implementation plans
- `.claude/plans/reliability-hardening.md` — current tech-debt + reliability roadmap
- `docs/PRE_DEMO_CHECKLIST.md` — 10-item pre-flight before any live demo

## Test accounts (seed.py — password: `craft2026`)

| Email | Role |
|---|---|
| sarah.lim@aia.com.sg | BRAND_ADMIN |
| james.tan@aia.com.sg | BRAND_ADMIN |
| david.lee@aia.com.sg | DISTRICT_LEADER |
| rachel.wong@aia.com.sg | DISTRICT_LEADER |
| michael.ng@aia.com.sg | AGENCY_LEADER |
| priya.kumar@aia.com.sg | AGENCY_LEADER |
| maya.chen@agent.aia.com.sg (FSC-1001) | FSC |
| alex.ong@agent.aia.com.sg (FSC-1002) | FSC |

Don't screenshare the source — that password is hardcoded in `backend/scripts/seed.py`.
