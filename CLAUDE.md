# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CRAFT is an AI-powered content creation platform for AIA Singapore. Two audiences from one app: internal staff (Creator mode) and Financial Service Consultants (Agent mode). Role detected at login.

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python 3.12+) + SQLAlchemy 2.0 + Alembic + Pydantic
- **Database:** PostgreSQL with pgvector extension
- **Auth:** Hardcoded login with JWT (Microsoft Entra ID later)
- **AI:** Google Imagen 3 (images), Google Gemini (text), LangChain + pgvector (compliance RAG)
- **Storage:** AWS S3 / Cloudflare R2
- **Cache:** Redis

## Mandatory Standards

**Always follow these skill files when writing code:**

- `.claude/skills/security.md` — JWT handling, password hashing, CORS, rate limiting, input validation, RBAC enforcement. Every API endpoint must be secured.
- `.claude/skills/postgres.md` — Schema design, indexing (especially FK indexes), async SQLAlchemy 2.0 patterns, migration practices, connection pooling.
- `.claude/skills/ui-design.md` — AIA brand colors, typography, component patterns, two-mode design (Creator dark nav, Agent light nav), responsive behavior.

## Specs & Plans

- `.claude/specs/` — PRD and HTML wireframes (source of truth for features)
- `.claude/plans/` — Phase-by-phase implementation plans (README.md has the dependency graph)

## Project Structure

```
craft/
├── backend/              # FastAPI app
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── core/         # Config, auth, database, RBAC
│   ├── alembic/          # Migrations
│   ├── scripts/          # Seed data
│   └── tests/
├── frontend/             # Next.js app
│   └── src/
│       ├── app/          # App Router pages
│       ├── components/   # React components
│       ├── lib/          # API client, auth, utils
│       └── types/        # TypeScript types
└── docker-compose.yml
```

## Commands

```bash
# Dev
make dev                    # Start all services (docker-compose up)
cd backend && uvicorn app.main:app --reload   # Backend only
cd frontend && npm run dev  # Frontend only

# Database
make migrate                # Run Alembic migrations
make seed                   # Seed test users and data

# Quality
cd backend && pytest        # Backend tests
cd backend && mypy app/     # Type checking
cd frontend && npm run typecheck  # TypeScript checking
cd frontend && npm run lint       # ESLint
```

## Key Conventions

- Backend API prefix: `/api/`
- Auth: JWT in Authorization header (`Bearer <token>`). Access token in memory, refresh token in httpOnly cookie.
- All UUIDs generated server-side (uuid4), not database-side.
- Soft deletes via `deleted_at` timestamp column.
- Async SQLAlchemy throughout — use `AsyncSession`, `select()` API, `selectinload()` for relationships.
- Every FK column must have an explicit database index.
