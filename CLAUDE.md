# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CRAFT is an AI-powered content creation platform for AIA Singapore. Two audiences from one app: internal staff (Creator mode) and Financial Service Consultants (Agent mode). Role detected at login via JWT.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Material UI 9 + shadcn/ui + Recharts
- **Backend:** FastAPI 0.115 (Python 3.12+) + SQLAlchemy 2.0 (async) + Alembic + Pydantic
- **Database:** PostgreSQL with pgvector extension
- **Auth:** Hardcoded login with JWT (Microsoft Entra ID planned later). Access token in localStorage, refresh token logic in `frontend/src/lib/auth.ts`.
- **AI:** Google Gemini (text generation, compliance scoring) + Google Imagen 3 (image generation) + LangChain + pgvector (compliance RAG — infrastructure ready, full implementation pending)
- **Storage:** AWS S3 / Cloudflare R2 (boto3 wired; falls back to local for dev)
- **Cache:** Redis 7 (leaderboard sorted sets; future session caching)
- **Rendering:** Pillow (PNG/JPG export) + ffmpeg-python (MP4 reels)

## Mandatory Standards

**Always follow these skill files when writing code:**

- `.claude/skills/security.md` — JWT handling, password hashing, CORS, rate limiting, input validation, RBAC enforcement. Every API endpoint must be secured.
- `.claude/skills/postgres.md` — Schema design, indexing (especially FK indexes), async SQLAlchemy 2.0 patterns, migration practices, connection pooling.
- `.claude/skills/ui-design.md` — AIA brand colors, typography, component patterns, two-mode design (Creator dark nav, Agent light nav), responsive behavior.

## Specs & Plans

- `.claude/specs/` — PRD (`prd-craft.md`), HTML wireframes, and functional requirements (source of truth for features)
- `.claude/plans/` — Phase 0–8 implementation plans with dependency graph in `README.md`
- `.claude/specs/unimplemented-features.md` — Deferred features and their priority order

## Project Structure

```
craft/
├── backend/                    # FastAPI app
│   ├── app/
│   │   ├── api/                # 18 route handlers (auth, projects, artifacts, ai, compliance, …)
│   │   ├── models/             # 18 SQLAlchemy models
│   │   ├── schemas/            # 18 Pydantic request/response DTOs
│   │   ├── services/           # 20 service modules (business logic)
│   │   └── core/               # config.py, auth.py, database.py, redis.py, rbac.py
│   ├── alembic/versions/       # 4 migration files
│   ├── scripts/                # seed.py (test users + data)
│   └── tests/
├── frontend/                   # Next.js app
│   └── src/
│       ├── app/                # 16 App Router pages
│       │   └── (authenticated)/  # Protected layout (auth guard + nav)
│       ├── components/         # 42 React TSX components
│       ├── lib/                # api-client.ts, auth.ts, theme.ts
│       │   └── api/            # 14 typed API client modules
│       └── types/              # 10 TypeScript type files
└── docker-compose.yml          # Redis only (PostgreSQL runs locally)
```

## Commands

```bash
# Dev
make backend                # uvicorn app.main:app --reload --port 8000
make frontend               # cd frontend && npm run dev
docker-compose up -d        # Start Redis

# Database
make migrate                # alembic upgrade head
make migrate-new MSG="..."  # Create new migration
make seed                   # python -m scripts.seed (test users + data)

# Quality
make test                   # pytest + frontend typecheck
make test-backend           # pytest only
make test-frontend          # cd frontend && npm run typecheck
make lint                   # ruff + mypy + eslint
```

## Key Conventions

- Backend API prefix: `/api/`
- Auth: JWT in `Authorization: Bearer <token>` header. Access token stored in localStorage; refresh handled client-side in `frontend/src/lib/auth.ts`.
- All UUIDs generated server-side (`uuid4()`), not database-side.
- Soft deletes via `deleted_at` timestamp column (never hard-delete).
- Async SQLAlchemy throughout — use `AsyncSession`, `select()` API, `selectinload()` for relationships.
- Every FK column must have an explicit database index (e.g., `idx_artifacts_project_id`).
- Artifact `content` and project `brief` are JSONB columns for flexible schema.
- Background tasks via FastAPI `BackgroundTasks` (gamification points, compliance scoring).

## Data Models

Core entities and their relationships:

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `User` | id, name, email, hashed_password, role, agent_id | Roles: BRAND_ADMIN, DISTRICT_LEADER, AGENCY_LEADER, FSC |
| `Project` | id, name, type, purpose, owner_id, brand_kit_id, brief (JSONB), status | Types: PERSONAL / TEAM |
| `ProjectMember` | project_id, user_id, role | OWNER or MEMBER |
| `Artifact` | id, project_id, creator_id, type, content (JSONB), compliance_score, status, version | Types: POSTER, WHATSAPP_CARD, REEL, STORY, VIDEO, DECK, INFOGRAPHIC |
| `BrandKit` | id, name, primary_color, secondary_color, logo_url, font_url | Scoped per project |
| `BrandLibraryItem` | id, name, artifact_type, content (JSONB), status, submitted_by_id | Status: PENDING_REVIEW → APPROVED → PUBLISHED |
| `ComplianceRule` | id, rule_text, category, severity (ERROR/WARNING), is_active | Managed by BRAND_ADMIN |
| `ComplianceDocument` | id, title, content, document_type, chunk_index | For RAG (MAS regs, disclaimers) |
| `ComplianceCheck` | id, artifact_id, score (0–100), violations | Gemini-based scoring |
| `ExportLog` | id, artifact_id, user_id, format, status, download_url | Audit trail |
| `UserPoints` / `PointsLog` | total_points, current_streak, longest_streak | Gamification |
| `Comment` | id, artifact_id, user_id, text | Team feedback threads |
| `Notification` | id, user_id, type, related_id, is_read | In-app alerts |

## API Surface

18 routers, 80+ endpoints, all under `/api/`:

| Router | Endpoints |
|--------|-----------|
| `auth` | POST /login, /refresh, /logout |
| `users` | GET /me |
| `projects` | GET/POST /projects, GET/PATCH /projects/{id} |
| `project_members` | GET/POST /projects/{id}/members |
| `artifacts` | GET/POST /projects/{id}/artifacts, GET/PATCH /artifacts/{id} |
| `ai` | POST /ai/generate/{type} |
| `suggestions` | GET/POST /projects/{id}/suggestions |
| `uploads` | POST /uploads/photo, /uploads/image |
| `brand_kit` | GET/POST /brand-kit |
| `brand_library` | GET/POST /brand-library, POST /brand-library/{id}/submit |
| `compliance` | GET/POST /compliance/rules, /documents, POST /compliance/check-artifact |
| `exports` | POST /artifacts/{id}/export |
| `comments` | GET/POST /artifacts/{id}/comments |
| `notifications` | GET /notifications, POST /notifications/{id}/read |
| `gamification` | GET /gamification/user-stats, /leaderboard |
| `analytics` | GET /analytics/overview, /activity, /content-gaps |

## Frontend Pages

```
/login                              # Hardcoded test accounts
/home                               # Creator/Agent home (role-aware tabs + quick-create)
/projects/new                       # 5-step project wizard
/projects/[id]                      # Project detail + artifact grid
/projects/artifacts/new             # Artifact type selector + creator (poster/reel/whatsapp)
/projects/artifacts/[artifactId]    # Artifact detail, compliance score, export
/brand-kit                          # Brand colors, fonts, logo upload
/brand-library                      # Browse & remix approved content
/brand-library/[id]                 # Library item detail
/compliance/review                  # Review queue (stub — deferred)
/compliance/rules                   # Admin: manage compliance rules
/compliance/documents               # Admin: upload MAS documents
/leaderboard                        # Points, streaks, leaderboard
```

## Implementation Status

**Complete (MVP):**
- Auth & RBAC (hardcoded login, JWT, role enforcement)
- Projects CRUD + 5-step wizard + team membership
- Artifact CRUD + versioning + 3 creator types (poster, reel, WhatsApp card)
- AI generation (Gemini text + Imagen images) + project suggestions
- Brand kit (colors, fonts, logos)
- Brand library (submit → review → publish workflow)
- Compliance engine (rules CRUD, document upload, Gemini scoring)
- Export pipeline (PNG/JPG via Pillow, MP4 via ffmpeg, S3/local)
- Gamification (points log in PostgreSQL, streaks, Redis leaderboard)
- Analytics (overview metrics, activity trends, content gaps, top remixed)
- Comments + notifications

**Deferred (Phase 2 — see `.claude/specs/unimplemented-features.md`):**
1. Artifact editor (edit headlines, swap images, regenerate, save as version)
2. Compliance review queue UI (surface pending + low-score artifacts)
3. FSC photo compositing (profile headshot blending per artifact)
4. Invite members step in project creation wizard
5. District Leader team oversight view
6. Project-level shared assets panel
7. Reel animated preview (currently static storyboard)
8. Hierarchy API (mock only; requires AIA network access)
