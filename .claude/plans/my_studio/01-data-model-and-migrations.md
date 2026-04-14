# 01 — Data Model & Migrations

Two new tables: **`studio_images`** (the permanent per-user library) and **`studio_workflow_runs`** (one row per enhancement run, single or batch).

Both land in a single Alembic migration (`xxxxxxxxxxxx_add_my_studio_tables.py`). HEAD after this merge: whatever revision is generated — parent is `e1f2a3b4c5d6` (Poster Wizard tables).

---

## `studio_images`

Permanent, user-owned image records. Differs from `PosterReferenceImage` (24h TTL, artifact-scoped) — these are long-lived and library-scoped.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` (PK) | server-generated `uuid4()` |
| `user_id` | `UUID` FK `users(id) ON DELETE CASCADE` | **indexed** |
| `name` | `String(200)` | user-editable; defaults to source filename |
| `type` | `StudioImageType` enum (str) | `PHOTO` \| `AI_GENERATED` \| `ENHANCED` \| `POSTER_EXPORT` — check-constrained |
| `storage_url` | `String(500)` | URL returned by `upload_image_bytes` |
| `thumbnail_url` | `String(500)`? | derived 256px-wide WebP; nullable (generated lazily) |
| `mime_type` | `String(50)` | check constraint: `image/png`, `image/jpeg`, `image/webp`, `image/heic` |
| `size_bytes` | `Integer` | check constraint ≤ 25 MB (26_214_400) |
| `width_px` | `Integer`? | captured at upload via Pillow |
| `height_px` | `Integer`? | " |
| `source_image_id` | `UUID`? FK `studio_images(id) ON DELETE SET NULL` | **indexed**; points at the original for enhanced/variation outputs. NULL for PHOTO, AI_GENERATED, POSTER_EXPORT. |
| `workflow_run_id` | `UUID`? FK `studio_workflow_runs(id) ON DELETE SET NULL` | **indexed**; which run produced this (NULL for uploads) |
| `prompt_used` | `Text`? | full merged prompt (for outputs only); lets Detail view show "Prompt used" |
| `tags` | `JSONB`? | `list[str]` — reserved for future search; v1 stores `[]` |
| `metadata` | `JSONB`? | free-form — poster artifact id for POSTER_EXPORT, etc. |
| `created_at` | `TIMESTAMPTZ` | default `now()` |
| `updated_at` | `TIMESTAMPTZ` | auto-updated on write |
| `deleted_at` | `TIMESTAMPTZ`? | soft delete |

**Indexes**:
- `idx_studio_images_user_id` on `user_id`
- `idx_studio_images_type` on `type`
- `idx_studio_images_source_image_id` on `source_image_id`
- `idx_studio_images_workflow_run_id` on `workflow_run_id`
- `idx_studio_images_user_created` on `(user_id, created_at DESC)` — powers default library listing without sort scans
- Partial index: `idx_studio_images_active` on `user_id WHERE deleted_at IS NULL`

**Soft-delete rule**: `deleted_at` set; outputs whose source was deleted become standalone (NULL `source_image_id` already by FK). Never hard-delete.

---

## `studio_workflow_runs`

One row per Enhancement Workflow run. Captures inputs, the AI-built prompt, and status. Outputs reference the run via `studio_images.workflow_run_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` (PK) | |
| `user_id` | `UUID` FK users CASCADE | **indexed** |
| `intent` | `StudioIntent` enum (str) | `MAKE_PROFESSIONAL` \| `CHANGE_BACKGROUND` \| `ENHANCE_QUALITY` \| `VARIATION` \| `CUSTOM` — check-constrained |
| `is_batch` | `Boolean` | default `False` |
| `source_image_ids` | `JSONB` (list[UUID-str]) | 1 for single; 2–20 for batch |
| `style_inputs` | `JSONB` | intent-specific form values — validated by Pydantic at API boundary |
| `merged_prompt` | `Text` | the AI-built prompt actually sent to the model |
| `ai_enrichments` | `JSONB` (list[str]) | short labels for the "What the AI added" panel |
| `variation_count` | `Integer` | 1/2/4/8 (check constraint ≤ 8) |
| `status` | `WorkflowStatus` enum (str) | `QUEUED` \| `RUNNING` \| `DONE` \| `FAILED` \| `PARTIAL` — check-constrained |
| `progress_percent` | `Integer` | 0–100 (for polling) |
| `error_message` | `Text`? | populated on FAILED |
| `started_at` | `TIMESTAMPTZ`? | set when worker picks up |
| `completed_at` | `TIMESTAMPTZ`? | set on DONE/FAILED/PARTIAL |
| `created_at`, `updated_at` | | standard |

**Indexes**:
- `idx_studio_workflow_runs_user_id` on `user_id`
- `idx_studio_workflow_runs_status` on `status`
- Partial index `idx_studio_workflow_runs_active` on `(user_id) WHERE status IN ('QUEUED','RUNNING')`

**No `deleted_at`** — runs are audit records, not user-facing data. Aged runs can be archived by a sweep job in a later phase.

---

## Enums (string-backed, per project convention)

Land in `backend/app/models/enums.py`:

```python
class StudioImageType(str, enum.Enum):
    PHOTO          = "PHOTO"
    AI_GENERATED   = "AI_GENERATED"
    ENHANCED       = "ENHANCED"
    POSTER_EXPORT  = "POSTER_EXPORT"

class StudioIntent(str, enum.Enum):
    MAKE_PROFESSIONAL  = "MAKE_PROFESSIONAL"
    CHANGE_BACKGROUND  = "CHANGE_BACKGROUND"
    ENHANCE_QUALITY    = "ENHANCE_QUALITY"
    VARIATION          = "VARIATION"
    CUSTOM             = "CUSTOM"

class WorkflowStatus(str, enum.Enum):
    QUEUED   = "QUEUED"
    RUNNING  = "RUNNING"
    DONE     = "DONE"
    FAILED   = "FAILED"
    PARTIAL  = "PARTIAL"
```

Also add `PointsAction.MY_STUDIO_UPLOAD`, `MY_STUDIO_ENHANCE`, `MY_STUDIO_BATCH` to the existing PointsAction enum.

---

## JSONB schemas (validated at the API boundary)

`style_inputs` is a discriminated shape. Pydantic models in `backend/app/schemas/studio.py`:

```python
class MakeProfessionalInputs(BaseModel):
    setting: list[Literal["OFFICE","OUTDOOR","STUDIO","BLURRED"]]
    attire: Literal["KEEP","MORE_FORMAL"]
    mood: Literal["CONFIDENT","WARM","APPROACHABLE"]
    notes: str | None = None

class ChangeBackgroundInputs(BaseModel):
    new_background: Literal["OFFICE_INTERIOR","OUTDOOR_NATURE","CITY_SKYLINE","ABSTRACT","PLAIN_COLOUR","CUSTOM"]
    lighting_match: Literal["MATCH","RELIGHT"]
    description: str | None = None  # required when new_background == "CUSTOM"

class EnhanceQualityInputs(BaseModel):
    focus_areas: list[Literal["LIGHTING","SHARPNESS","COLOUR","SKIN_TONES","BG_BLUR"]]
    output_resolution: Literal["SAME","UPSCALE_2X","UPSCALE_4X"]

class VariationInputs(BaseModel):
    difference_level: int = Field(ge=10, le=90)  # slider 10..90
    keep_consistent: list[Literal["IDENTITY","PALETTE","COMPOSITION","MOOD"]]
    style_direction: Literal["SAME","MORE_PROFESSIONAL","MORE_ARTISTIC","MORE_VIBRANT"]

class CustomInputs(BaseModel):
    description: str
    use_source_as_reference: bool = True

StyleInputs = Annotated[
    Union[MakeProfessionalInputs, ChangeBackgroundInputs, EnhanceQualityInputs, VariationInputs, CustomInputs],
    Field(discriminator=None),  # discriminated by the run's `intent` column; not embedded
]
```

---

## Migration mechanics

- Revision: `<hash>_add_my_studio_tables` — parent `e1f2a3b4c5d6`.
- Creates both tables, all indexes, all check constraints.
- Adds PointsAction values via Alembic `op.execute` on the Postgres enum.
- Downgrade: drop constraints → indexes → tables in reverse, then remove enum values (Postgres doesn't support removing enum values cleanly — document "downgrade requires recreating the enum type" as a known caveat).

No cascading schema work elsewhere.

---

## Seed-data considerations

None for v1. Seed script (`backend/scripts/seed.py`) does not need changes — My Studio is per-user and starts empty for every seeded account.
