# 02 — Backend API Surface

All endpoints under `/api/studio/*`. New router `backend/app/api/studio.py`, mounted in `main.py` next to existing routers. Default auth: `Depends(get_current_user)`.

Ownership rule: every route either scopes its query by `user_id == current_user.id` OR calls `_require_owned_studio_image(db, image_id, current_user)`. **BRAND_ADMIN does NOT see all My Studio images** — this is personal space per PRD §1.1. Only the owner has access.

---

## Routes

### Library CRUD

| Method + Path | Body / Params | Returns | Notes |
|---|---|---|---|
| `POST /api/studio/images` | multipart `files[]` (1–20 files) | `list[StudioImageResponse]` | Per file: validate MIME, ≤ 25 MB, Pillow-read dimensions, upload via `upload_image_bytes(subfolder=f"studio/{user_id}")`, insert row with `type=PHOTO`. Generates thumbnail (256px-wide WebP) inline via Pillow. Returns 201. Rate-limit concern: none yet (manually capped at 20 per request). |
| `GET /api/studio/images` | `?type=&page=&per_page=&q=` | `StudioImageListResponse {items, total, page, per_page}` | User-scoped. `type` filters by enum. `q` does a case-insensitive ILIKE on `name`. Default sort: `created_at DESC`. `per_page` default 24, max 100. Partial index `idx_studio_images_active` handles the `deleted_at IS NULL` filter. |
| `GET /api/studio/images/{image_id}` | — | `StudioImageDetailResponse` | Includes `source_image` (nested, if any) and `workflow_run` (nested, if any) so the Detail view renders in one fetch. |
| `PATCH /api/studio/images/{image_id}` | `{name?: str, tags?: list[str]}` | `StudioImageResponse` | Only `name` and `tags` are editable for v1. |
| `DELETE /api/studio/images/{image_id}` | — | 204 | Soft delete. Does NOT delete outputs — FK is `ON DELETE SET NULL`. |

### Prompt builder

| Method + Path | Body | Returns |
|---|---|---|
| `POST /api/studio/workflows/prompt-builder` | `{intent, style_inputs, source_image_id?, variation_count}` | `{merged_prompt: str, ai_enrichments: list[str]}` |

Deterministic per-intent template + a Gemini flash text call to produce the final prompt (doc 03). Source image analysis: if `source_image_id` is given, the service fetches its bytes and runs a *single* Gemini vision-text call ("describe the subject in one sentence") to inject identity language. Total calls: ≤ 2 text-LLM invocations. `ai_enrichments` is a list of short pill labels (e.g. `["Lens / camera style cues", "Lighting description", ...]`).

### Workflow runs

| Method + Path | Body | Returns | Notes |
|---|---|---|---|
| `POST /api/studio/workflows/generate` | `{intent, style_inputs, source_image_ids: [UUID], merged_prompt, variation_count, is_batch}` | 202 `{run_id}` | Creates the `studio_workflow_runs` row (status=QUEUED), enqueues `studio.generate` Celery task. Server validates: `variation_count ∈ {1,2,4,8}` (single) or `{1,2,4}` (batch); `len(source_image_ids) ≤ 20`; per-user daily quota (Redis counter, same pattern as `poster_image_service`). |
| `GET /api/studio/workflows/{run_id}/status` | — | `WorkflowRunStatusResponse {run_id, status, progress_percent, outputs: list[StudioImageResponse], error?}` | Polled every 2 s by the client. Outputs are written incrementally as each variation finishes so the user sees them appear. |
| `POST /api/studio/workflows/{run_id}/retry-slot` | `{source_image_id, slot: int}` | `{output: StudioImageResponse}` | Re-runs a single failed slot. Uses the same `merged_prompt` from the run. No HMAC token needed — ownership + run status (PARTIAL) are sufficient guards. |
| `GET /api/studio/workflows/recent` | — | `list[WorkflowRunSummary]` | Last 10 runs for the user. Used to show "processing" banner if any are RUNNING/QUEUED. |

---

## Services

All under `backend/app/services/`:

### `studio_image_service.py`
- `create_from_upload(db, user_id, file) -> StudioImage` — validation, thumbnail, DB insert, points via `award_points_once(user_id, MY_STUDIO_UPLOAD, image_id)`.
- `list_for_user(db, user_id, *, type=None, q=None, page, per_page) -> tuple[list, int]`
- `get_owned(db, image_id, user_id) -> StudioImage` — raises 404/403.
- `rename(db, image_id, user_id, name) -> StudioImage`
- `soft_delete(db, image_id, user_id) -> None`
- `register_poster_export(db, user_id, export_log_id, artifact_id, storage_url) -> StudioImage` — called from the existing export flow (doc 05).

### `studio_prompt_service.py`
- `analyze_source_subject(image_bytes) -> str` — single Gemini vision-text call.
- `build_prompt(intent, style_inputs, subject_description?, variation_count) -> tuple[str, list[str]]` — deterministic per-intent skeleton + Gemini enrichment (doc 03).

### `studio_generation_service.py`
- `enqueue_run(db, user_id, inputs) -> StudioWorkflowRun` — inserts row, dispatches Celery.
- `fetch_status(db, run_id, user_id) -> WorkflowRunStatusResponse`
- `retry_slot(db, run_id, user_id, source_image_id, slot) -> StudioImage`

### `studio_generation_worker.py` (Celery)
- Task `studio.generate` on queue `studio`. Docstring: doc 04.
- Reuses the retry + backoff + seed-phrase machinery already in `poster_image_service._single_variant()` — extract a shared helper in `app/services/gemini_image_utils.py` to avoid copy-paste.

---

## Pydantic schemas (`backend/app/schemas/studio.py`)

Response shapes mirror the DB columns + derived fields:

```python
class StudioImageResponse(BaseModel):
    id: UUID
    name: str
    type: StudioImageType
    storage_url: str
    thumbnail_url: str | None
    mime_type: str
    size_bytes: int
    width_px: int | None
    height_px: int | None
    source_image_id: UUID | None
    workflow_run_id: UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}

class StudioImageDetailResponse(StudioImageResponse):
    source_image: StudioImageResponse | None
    workflow_run: WorkflowRunSummary | None
    prompt_used: str | None

class WorkflowRunSummary(BaseModel):
    id: UUID
    intent: StudioIntent
    is_batch: bool
    status: WorkflowStatus
    progress_percent: int
    created_at: datetime

class WorkflowRunStatusResponse(WorkflowRunSummary):
    outputs: list[StudioImageResponse]
    error: str | None
```

Request bodies similarly — `GenerateWorkflowRequest`, `PromptBuilderRequest`, etc. All validated at boundary with `extra="forbid"` on root models.

---

## Router mounting

In `backend/app/main.py` imports:

```python
from app.api.studio import router as studio_router
...
app.include_router(studio_router)
```

Router is defined with `@router.get("/api/studio/images", ...)` etc. — matches existing router style (full path, no APIRouter prefix, so routes are grep-able).

---

## Error codes

Machine-readable error codes returned in `detail` objects:

| Code | HTTP | Cause |
|---|---|---|
| `STUDIO_QUOTA_EXCEEDED` | 429 | Per-user daily variation cap (Redis) |
| `STUDIO_UPLOAD_TOO_LARGE` | 413 | File > 25 MB |
| `STUDIO_UPLOAD_BAD_MIME` | 415 | Non-allowed MIME |
| `STUDIO_IMAGE_NOT_OWNED` | 403 | Accessing another user's image |
| `STUDIO_RUN_NOT_READY` | 409 | Retry-slot called while run is still RUNNING |
| `AI_CONTENT_POLICY` | 502 | Gemini safety rejection (propagated from `generate_image_gemini`) |
| `AI_UPSTREAM_ERROR` | 502 | Gemini other failure |

Client error mapping follows the same pattern as the Phase D chat panel (doc 12 §D6 of the poster plan).
