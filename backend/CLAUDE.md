# Backend — CLAUDE.md

FastAPI async backend for the CRAFT platform. Python 3.12+, SQLAlchemy 2.0 (async), PostgreSQL, Redis, Celery, Gemini AI, Google Veo.

---

## Commands

```bash
# Dev server (from repo root)
make backend              # uvicorn --reload (DEV; saves restart in-flight requests)
make backend-demo         # uvicorn WITHOUT --reload — use for live demos

# Database
make migrate              # alembic upgrade head
make migrate-new MSG="…"  # create new migration
make seed                 # python -m scripts.seed  (test users + compliance rules)

# Background worker (video / poster / studio generation)
make worker               # celery -A app.celery_app worker --queues=video,poster,studio,celery
make flower               # Flower monitor at http://localhost:5555

# Quality
make test-backend         # pytest (smoke tests in tests/test_smoke.py — health, unauth-guard, login validation)
make lint                 # ruff + mypy
```

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, lifespan, CORS, RequestId middleware, slowapi handler, router mounting
│   ├── celery_app.py            # Celery broker config (Redis; video + poster + studio queues)
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (all env vars; see backend/.env.example)
│   │   ├── database.py          # Async engine, session factory, get_db()
│   │   ├── auth.py              # JWT create/decode, get_current_user()
│   │   ├── rbac.py              # require_role(), require_brand_admin, require_artifact_access
│   │   ├── rate_limit.py        # slowapi Limiter; per-user keying (JWT sub) → IP fallback
│   │   └── request_id.py        # X-Request-ID middleware + ContextVar log filter
│   ├── models/
│   │   ├── base.py              # Base, BaseModel (id + timestamps)
│   │   ├── enums.py             # All enums (single source of truth)
│   │   └── *.py                 # One file per table
│   ├── schemas/
│   │   └── *.py                 # Pydantic request/response DTOs
│   ├── api/
│   │   └── *.py                 # FastAPI routers (one per domain)
│   └── services/
│       └── *.py                 # Business logic (one per domain)
├── alembic/
│   └── versions/                # Migration files (revision chain below)
├── scripts/
│   └── seed.py                  # Seed test users + brand kit + compliance rules
└── tests/
```

---

## Key Conventions

- **UUID PKs**: Server-generated `uuid4()` — never DB-side `gen_random_uuid()`.
- **Soft deletes**: `deleted_at` timestamp column. Never hard-delete user-facing rows.
- **Async SQLAlchemy throughout**: Use `AsyncSession`, `select()` API, `selectinload()` for relationships. Never call sync SQLAlchemy APIs in an async context.
- **Every FK column must have an explicit index.**
- **JSONB columns** (`artifacts.content`, `projects.brief`, `brand_kit.fonts`, `notifications.data`): validate at the API boundary with Pydantic; never trust raw dict reads.
- **Enums stored as strings** (`str, enum.Enum`). Matches DB column type.
- **`model_config = {"from_attributes": True}`** on every Pydantic response schema.
- **Background tasks**: FastAPI `BackgroundTasks` for lightweight work (compliance scoring, gamification points). Celery for heavy/long-running work (video generation, poster generation, studio generation). Queues: `video`, `poster`, `studio`.
- **Error responses**: `HTTPException(status_code=..., detail="human-readable")`. For machine-parseable errors add `{"detail": "...", "error_code": "MACHINE_READABLE"}`. The frontend maps `error_code` to friendly copy — pick values from the existing set before inventing new ones (e.g. `TURN_LIMIT_REACHED`, `STUDIO_QUOTA_EXCEEDED`, `AI_CONTENT_POLICY`, `AI_UPSTREAM_ERROR`).
- **Rate limits**: Tightest on cost-heavy AI endpoints (10–15/min/user). Not yet wired everywhere — tracked in `.claude/plans/reliability-hardening.md` Tier 2.
- **Never swallow exceptions silently.** Bare `except Exception: pass` is banned (caused a silent gamification failure + silent compliance-scoring failure). Always `logger.warning("...", exc_info=True)` so the failure is at least visible in logs. For Celery tasks, re-raise after logging so the task is marked FAILED in Flower — don't return successfully from a failed run.
- **Fail-open on Redis** is allowed (quota checks, leaderboard) so an ops outage doesn't block users, but **always log a warning** when falling open — otherwise you have no idea the quota is unenforced.
- **Ownership checks on every endpoint that returns or mutates user-scoped data.** Reuse `app/core/rbac.py:require_artifact_access` instead of rewriting the three-way BRAND_ADMIN/creator/member check.
- **Row locking for concurrent writes**: `select(...).with_for_update()` around any endpoint that reads-then-writes the same row (save-as-variant, poster refine, studio workflow step-save). Prevents lost updates when two tabs hit the same resource.

---

## Environment Variables (`.env`)

| Key | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_SECRET` | HS256 signing key |
| `JWT_ALGORITHM` | Default `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Default 60 |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Default 7 |
| `FRONTEND_URL` | CORS whitelist (e.g. `http://localhost:3000`) |
| `GOOGLE_API_KEY` | Gemini text + image generation |
| `GOOGLE_VEO_KEY_FILE` | Path to Vertex AI service account JSON |
| `VEO_PROJECT_ID` | GCP project for Veo video generation |
| `VEO_LOCATION` | Vertex AI region |
| `VEO_MODEL_ID` | e.g. `veo-3.1-generate-001` |
| `VEO_SCENE_TIMEOUT_SECONDS` | Default 900 (15 min per scene) |
| `VIDEO_POLL_INTERVAL_SECONDS` | Default 5 |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT_URL` | S3/R2 storage |
| `DEBUG` | `true` for dev |

---

## Auth & RBAC

### `app/core/auth.py`

| Function / Dependency | Purpose |
|---|---|
| `create_access_token(user_id, role)` | 60-min JWT with `jti`, `type="access"` |
| `create_refresh_token(user_id, role)` | 7-day JWT with `type="refresh"` |
| `decode_token(token)` | Validates HS256 signature, returns payload |
| `verify_token` | FastAPI dependency → decoded payload dict |
| `get_current_user` | FastAPI dependency → `User` ORM object |

Password hashing: bcrypt via passlib (12 rounds). **bcrypt is blocking** — `verify_password` runs via `asyncio.to_thread()` in `auth_service.py` to avoid blocking the async event loop.

### `app/core/rbac.py`

| Dependency | Allowed roles |
|---|---|
| `require_brand_admin` | `BRAND_ADMIN` only |
| `require_leader` | `BRAND_ADMIN`, `DISTRICT_LEADER`, `AGENCY_LEADER` |
| `require_any_authenticated` | All authenticated roles |
| `require_role(*roles)` | Factory — pass any combination |

Roles (from `UserRole` enum): `BRAND_ADMIN`, `DISTRICT_LEADER`, `AGENCY_LEADER`, `FSC`

---

## Rate limiting (`app/core/rate_limit.py`)

slowapi-backed per-user / per-IP rate limiter. Wired into `main.py` lifespan; storage = Redis when reachable, in-memory fallback (logged warning).

```python
from app.core.rate_limit import limiter
from fastapi import Request

@router.post("/api/ai/poster/refine-chat")
@limiter.limit("10/minute")
async def refine_chat(
    request: Request,  # required by slowapi to read the rate-limit key
    body: RefineChatRequest,
    ...
):
    ...
```

Key function (`user_rate_limit_key`): decodes the JWT subject from the `Authorization: Bearer …` header → `user:<sub>`. Falls back to `ip:<remote>` for unauth routes (login). Means an office NAT doesn't get a shared budget across legitimate users.

Defaults applied:
- Cost-heavy AI endpoints — `10/minute/user`: `/api/ai/poster/generate-variants`, `/api/ai/poster/refine-chat`, `/api/studio/workflows/generate`.
- Auth — `10/minute/IP` for `/api/auth/login` (brute-force throttle), `30/minute/IP` for `/api/auth/refresh` (looser because the frontend 401-interceptor can fan out parallel refreshes when a tab wakes from sleep).
- 429 responses use `error_code = "RATE_LIMITED"`.

---

## Request-ID correlation (`app/core/request_id.py`)

Every request gets an `X-Request-ID` (UUID4 if not inbound). Bound to a `ContextVar` so log records emitted during the request carry it via the `RequestIdLogFilter` attached at startup. Frontend stores the response header and embeds it in error banners — users can quote the ID during incident triage.

To include it in your formatter: `"%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"`.

---

## Models

All models extend `BaseModel` (abstract), which provides:
- `id: UUID` — PK, server-generated `uuid4()`
- `created_at`, `updated_at` — server default `now()`, auto-updated on write

### `User` — `users`
| Column | Type | Notes |
|---|---|---|
| name | str | |
| email | str | unique |
| hashed_password | str | bcrypt |
| role | UserRole | enum |
| avatar_url | str? | |
| agent_id | str? | unique, FSC identifier |

Indexes: email, role, agent_id

### `Project` — `projects`
| Column | Type | Notes |
|---|---|---|
| name | str | |
| type | ProjectType | PERSONAL / TEAM |
| purpose | ProjectPurpose | PRODUCT_LAUNCH / CAMPAIGN / SEASONAL / AGENT_ENABLEMENT |
| owner_id | UUID FK users | indexed |
| product, target_audience, campaign_period, key_message | str? | |
| brand_kit_id | UUID FK brand_kit? | indexed |
| brief | JSONB? | narrative summary |
| status | str | active / archived |
| deleted_at | datetime? | soft delete |

Relations: owner, brand_kit, members (cascade), artifacts (cascade), suggestions (cascade)

### `ProjectMember` — `project_members`
project_id + user_id (FK, composite unique), role (OWNER/MEMBER), joined_at.

### `Artifact` — `artifacts`
| Column | Type | Notes |
|---|---|---|
| project_id | UUID FK | indexed |
| creator_id | UUID FK users | indexed |
| type | ArtifactType | POSTER / WHATSAPP_CARD / REEL / STORY / VIDEO / DECK / INFOGRAPHIC / SLIDE_DECK |
| name | str | |
| content | JSONB? | artifact-type-specific payload |
| channel | ArtifactChannel? | INSTAGRAM / WHATSAPP / PRINT / SOCIAL / INTERNAL |
| format | ArtifactFormat? | 1:1 / 4:5 / 9:16 / A4 / 800x800 |
| thumbnail_url | str? | |
| compliance_score | float? | 0–100, check constraint |
| status | ArtifactStatus | DRAFT / READY / EXPORTED |
| version | int | default 1 |
| deleted_at | datetime? | soft delete |

Indexes: project_id, creator_id, type, status. One-to-one with `VideoSession` for VIDEO/REEL.

### `VideoSession` — `video_sessions`
| Column | Type | Notes |
|---|---|---|
| artifact_id | UUID FK unique | |
| presenter_id | UUID FK presenters? | |
| target_duration_seconds | int | default 60 |
| current_step | VideoSessionStep | PRESENTER / SCRIPT / STORYBOARD / GENERATION |
| current_script_id | UUID FK video_scripts? | circular — added via ALTER TABLE |
| scenes_script_version_id | UUID FK script_versions? | circular — via ALTER TABLE |

Relations: artifact, presenter, current_script, scenes (ordered by sequence), generated_videos (version DESC)

### `VideoScript` — `video_scripts`
video_session_id (FK, one per session — updated in-place), content (Text), word_count, estimated_duration_seconds.

### `ScriptVersion` — `script_versions`
**Immutable snapshot.** video_session_id (FK), content (Text), action (DRAFT / WARM / PROFESSIONAL / SHORTER / STRONGER_CTA / MANUAL), created_at. Never updated after creation.

### `Scene` — `scenes`
| Column | Notes |
|---|---|
| video_session_id | FK, indexed |
| sequence | int — (video_session_id, sequence) unique **DEFERRABLE INITIALLY DEFERRED** |
| name, dialogue, setting | text |
| camera_framing | WIDE_SHOT / MEDIUM_SHOT / CLOSE_UP / OVER_THE_SHOULDER / TWO_SHOT / AERIAL / POV |
| merged_prompt | Text, default "" (built by prompt_builder) |
| script_version_id | FK script_versions? |

The deferred unique constraint allows in-transaction sequence renumbering without constraint violations.

### `GeneratedVideo` — `generated_videos`
| Column | Notes |
|---|---|
| video_session_id | FK, indexed |
| version | int — (session, version) unique |
| status | QUEUED / RENDERING / READY / FAILED |
| progress_percent | 0–100 |
| current_scene | int? |
| file_url | str? |
| error_message | Text? |
| completed_at | datetime? |

### `Presenter` — `presenters`
name, age_range, appearance_keywords, full_appearance_description, speaking_style (AUTHORITATIVE / CONVERSATIONAL / ENTHUSIASTIC / EMPATHETIC), is_library (bool), created_by_id (FK users), deleted_at.

### `BrandKit` — `brand_kit`
name, logo_url, secondary_logo_url, primary_color (#D0103A), secondary_color (#1A1A18), accent_color (#1B9D74), fonts (JSONB), version, updated_by (FK users?).

### `BrandLibraryItem` — `brand_library_items`
artifact_id (FK unique), published_by (FK users), status (PENDING_REVIEW / APPROVED / PUBLISHED / REJECTED), remix_count, published_at, rejection_reason.

### `ComplianceRule` — `compliance_rules`
rule_text (Text), category, severity (ERROR / WARNING), is_active (bool), created_by (FK users?). Partial index on `is_active = true`.

### `ComplianceDocument` — `compliance_documents`
title, content (Text), document_type (MAS_REGULATION / PRODUCT_FACT_SHEET / DISCLAIMER), chunk_index, source_document_id (UUID?).

### `ComplianceCheck` — `compliance_checks`
artifact_id (FK), score (float), breakdown (JSONB?), checked_at.

### `ExportLog` — `export_logs`
artifact_id (FK), user_id (FK), format, aspect_ratio?, status (processing / ready / failed), download_url?, compliance_score?, exported_at.

### `Comment` — `comments`
artifact_id (FK), user_id (FK), text (Text), created_at.

### `Notification` — `notifications`
user_id (FK), type, title, message?, data (JSONB?), read (bool, default false), created_at. Partial index on `read = false`.

### `UserPoints` — `user_points`
user_id (unique FK), total_points (int), current_streak, longest_streak, last_activity_date, updated_at.

### `PointsLog` — `points_log`
user_id (FK), action (CREATE_ARTIFACT / EXPORT / REMIX / STREAK_BONUS / VIDEO_GENERATED), points (int), related_artifact_id (FK?), created_at.

### `PosterChatTurn` — `poster_chat_turns`
Append-only log of Step 5 refinements. artifact_id (FK, indexed), variant_id (UUID referencing `content.generation.variants[].id` — not a real FK because JSONB), turn_index (0-based), user_message, ai_response, action_type (CHAT_REFINE / INPAINT / REDIRECT / TURN_LIMIT_NUDGE — check constraint), resulting_image_url?, inpaint_mask_url?, structural_change_detected (bool), deleted_at?. The row count per (artifact, variant) filtered to `action_type != 'REDIRECT'` is the **authoritative 6-turn cap** — never rely on the JSONB mirror alone.

### `PosterReferenceImage` — `poster_reference_images`
Session-temp uploads for Step 2 product/asset subjects. uploader_id (FK), artifact_id (FK?), storage_url, mime_type (png/jpeg/webp — check constraint), size_bytes (≤ 20 MB — check constraint), expires_at. TTL enforced by `poster_sweep_service`.

---

## API Routes

All routers mounted at `/api/`. Default auth: `Depends(get_current_user)`.

### `auth` — `/api/auth`
| Method + Path | Auth | Notes |
|---|---|---|
| POST /login | none | LoginRequest → TokenResponse. **Rate-limited 10/min/IP** (brute-force throttle). |
| POST /refresh | none | RefreshRequest → TokenResponse. Rotates the refresh token (issues a new one). **Rate-limited 30/min/IP** (looser to accommodate the frontend 401-interceptor's parallel refreshes). |
| GET /me | any | → UserResponse |

Login + refresh handlers take a `request: Request` arg (required by slowapi to read the rate-limit key) plus a `body: LoginRequest` / `body: RefreshRequest` for the JSON body. Don't use the name `request` for the body — it collides with `Request`.

### `projects` — `/api/projects`
| Method + Path | Notes |
|---|---|
| GET / | ?type, ?status, ?page, ?per_page. BRAND_ADMIN sees all; others see owned + member |
| POST / | CreateProjectRequest → 201. Background: generate_suggestions |
| GET /{id} | → ProjectDetailResponse with counts |
| PATCH /{id} | UpdateProjectRequest |
| PATCH /{id}/status | {status: "active"\|"archived"} |
| DELETE /{id} | 204, soft delete |

### `project_members` — `/api/projects/{project_id}/members`
GET /, POST /, DELETE /{user_id}

### `artifacts` — `/api/projects/{project_id}/artifacts`
| Method + Path | Notes |
|---|---|
| GET / | ?creator_id, ?type, ?page, ?per_page |
| POST / | CreateArtifactRequest → 201. Auto-creates VideoSession for VIDEO/REEL. Background: compliance score, points |
| GET /{id} | → ArtifactDetailResponse. Lazy-creates VideoSession if missing for VIDEO/REEL |
| PATCH /{id} | Re-triggers compliance score |
| DELETE /{id} | 204, soft delete |

### `video_sessions` — `/api/video-sessions`
| Method + Path | Notes |
|---|---|
| GET /{id} | → VideoSessionResponse |
| PATCH /{id}/presenter | AssignPresenterRequest — library reuse path (presenter_id) or inline create path |
| GET /{id}/script | → ScriptResponse |
| PATCH /{id}/script | Auto-snapshots ScriptVersion on ≥10 word delta or ≥60s since last MANUAL save |
| POST /{id}/script/draft | AI generates from brief (Gemini) → creates DRAFT version |
| POST /{id}/script/rewrite | ScriptRewriteRequest {tone} → AI rewrite → creates named version |
| GET /{id}/script-versions | → list[ScriptVersionResponse] |
| POST /{id}/script-versions/{vid}/restore | Restores snapshot → ScriptResponse |
| POST /{id}/scenes/generate | AI splits script into scenes (409 if already exist) |
| POST /{id}/scenes/regenerate | Wipe + re-split |
| GET /{id}/scenes | → SceneListResponse with staleness version IDs |
| POST /{id}/scenes | SceneInsertRequest → 201 (manual insert at position) |
| POST /{id}/generate | → 202 GeneratedVideoResponse (dispatches Celery task) |
| GET /{id}/videos | → GeneratedVideoListResponse {videos, any_active} |
| POST /{id}/brief/draft | AI suggests all brief fields |
| POST /{id}/brief/improve | BriefImproveRequest → {value} (single field improvement) |

### `ai` — `/api/ai`
| Method + Path | Notes |
|---|---|
| POST /generate-taglines | GenerateTaglinesRequest → list[str] |
| POST /generate-image | GenerateImageRequest → {image_url, prompt_used} |
| POST /generate-storyboard | GenerateStoryboardRequest → list[frames] |

### `compliance` — `/api/compliance`
All BRAND_ADMIN only except score endpoints.
| Method + Path | Notes |
|---|---|
| POST /rules | → 201 |
| GET /rules | ?active_only |
| PATCH /rules/{id} | |
| POST /documents | → 201 |
| GET /documents | |
| DELETE /documents/{id} | 204 |
| POST /score/{artifact_id} | Trigger on-demand compliance scoring |
| GET /score/{artifact_id} | Re-score + return latest ComplianceScoreResponse |
| POST /rules/suggest | AI-draft a MAS-aligned rule for a given category + optional hint. Requires BRAND_ADMIN. Returns `{ rule_text }`. Raises 503 if Gemini fails. |
| POST /check-field | Per-field inline compliance check (Phase E). Any authenticated user. Returns `{ flags, cached }`. |

Compliance schemas: `CreateRuleRequest`, `UpdateRuleRequest`, `ComplianceRuleResponse` (existing). Added: `SuggestRuleRequest`: `{ category: str, hint: str | None (max 300 chars) }`. `SuggestRuleResponse`: `{ rule_text: str }`.

### `exports` — `/api/artifacts/{artifact_id}/export`
| Method + Path | Notes |
|---|---|
| POST / | ExportRequest {format, aspect_ratio} → 202. Background: render + upload to S3 |
| GET /{export_id}/status | → ExportStatusResponse |
| GET /{export_id}/download | → FileResponse (MP4/JPG/PNG with attachment headers) |

### `brand_kit` — `/api/brand-kit`
GET /, PATCH /, POST /logo (?variant=primary\|secondary), POST /font (?slot=heading\|body\|accent)

### `brand_library` — `/api/brand-library`
GET / (?search, ?product, ?page, ?per_page), GET /{id}, POST / (publish artifact), PATCH /{id} (review: approve/reject), POST /{id}/remix

### `comments` — `/api/artifacts/{artifact_id}/comments`
POST /, GET /

### `gamification` — `/api/gamification`
GET /stats (current user), GET /leaderboard (?limit)

### `presenters` — `/api/presenters`
GET /, POST /, GET /{id}, PATCH /{id}, DELETE /{id}, POST /suggest-keywords, POST /generate-appearance

### `uploads` — `/api/uploads`
POST /photo, POST /image → upload to S3 or local `/uploads/`

### `notifications` — `/api/notifications`
GET / (?unread_only), POST /{id}/read

### `users` — `/api/users`
GET /search (?q, ?role) — LEADER and above only

### `analytics` — `/api/analytics`
GET /overview, GET /activity, GET /content-gaps

### `health` — `/api/health`
GET /health → {status, database} (DB connectivity check)

### `hierarchy` — `/api/hierarchy`
Mock endpoints (real AIA hierarchy requires network access — deferred)

### `scenes`, `generated_videos`
Standalone routers for PATCH/DELETE outside the session namespace.

### `poster_ai` — `/api/ai/poster`
| Phase | Method + Path | Notes |
|---|---|---|
| B | POST /generate-brief | Gemini narrative from campaign inputs |
| B | POST /generate-appearance-paragraph | 40–80-word subject description |
| B | POST /generate-scene-description | Scene-abstract text |
| B | POST /copy-draft-all | Headline + subhead + body + CTA (all fields) |
| B | POST /copy-draft-field | Single-field draft (regenerate) |
| B | POST /tone-rewrite | Rewrite copy with SHARPER / WARMER / MORE_URGENT / SHORTER |
| B | POST /classify-structural-change | Heuristic + LLM fallback; returns {is_structural, target, confidence} |
| C | POST /generate-composition-prompt | Deterministic assembler + Gemini style sentence → merged_prompt |
| C | POST /generate-variants | → 202 {job_id}; Celery `poster.generate` runs 4-up in parallel |
| C | GET  /generate-variants/{job_id}/status | Polling target — READY / FAILED |
| C | POST /generate-variants/retry | Single-slot retry (HMAC retry token) |
| **D** | POST /refine-chat | One chat-refine turn. Enforces 6-turn cap (429 TURN_LIMIT_REACHED). Structural changes return `action_type=REDIRECT` with a step target and do not count against the cap. Turn 6 carries `action_type=TURN_LIMIT_NUDGE`. Undo pill: message prefix `"undo the change: "` skips the counter. |
| **D** | POST /inpaint | Multipart with mask PNG. Reuses poster_image_service.inpaint_variant() — mask coverage > 60% rejected with 400. Counts against the turn cap. |
| E | POST /upscale | 2× via Gemini or Pillow Lanczos fallback |
| E | POST /compliance/check-field | Per-field MAS pattern scan |

### `artifacts` (poster extensions) — `/api/artifacts`
| Phase | Method + Path | Notes |
|---|---|---|
| **D** | POST /{id}/save-as-variant | Clone selected variant into a new JSONB entry. Sets `parent_variant_id` lineage, deselects prior variants, resets `turn_count_on_selected` to 0. Returns the full `Variant` object. |
| **D** | GET  /{id}/variants/{variant_id}/turns | Image-producing history (REDIRECT rows excluded) ordered by turn_index. Powers the History dialog on the generate page. |
| **D** | POST /{id}/variants/{variant_id}/restore-turn | Swap `variants[i].image_url` to an earlier turn's `resulting_image_url`. Intentionally does **not** reset the counter — restore is a view swap, not a cap bypass. |

### `poster` — `/api/poster`
Admin sweep. `POST /sweep/chat-turns` (30-day) and `POST /sweep/reference-images` (24h TTL). Wired via `poster_sweep_service`.

---

## Services

### `app/services/ai_service.py`
| Function | Purpose |
|---|---|
| `split_script_into_scenes(content, duration, presenter_ctx, brand_ctx)` | Gemini splits script → list of scene dicts |
| `draft_from_brief(brief_fields)` | Gemini writes full script from brief inputs |
| `rewrite(content, tone)` | Gemini rewrites preserving meaning |
| `generate_taglines(product, audience, tone, count)` | Returns list[str] |
| `generate_image(product, audience, tone, artifact_type, aspect_ratio)` | Returns (image_url, prompt_used) |
| `generate_storyboard(topic, key_message, product, tone)` | Returns list[frames] |
| `generate_presenter_appearance(keywords, style)` | 40–80 word description |
| `suggest_appearance_keywords(name, age_range, style)` | Keywords string |
| `improve_brief_field(field, context)` | Single-field AI improvement → value |

### `app/services/video_script_service.py`
| Function | Purpose |
|---|---|
| `get_or_create_script(db, session_id)` | Returns VideoScript, creates empty if missing |
| `update_content(db, session_id, content)` | Updates + auto-snapshots on ≥10 word delta or ≥60s since last MANUAL |
| `draft_from_brief(db, session_id, overrides)` | AI draft → creates DRAFT ScriptVersion |
| `rewrite(db, session_id, tone)` | AI rewrite → creates named ScriptVersion |
| `list_versions(db, session_id)` | list[ScriptVersion] |
| `restore(db, session_id, version_id)` | Restores from snapshot |

### `app/services/video_service.py`
| Function | Purpose |
|---|---|
| `generate_scenes(db, session_id)` | AI scene split (409 if scenes already exist) |
| `regenerate_scenes(db, session_id)` | Wipe all scenes + re-split |
| `list_scenes(db, session_id)` | Returns dict with staleness version IDs |
| `insert_scene(db, session_id, position, ...)` | Manual scene insert at given position |

### `app/services/video_generation_service.py`
| Function | Purpose |
|---|---|
| `trigger(db, session_id, project_id)` | Creates QUEUED GeneratedVideo; caller dispatches Celery |
| `list_for_session(db, session_id)` | {videos, any_active} |
| `delete(db, video_id)` | READY → delete file; QUEUED/RENDERING → flip FAILED; FAILED → DB delete |
| `mark_orphans_failed(db)` | Startup cleanup — QUEUED/RENDERING → FAILED |

### `app/services/video_generation_worker.py`
Celery task `generate_video_task`. Scene-by-scene Veo rendering. Updates progress_percent, current_scene, file_url, status, completed_at.

### `app/services/veo_client.py`
Vertex AI / Veo wrapper. `generate_scene(prompt)`, `extend_scene(prompt, video_obj)`.
Typed exceptions: `VeoTimeoutError`, `VeoPolicyError`, `VeoQuotaError`, `VeoMalformedResponseError`, `VeoNotConfiguredError`.
Auth: service account key at `GOOGLE_VEO_KEY_FILE`.

### `app/services/compliance_scorer.py`
`score_artifact(db, artifact_id)` — Gemini-based scoring against active ComplianceRules + ComplianceDocuments (RAG via LangChain + pgvector). Returns `{score, breakdown}`.

### `app/services/compliance_service.py`
`suggest_compliance_rule(category, hint)` — uses Gemini (`_gemini_model()`) to draft a single MAS-aligned rule. Uses `_CATEGORY_CONTEXT` dict to inject category-specific guidance into the prompt. Strips "Rule:" prefix echo. Raises HTTP 503 (not 500) on Gemini failure — never returns 500 for an AI blip.

### `app/services/prompt_builder.py`
`build_merged_prompt(scene, presenter, brand_kit)` — Assembles the final prompt string for Veo scene generation.

### `app/services/project_service.py`
`list_user_projects`, `create_project`, `get_project_detail`, `update_project`, `set_project_status`, `delete_project`.
Key rules: BRAND_ADMIN sees all projects; FSC cannot create TEAM projects; auto-selects latest BrandKit if none specified.

### `app/services/gamification_service.py`
Points: CREATE_ARTIFACT=10, EXPORT=20, REMIX=15, STREAK_BONUS=50, VIDEO_GENERATED=50.
- `award_points(db, user_id, action)` — updates UserPoints + Redis leaderboard sorted set.
- `award_points_once(db, user_id, action, artifact_id)` — idempotent version (no-op if already awarded for this triple).

### `app/services/export_service.py`
`trigger_export` → creates ExportLog (PENDING), queues `run_export` as BackgroundTask.
`run_export` → renders via render_service → uploads to S3 → updates ExportLog.

### `app/services/upload_service.py`
`upload_file(file, destination)` → S3 or local `/uploads/` fallback.

### `app/services/brand_library_service.py`
`remix_library_item` — creates new project + artifact from published item, increments remix_count, awards REMIX points.

### `app/services/suggestion_service.py`
`generate_suggestions(db, project)` — Gemini-powered artifact type suggestions per project context.

### Poster Wizard services

| File | Purpose |
|---|---|
| `poster_ai_service.py` | Phase B text AI (brief / appearance / scene / copy / tone-rewrite) + deterministic `build_composition_prompt()` + Gemini `build_style_sentence()` + `classify_structural_change()` (keyword fast path → LLM fallback) |
| `poster_image_service.py` | Phase C orchestrator: 4-variant parallel Gemini calls via `asyncio.gather`, seed-phrase diversity, exponential backoff, retry tokens (HMAC), daily project quota (Redis), reference image downscaling. Plus `inpaint_variant()` (mask validation, red overlay, Gemini image-edit, PIL composite, upload) and `upscale_variant()`. |
| `poster_generation_worker.py` | Celery task `poster.generate` on the `poster` queue — runs the parallel generation, writes variants back to `artifact.content.generation.variants[]`, mirrors status to Redis for polling. |
| `poster_refine_service.py` | **Phase D.** `refine_chat_turn()` — full chat-refinement flow: lock artifact → `enforce_turn_limit()` → structural-change pre-check → prompt stacking (original + accepted change history + user message) → Gemini image call → `_summarise_change()` for ≤5-word pill → PosterChatTurn row + JSONB variant update + mirror `turn_count_on_selected`. Also exports `count_turns()` + `enforce_turn_limit()` used by the inpaint endpoint. |
| `poster_sweep_service.py` | TTL + orphan sweeps — 24h on reference images, 30d on chat turns, orphan-variant chat-turn cleanup, ExportLog stuck-in-`processing` > 24h → `failed`. Reference-image + stuck-export sweeps run on FastAPI lifespan startup; admin endpoints in `api/poster.py` for manual triggers. |
| `print_pdf_service.py` | Phase E CMYK/300DPI poster export (partial). |
| `upscale_service.py` | Phase E upscaling helpers (partial). |

---

## Video Generation Pipeline

```
1. POST /video-sessions/{id}/generate
   └── video_generation_service.trigger()   → QUEUED GeneratedVideo row
       └── Celery: generate_video_task.delay(video_id)

2. generate_video_task (Celery worker, "video" queue)
   ├── Load session → scenes (ordered by sequence)
   ├── For each scene:
   │   ├── veo_client.generate_scene(merged_prompt) → mp4_bytes
   │   ├── veo_client.extend_scene(...)              → if needed
   │   └── Update progress_percent, current_scene in DB
   └── Concatenate via ffmpeg → store to S3 → set file_url, status=READY, completed_at

3. Client polls GET /video-sessions/{id}/videos every 5s
   └── Stops when any_active = false
```

**Celery config** (`celery_app.py`):
- Broker + backend: Redis (`REDIS_URL`)
- `task_acks_late=True`, `worker_prefetch_multiplier=1` (reliable at-least-once)
- Routes: `video.generate` → `"video"` queue; `poster.generate` → `"poster"` queue (scale independently)
- Run worker: `celery -A app.celery_app worker --queues=video,poster,celery -l info` (see `make worker`)
- Timezone: `Asia/Singapore`
- Result expiry: 24h (status tracked in DB, not Redis)

**Startup cleanup**: `mark_orphans_failed` in `lifespan` flips any QUEUED/RENDERING videos to FAILED (crash recovery).

---

## AI Integration

| Model | SDK | Purpose |
|---|---|---|
| `gemini-2.5-flash` (text) | `google-generativeai` | Script drafting, scene splitting, brief improvement, taglines, storyboard, compliance scoring, presenter appearance |
| `gemini-2.5-flash-image` | `google-genai` | Poster + artifact image generation, image editing (poster wizard) |
| Google Veo (`veo-3.1-generate-001`) | Vertex AI via `google-genai` | Scene-by-scene video generation |

**LangChain + pgvector**: Compliance document RAG — chunks in `compliance_documents`, queried via cosine similarity for context injection into compliance scoring prompts.

---

## Migrations (Alembic)

Revision chain oldest → newest:

| Revision | Description |
|---|---|
| `fb69956d07c5` | Initial schema: users, projects, artifacts, project_members, compliance, brand_kit, artifact_suggestions, brand_library_items |
| `b2c3d4e5f6a7` | Gamification + collaboration: user_points, points_log, comments, notifications, compliance_checks, export_logs |
| `c2d3e4f5a6b7` | Video pipeline: presenters, video_sessions, video_scripts, script_versions, scenes, generated_videos + 6 enum types. Circular FKs via ALTER TABLE. Scene (session, sequence) unique DEFERRABLE. |
| `d3e4f5a6b7c8` | Phase 7 gamification + video refinements |
| `4906a5094a60` | Compliance check + export log adjustments |
| `a1b2c3d4e5f6` | Export log status + download_url columns |
| `53f0e01db9b9` | Scene.setting widened to TEXT |
| `e1f2a3b4c5d6` | Poster Wizard tables — `poster_chat_turns` (append-only refinement log) + `poster_reference_images` (TTL temp uploads) (current HEAD) |

**Adding a migration:**
```bash
make migrate-new MSG="add_poster_wizard_tables"
# Edit backend/alembic/versions/xxx_add_poster_wizard_tables.py
make migrate
```

**Rules:**
- Every `upgrade()` must have a matching `downgrade()`.
- Every new FK column needs an explicit index.
- Use `DEFERRABLE INITIALLY DEFERRED` for unique constraints on mutable sequence columns.
- Circular FKs: create tables first without the back-pointing FK, then `ALTER TABLE … ADD CONSTRAINT` after both tables exist.

---

## Security Checklist for New Endpoints

Every new endpoint must:

1. Add `Depends(get_current_user)` or the appropriate RBAC dependency.
2. Verify ownership before returning artifact/project data. For artifacts specifically use `require_artifact_access()` from `app/core/rbac.py` (handles BRAND_ADMIN + creator + project-member in one). **My Studio is personal** — no BRAND_ADMIN bypass; only the owner can see their images.
3. Validate all inputs via Pydantic — no raw `dict` or `str` from request bodies. JSONB columns should be parsed against a Pydantic model at the boundary (see `schemas/poster.py:PosterContent`, `schemas/studio.py:validate_style_inputs`).
4. Never log PII (email, name, token) or secrets.
5. Apply rate limit on any endpoint that calls an AI service or performs heavy computation.
6. Use parameterised SQLAlchemy queries — never format user input into SQL strings.
7. Soft-delete (`deleted_at`) rather than hard-delete user-facing rows.
8. **Rollback on exception** for any endpoint that does multiple writes. If the dispatch of a Celery job fails after mutating the artifact's JSONB, `await db.rollback()` so there's no partial-write state.
9. **Log + re-raise** on Celery task failure so Flower shows FAILED, not COMPLETED. Also persist a user-visible `error_message` on the run row.

---

## Test Users (seed.py)

Password for all: `craft2026`

| Email | Role |
|---|---|
| sarah@example.com | BRAND_ADMIN |
| james@example.com | BRAND_ADMIN |
| david@example.com | DISTRICT_LEADER |
| rachel@example.com | DISTRICT_LEADER |
| michael@example.com | AGENCY_LEADER |
| priya@example.com | AGENCY_LEADER |
| maya@agent.example.com (FSC-1001) | FSC |
| alex@agent.example.com (FSC-1002) | FSC |

Seed also creates: AIA Singapore BrandKit v1 (#D0103A / #1A1A18 / #1B9D74) + 5 compliance rules (3 ERROR, 2 WARNING).
