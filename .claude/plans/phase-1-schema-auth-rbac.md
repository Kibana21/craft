# Phase 1: Database Schema + Auth + RBAC

**Goal:** All core tables, seeded test users, JWT login, role-based middleware.

**User stories:** US-001 (hardcoded login), US-002 (RBAC), US-005 (database schema)

**Dependencies:** Phase 0

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/models/enums.py` | All shared enums: UserRole, ProjectType, ProjectPurpose, ProjectMemberRole, ArtifactType (poster, whatsapp_card, reel, story, video, deck, infographic, slide_deck), ArtifactStatus, ArtifactChannel, LibraryItemStatus, ComplianceSeverity, DocumentType, SuggestionAudience |
| `backend/app/models/user.py` | User: id (UUID), name, email, hashed_password, role (Enum), avatar_url, agent_id (nullable), created_at |
| `backend/app/models/project.py` | Project: id, name, type (personal/team), purpose (product_launch/campaign/seasonal/agent_enablement), owner_id (FK), product, target_audience, campaign_period, key_message, brand_kit_id (FK), brief (JSON — extra data), status, created_at, updated_at |
| `backend/app/models/artifact_suggestion.py` | ArtifactSuggestion: id, project_id (FK), artifact_type, artifact_name, description, audience (internal/external/both), selected (bool), created_at |
| `backend/app/models/project_member.py` | ProjectMember: project_id, user_id, role (owner/member), joined_at. Composite PK on (project_id, user_id) |
| `backend/app/models/artifact.py` | Artifact: id, project_id (FK), creator_id (FK), type (poster/whatsapp_card/reel/story/video/deck/infographic/slide_deck), name, content (JSON), channel (instagram/whatsapp/print/social/internal), format (1:1/4:5/9:16/A4/800x800), thumbnail_url, compliance_score (Float nullable), status (draft/ready/exported), version (int default 1), created_at, updated_at |
| `backend/app/models/brand_library_item.py` | BrandLibraryItem: id, artifact_id (FK), published_by (FK), status (pending_review/approved/published/rejected), remix_count (default 0), published_at |
| `backend/app/models/brand_kit.py` | BrandKit: id, logo_url, secondary_logo_url, primary_color, secondary_color, accent_color, fonts (JSON), updated_by (FK), updated_at. Singleton pattern (one row). |
| `backend/app/models/compliance_rule.py` | ComplianceRule: id, rule_text, category, severity (error/warning), is_active (bool), created_by (FK), created_at |
| `backend/app/models/compliance_document.py` | ComplianceDocument: id, title, content (Text), embedding (Vector(768)), document_type (mas_regulation/product_fact_sheet/disclaimer), chunk_index (int), source_document_id (nullable), created_at |
| `backend/app/core/auth.py` | `create_access_token(user_id, role)`, `verify_token(token)`, password hashing with passlib bcrypt, `get_current_user` dependency (extracts JWT from Authorization header) |
| `backend/app/core/rbac.py` | `require_role(*roles)` dependency factory — returns FastAPI dependency that 403s if role not in allowed list. Also `RoleChecker` class for fine-grained checks (can_create_team_project, can_publish_to_library, can_manage_brand_kit) |
| `backend/app/schemas/auth.py` | `LoginRequest(email, password)`, `TokenResponse(access_token, token_type, user)`, `UserResponse(id, name, email, role, avatar_url)` |
| `backend/app/api/auth.py` | `POST /api/auth/login` — validate credentials, return JWT. `GET /api/auth/me` — return current user from token. |
| `backend/app/api/hierarchy.py` | `GET /api/hierarchy/{leader_id}/fscs` — mock endpoint returning hardcoded FSC list. Designed to swap with real AIA hierarchy API later. |
| `backend/app/services/auth_service.py` | `authenticate_user(email, password)` — looks up user, verifies hash, returns user or None |
| `backend/scripts/seed.py` | Creates 8+ test users (2 per role), sample brand kit, sample compliance rules. Must be idempotent. |
| `backend/alembic/versions/001_initial_schema.py` | First migration: all tables. Enables pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`). |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/login/page.tsx` | Login page: email + password form, calls `POST /api/auth/login`, stores JWT in localStorage, redirects based on role |
| `frontend/src/lib/auth.ts` | `getToken()`, `setToken()`, `removeToken()`, `getUser()` (decode JWT payload), `isAuthenticated()` |
| `frontend/src/middleware.ts` | Next.js middleware: checks for JWT on protected routes → redirect to `/login` if absent; redirect from `/login` to `/home` if already authenticated |
| `frontend/src/types/user.ts` | `User`, `UserRole` types matching backend schema |
| `frontend/src/types/auth.ts` | `LoginRequest`, `TokenResponse` types |
| `frontend/src/components/providers/auth-provider.tsx` | React context: `AuthProvider` wrapping the app, exposes `user`, `login()`, `logout()`, `isLoading` |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Authenticate, return JWT |
| GET | `/api/auth/me` | Any | Return current user |
| GET | `/api/hierarchy/{leader_id}/fscs` | leader+ | Mock hierarchy endpoint |

## Seed data

| Email | Role | Name |
|---|---|---|
| sarah@example.com | brand_admin | Sarah Lim |
| james@example.com | brand_admin | James Tan |
| david@example.com | district_leader | David Lee |
| rachel@example.com | district_leader | Rachel Wong |
| michael@example.com | agency_leader | Michael Ng |
| priya@example.com | agency_leader | Priya Kumar |
| maya@agent.example.com | fsc | Maya Chen |
| alex@agent.example.com | fsc | Alex Ong |

Password for all: `craft2026` (hashed with bcrypt)

## Key implementation details

- JWT payload: `{ sub: user_id, role: "fsc", exp: ... }`. Token expiry: 24 hours for MVP.
- `get_current_user` dependency returns the full User ORM object (loaded from DB on every request for MVP simplicity).
- `require_role` factory pattern: `@router.post("/...", dependencies=[Depends(require_role("brand_admin"))])` — declarative at route level.
- All model UUIDs use `uuid.uuid4()` as default, generated server-side (not DB-side) for portability.
- The `compliance_documents` table needs the pgvector `Vector` column type. Migration must run `CREATE EXTENSION IF NOT EXISTS vector;` before creating the table.
- Auth is designed so swapping in Microsoft Entra ID later only requires changing the authentication provider (in `auth_service.py`), not the authorization logic (RBAC middleware stays the same).

## Verification

- `make migrate` runs migration successfully
- `make seed` creates all test users
- `POST /api/auth/login` with `maya@agent.example.com` / `craft2026` returns JWT with role=fsc
- `GET /api/auth/me` with valid JWT returns user info
- `GET /api/auth/me` without JWT returns 401
- `GET /api/hierarchy/{leader_id}/fscs` returns mock FSC list
- `mypy app/` passes
- `npm run typecheck` passes
