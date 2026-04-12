# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CRAFT is an AI-powered content creation platform for AIA Singapore. Two audiences from one app: internal staff (Creator mode) and Financial Service Consultants (Agent mode). Role detected at login via JWT.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + MUI v9 + Recharts
- **Backend:** FastAPI 0.115 (Python 3.12+) + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2
- **Database:** PostgreSQL with pgvector extension
- **Auth:** Hardcoded login with JWT (HS256). Access token in `sessionStorage`; refresh token in `localStorage`. See `frontend/src/lib/auth.ts`.
- **AI:** Google Gemini (`gemini-2.5-flash`) for text + `gemini-2.5-flash-image` for image generation. Google Veo (`veo-3.1-generate-001`) via Vertex AI for video. LangChain + pgvector for compliance RAG.
- **Video rendering:** Scene-by-scene Veo generation → ffmpeg concat → MP4. Celery worker on `"video"` queue.
- **Export rendering:** Pillow (PNG/JPG compositing) + ffmpeg-python (MP4 reels).
- **Storage:** AWS S3 / Cloudflare R2 (boto3; falls back to local `/uploads/` for dev).
- **Cache:** Redis 7 — leaderboard sorted sets + Celery broker/backend.

## Mandatory Standards

**Always follow these skill files when writing code:**

- `.claude/skills/security.md` — JWT handling, password hashing, CORS, rate limiting, input validation, RBAC enforcement. Every API endpoint must be secured.
- `.claude/skills/postgres.md` — Schema design, indexing (especially FK indexes), async SQLAlchemy 2.0 patterns, migration practices, connection pooling.
- `.claude/skills/ui-design.md` — AIA brand colors, typography, component patterns, two-mode design (Creator nav vs Agent nav), responsive behavior.

## Specs & Plans

- `.claude/specs/` — PRDs, HTML wireframes, and functional requirements (source of truth for features)
- `.claude/plans/` — Phase 0–8 implementation plans with dependency graph in `README.md`
- `.claude/plans/poster-generation/` — Poster Wizard planning package (12 docs, Phase A–E)
- `.claude/specs/unimplemented-features.md` — Deferred features and their priority order

## Project Structure

```
craft/
├── backend/                     # FastAPI app (see backend/CLAUDE.md for full detail)
│   ├── app/
│   │   ├── main.py              # App entry, lifespan, CORS, 22 routers mounted
│   │   ├── celery_app.py        # Celery config (Redis broker, "video" queue)
│   │   ├── core/                # config.py, auth.py, database.py, rbac.py
│   │   ├── api/                 # 22 route files
│   │   ├── models/              # 20 SQLAlchemy models + enums
│   │   ├── schemas/             # Pydantic DTOs
│   │   └── services/            # 30+ business-logic modules
│   ├── alembic/versions/        # 7 migration files (current HEAD: 53f0e01db9b9)
│   ├── scripts/seed.py          # 8 test users + brand kit + compliance rules
│   └── tests/
├── frontend/                    # Next.js app (see frontend/CLAUDE.md for full detail)
│   └── src/
│       ├── app/                 # App Router pages (all "use client", no SSR)
│       │   └── (authenticated)/ # Protected layout group (auth guard + nav)
│       ├── components/          # React TSX components organised by domain
│       ├── hooks/               # useVideoPolling
│       ├── lib/
│       │   ├── api-client.ts    # HTTP client singleton (Bearer token injection, 401 redirect)
│       │   ├── auth.ts          # Token storage, JWT decode, role helpers
│       │   ├── theme.ts         # MUI theme (all design tokens)
│       │   └── api/             # 14 typed API client modules (one per domain)
│       └── types/               # TypeScript interfaces (one file per domain)
└── docker-compose.yml           # Redis only (PostgreSQL runs locally)
```

## Commands

```bash
# Dev
make backend                # uvicorn app.main:app --reload --port 8000
make frontend               # cd frontend && npm run dev
docker-compose up -d        # Start Redis

# Video worker (required for video generation)
make worker                 # celery -A app.celery_app worker --queues=video -l info
make flower                 # Celery Flower at http://localhost:5555

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

### Backend
- API prefix: `/api/`. All endpoints require `Depends(get_current_user)` unless noted.
- JWT: HS256, access token 60 min, refresh token 7 days. `get_current_user` dependency fetches User from DB.
- All UUIDs generated server-side (`uuid4()`), never DB-side.
- Soft deletes via `deleted_at` timestamp — never hard-delete user-facing rows.
- Async SQLAlchemy throughout — `AsyncSession`, `select()` API, `selectinload()` for relationships.
- Every FK column must have an explicit index.
- JSONB columns (`artifacts.content`, `projects.brief`, `brand_kit.fonts`, `notifications.data`) — validate at API boundary with Pydantic.
- Enums stored as strings (`str, enum.Enum`).
- Background tasks: FastAPI `BackgroundTasks` for lightweight work (compliance scoring, points); Celery for heavy/long-running work (video generation).

### Frontend
- All pages/components use `"use client"`. No server components, no RSC data-fetching.
- MUI `sx` prop only — no Tailwind utility classes, no CSS modules for new code.
- No form library — use `useState` per field.
- No Redux / Zustand — React Context for global state (`AuthProvider`, `VideoWizardContext`).
- Path alias `@/` maps to `src/`.
- Access token stored in `sessionStorage`; refresh token in `localStorage`.

## Design Tokens (frontend)

| Token | Value | Use |
|---|---|---|
| Primary red | `#D0103A` | Buttons, active states, AIA accent |
| Hover red | `#A00D2E` | Hover on primary |
| Success | `#188038` | Completed wizard steps |
| Border | `#E8EAED` | Card borders, dividers |
| Muted text | `#5F6368` | Secondary labels |
| Surface | `#F7F7F7` | Pill backgrounds, subtle fills |

Buttons: fully rounded (`borderRadius: 9999`), `textTransform: "none"`, `disableElevation`.
Cards: `border: "1px solid #E8EAED"`, `borderRadius: "16px"`, white background.

## Data Models

| Model | Table | Key Fields | Notes |
|---|---|---|---|
| `User` | `users` | name, email (unique), hashed_password, role, agent_id | Roles: BRAND_ADMIN, DISTRICT_LEADER, AGENCY_LEADER, FSC |
| `Project` | `projects` | name, type, purpose, owner_id, brand_kit_id, brief (JSONB), status, deleted_at | Types: PERSONAL / TEAM |
| `ProjectMember` | `project_members` | project_id, user_id, role | OWNER or MEMBER |
| `Artifact` | `artifacts` | project_id, creator_id, type, name, content (JSONB), channel, format, compliance_score, status, version, deleted_at | 8 types; one-to-one with VideoSession for VIDEO/REEL |
| `VideoSession` | `video_sessions` | artifact_id (unique), presenter_id, current_step, target_duration_seconds, current_script_id, scenes_script_version_id | Steps: PRESENTER → SCRIPT → STORYBOARD → GENERATION |
| `VideoScript` | `video_scripts` | video_session_id (one per session, updated in-place), content, word_count | |
| `ScriptVersion` | `script_versions` | video_session_id, content, action | Immutable snapshots — never updated |
| `Scene` | `scenes` | video_session_id, sequence, name, dialogue, setting, camera_framing, merged_prompt | (session, sequence) unique DEFERRABLE |
| `GeneratedVideo` | `generated_videos` | video_session_id, version, status, progress_percent, file_url | QUEUED → RENDERING → READY / FAILED |
| `Presenter` | `presenters` | name, age_range, appearance_keywords, full_appearance_description, speaking_style, is_library | |
| `BrandKit` | `brand_kit` | primary_color (#D0103A), secondary_color, accent_color, logo_url, fonts (JSONB) | |
| `BrandLibraryItem` | `brand_library_items` | artifact_id (unique), status, remix_count | PENDING_REVIEW → APPROVED → PUBLISHED |
| `ComplianceRule` | `compliance_rules` | rule_text, category, severity (ERROR/WARNING), is_active | Partial index on active rules |
| `ComplianceDocument` | `compliance_documents` | title, content, document_type, chunk_index | RAG source (MAS regs, disclaimers) |
| `ComplianceCheck` | `compliance_checks` | artifact_id, score (0–100), breakdown (JSONB) | |
| `ExportLog` | `export_logs` | artifact_id, user_id, format, status, download_url | Audit trail |
| `UserPoints` | `user_points` | user_id (unique), total_points, current_streak, longest_streak | |
| `PointsLog` | `points_log` | user_id, action, points, related_artifact_id | CREATE_ARTIFACT=10, EXPORT=20, REMIX=15, VIDEO_GENERATED=50 |
| `Comment` | `comments` | artifact_id, user_id, text | |
| `Notification` | `notifications` | user_id, type, title, data (JSONB), read | Partial index on unread |

## API Surface

22 routers, 100+ endpoints, all under `/api/`:

| Router | Key Endpoints |
|---|---|
| `auth` | POST /login, /refresh; GET /me |
| `projects` | CRUD + /status; BRAND_ADMIN sees all, others see owned+member |
| `project_members` | GET/POST /projects/{id}/members, DELETE /{user_id} |
| `artifacts` | CRUD under /projects/{id}/artifacts; auto-creates VideoSession for VIDEO/REEL |
| `video_sessions` | GET /{id}; PATCH /presenter; script CRUD + /draft + /rewrite + /versions; scenes /generate + /regenerate + GET + POST; POST /generate (video); GET /videos; POST /brief/draft + /brief/improve |
| `scenes` | PATCH /{id}, DELETE /{id} |
| `generated_videos` | DELETE /{id} |
| `presenters` | CRUD; POST /suggest-keywords, /generate-appearance |
| `ai` | POST /generate-taglines, /generate-image, /generate-storyboard |
| `uploads` | POST /photo, /image |
| `brand_kit` | GET/PATCH /; POST /logo, /font |
| `brand_library` | Browse + publish + review + remix |
| `compliance` | Rules CRUD; Documents CRUD; POST/GET /score/{artifact_id} |
| `exports` | POST /artifacts/{id}/export; GET /{id}/status, /{id}/download |
| `comments` | GET/POST /artifacts/{id}/comments |
| `notifications` | GET /; POST /{id}/read |
| `gamification` | GET /stats, /leaderboard |
| `analytics` | GET /overview, /activity, /content-gaps |
| `users` | GET /search (LEADER+ only) |
| `suggestions` | GET/POST /projects/{id}/suggestions |
| `hierarchy` | Mock (real AIA hierarchy requires network access) |
| `health` | GET /health |

## Video Generation Pipeline

```
1. POST /video-sessions/{id}/generate
   └── Creates QUEUED GeneratedVideo row
       └── Celery: generate_video_task.delay(video_id)

2. Celery worker ("video" queue)
   ├── For each scene: veo_client.generate_scene(merged_prompt) → mp4_bytes
   ├── Updates progress_percent + current_scene in DB
   └── ffmpeg concat → S3 upload → status=READY

3. Client polls GET /video-sessions/{id}/videos every 5s
   └── Stops when any_active = false
```

## Frontend Pages

```
/login                                          # Hardcoded demo accounts (password: craft2026)
/home                                           # Creator tabs: My Projects, Team, Library, Analytics
                                                # Agent view: FSC-specific home
/projects/new                                   # 5-step project creation wizard
/projects/[id]                                  # Project detail (artifacts, brief, members, suggestions tabs)
/projects/[id]/artifacts/new                    # Artifact type selector (poster, reel, whatsapp, etc.)
/projects/[id]/artifacts/[id]                   # Artifact detail + compliance score + export
/projects/[id]/artifacts/[id]/video/brief       # Video wizard step 1: Brief
/projects/[id]/artifacts/[id]/video/presenter   # Video wizard step 2: Presenter
/projects/[id]/artifacts/[id]/video/script      # Video wizard step 3: Script + AI rewrite
/projects/[id]/artifacts/[id]/video/storyboard  # Video wizard step 4: Scene planning
/projects/[id]/artifacts/[id]/video/generate    # Video wizard step 5: Generate + playback
/brand-kit                                      # Brand colors, fonts, logo upload
/brand-library                                  # Browse & remix approved content
/brand-library/[id]                             # Library item detail
/compliance/rules                               # Admin: manage compliance rules
/compliance/documents                           # Admin: upload MAS documents
/compliance/review                              # Review queue (stub — deferred)
/leaderboard                                    # Points, streaks, leaderboard
```

## Implementation Status

**Complete (MVP):**
- Auth & RBAC (hardcoded login, JWT, role enforcement)
- Projects CRUD + 5-step wizard + team membership
- Artifact CRUD + versioning + creator UIs (poster, reel, WhatsApp card)
- AI generation (Gemini text + `gemini-2.5-flash-image` images) + project suggestions
- **Full video wizard** (Brief → Presenter → Script → Storyboard → Veo generation via Celery)
- Brand kit (colors, fonts, logos)
- Brand library (submit → review → publish → remix workflow)
- Compliance engine (rules CRUD, document upload, Gemini scoring, RAG via pgvector)
- Export pipeline (PNG/JPG via Pillow, MP4 via ffmpeg, S3/local)
- Gamification (points log in PostgreSQL, streaks, Redis leaderboard)
- Analytics (overview metrics, activity trends, content gaps, top remixed)
- Comments + notifications + presenters library

**In Planning (Poster Wizard — see `.claude/plans/poster-generation/`):**
- Phase A: Wizard scaffold + data model migration
- Phase B: Real text AI (brief, copy, scene description)
- Phase C: Image generation via `gemini-2.5-flash-image` (4-variant parallel)
- Phase D: Chat refinement + region edit (inpainting)
- Phase E: Per-field compliance inline + print-ready PDF export

**Deferred (Phase 2 — see `.claude/specs/unimplemented-features.md`):**
1. Compliance review queue UI
2. FSC photo compositing (profile headshot blending)
3. Invite members step in project wizard
4. District Leader team oversight view
5. Project-level shared assets panel
6. Reel animated preview (currently static storyboard)
7. Hierarchy API (mock only; requires AIA network access)

## Alembic Migration Chain

Current HEAD: `53f0e01db9b9`

| Revision | What it adds |
|---|---|
| `fb69956d07c5` | Initial schema (users, projects, artifacts, compliance, brand kit) |
| `b2c3d4e5f6a7` | Gamification, comments, notifications, compliance checks, export logs |
| `c2d3e4f5a6b7` | Full video pipeline (presenters, video_sessions, scripts, scenes, generated_videos) |
| `d3e4f5a6b7c8` | Phase 7 gamification + video refinements |
| `4906a5094a60` | Compliance check + export log adjustments |
| `a1b2c3d4e5f6` | Export log status + download_url |
| `53f0e01db9b9` | Scene.setting widened to TEXT |

Next migration for Poster Wizard: `005_poster_wizard.py` (adds `poster_chat_turns`, `poster_reference_images`).

## Test Accounts (seed.py — password: `craft2026`)

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
