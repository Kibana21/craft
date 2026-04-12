# 01 — Data Model & Migrations

## Decision: JSONB-First, with Two Small Relational Tables

The existing `artifacts` table already has a JSONB `content` column used for all artifact types. Poster Wizard extends this rather than replacing it:

- **Core poster state** (brief, subject, copy, composition, generation metadata) lives inside `artifacts.content`.
- **Chat refinement turns** get their own table — they are append-only, queried separately from the artifact, and need retention policy (30 days per PRD §14.3).
- **Session-temporary reference images** get their own table with TTL sweeping — they should not pollute the persistent `uploads` tier.

**Why JSONB for core state:**
1. Matches existing artifact shape. Other types (WhatsApp card, reel) already use JSONB; posters breaking the pattern would hurt consistency.
2. Schema evolves fast during wizard v1; relational churn would slow iteration.
3. Validation still happens at the API boundary via Pydantic (doc 02) — JSONB does not mean unstructured.

**Why separate tables for chat turns and temp refs:**
1. Both have different retention policies from the poster itself (PRD §14.3).
2. Chat turns can be numerous; embedding them in JSONB would bloat the artifact row.
3. Temp refs need a sweep job and TTL column that doesn't belong on the artifact.

---

## Poster `content` JSONB Schema

Normative shape for `Artifact.content` when `type = 'POSTER'`:

```json
{
  "schema_version": 1,
  "brief": {
    "title": "string (required)",
    "campaign_objective": "PRODUCT_LAUNCH | BRAND_AWARENESS | LEAD_GENERATION | EVENT_PROMOTION | POLICY_RENEWAL",
    "target_audience": "string",
    "tone": "PROFESSIONAL | INSPIRATIONAL | ENERGETIC | EMPATHETIC | URGENCY_DRIVEN",
    "call_to_action": "string",
    "narrative": "string (<= 1500 chars)"
  },
  "subject": {
    "type": "HUMAN_MODEL | PRODUCT_ASSET | SCENE_ABSTRACT",
    "human_model": {
      "appearance_keywords": "string",
      "expression_mood": "string",
      "full_appearance": "string (40-80 words target)",
      "posture_framing": "FACING_CAMERA | THREE_QUARTER | PROFILE | LOOKING_UP"
    },
    "product_asset": {
      "reference_image_ids": ["uuid"],
      "placement": "HERO_CENTRED | LIFESTYLE_CONTEXT | DETAIL_CLOSE | FLOATING",
      "background_treatment": "REPLACE | EXTEND | KEEP_ORIGINAL | ABSTRACT_BLEND"
    },
    "scene_abstract": {
      "description": "string",
      "visual_style": "PHOTOREALISTIC | EDITORIAL_GRAPHIC | ILLUSTRATED | ABSTRACT_PAINTERLY | MINIMALIST"
    },
    "locked": "boolean"
  },
  "copy": {
    "headline": "string (required)",
    "subheadline": "string",
    "body": "string",
    "cta_text": "string (required)",
    "brand_tagline": "string",
    "regulatory_disclaimer": "string",
    "compliance_flags": [
      { "field": "headline", "pattern_type": "ABSOLUTE_CLAIM", "matched_phrase": "guaranteed", "severity": "WARNING", "at": "iso8601" }
    ]
  },
  "composition": {
    "format": "PORTRAIT | SQUARE | LANDSCAPE | STORY | CUSTOM",
    "custom_dimensions": { "width_px": 0, "height_px": 0 },
    "layout_template": "HERO_DOMINANT | SPLIT | FRAME_BORDER | TYPOGRAPHIC | FULL_BLEED",
    "visual_style": "CLEAN_CORPORATE | WARM_HUMAN | BOLD_HIGH_CONTRAST | SOFT_ASPIRATIONAL | DARK_PREMIUM | ILLUSTRATED_GRAPHIC",
    "palette": ["#hex"],
    "merged_prompt": "string",
    "merged_prompt_stale": "boolean",
    "prompt_generated_at": "iso8601"
  },
  "generation": {
    "variants": [
      {
        "id": "uuid",
        "image_url": "string",
        "generated_at": "iso8601",
        "status": "READY | FAILED | GENERATING",
        "selected": "boolean",
        "parent_variant_id": "uuid | null",
        "change_log": [
          { "id": "uuid", "description": "string", "accepted_at": "iso8601" }
        ]
      }
    ],
    "last_generation_job_id": "uuid",
    "turn_count_on_selected": 0
  }
}
```

**Field-level notes:**
- `schema_version: 1` enables forward-compatible migration if we later move any subtree into relational storage.
- Enums are stored as strings (matches existing convention in `Artifact.type`, `ComplianceRule.severity`).
- `subject.locked` flips true on first Step 5 generation (PRD §12.1); flipping back requires explicit composition regeneration.
- `composition.merged_prompt_stale` is set when Step 3 copy changes after prompt generation (PRD §12.3).
- `generation.variants[].change_log` is **session-only** per PRD §14.3 — it is stored here only while the session is active. Cleared on final export or 30-day sweep (see §Retention Sweeps).

Validation lives in a Pydantic model `PosterContent` (doc 02).

---

## New Tables

### `poster_chat_turns`
Append-only log of Step 5 refinement turns. Kept 30 days.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Server-generated |
| `artifact_id` | UUID FK → `artifacts.id` ON DELETE CASCADE | Indexed |
| `variant_id` | UUID | Which variant (from `content.generation.variants[].id`) this turn refines |
| `turn_index` | INT | 0-based; ≤ 5 at point of save-as-variant nudge |
| `user_message` | TEXT | User's refinement request |
| `ai_response` | TEXT | AI's confirmation/description |
| `action_type` | STRING | `CHAT_REFINE | INPAINT | REDIRECT | TURN_LIMIT_NUDGE` |
| `resulting_image_url` | STRING (nullable) | Set when this turn produced a new image |
| `inpaint_mask_url` | STRING (nullable) | Used when `action_type = INPAINT` |
| `structural_change_detected` | BOOLEAN | True when classifier redirects instead of processing |
| `created_at` | TIMESTAMP | Default now |
| `deleted_at` | TIMESTAMP | Soft delete (standard convention) |

**Indexes:**
- `idx_poster_chat_turns_artifact_id` (FK)
- `idx_poster_chat_turns_variant_id` (common lookup)
- `idx_poster_chat_turns_created_at` (for 30-day sweep)

### `poster_reference_images`
Session-temporary tier separate from persistent uploads. TTL enforced by sweep job.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Server-generated |
| `uploader_id` | UUID FK → `users.id` ON DELETE CASCADE | Indexed |
| `artifact_id` | UUID FK → `artifacts.id` ON DELETE CASCADE (nullable) | Populated once wizard has an associated artifact draft |
| `storage_url` | STRING | S3/R2 path or local `/uploads/` path |
| `mime_type` | STRING | `image/png | image/jpeg | image/webp` |
| `size_bytes` | INT | Hard cap 20 MB (PRD §12.7) |
| `expires_at` | TIMESTAMP | Default `now() + INTERVAL '24 hours'` *(TTL decision — see doc 11)* |
| `created_at` | TIMESTAMP | Default now |

**Constraints:**
- CHECK `size_bytes <= 20971520` (20 MB)
- CHECK `mime_type IN (...)` enum
- Per-artifact cap of 3 images enforced at API layer (PRD §12.7)

**Indexes:**
- `idx_poster_reference_images_uploader_id`
- `idx_poster_reference_images_artifact_id`
- `idx_poster_reference_images_expires_at` (sweep job scans this)

### Existing tables touched

- `artifacts.content` — new validation + `schema_version` contract. No column change.
- `artifacts` — no schema change.
- `compliance_checks` — possibly adds `field_name` column later (doc 08); deferred to Phase E.

---

## Alembic Migration Plan

Single migration file introduced at Phase A start. Alembic convention in this repo: revisions live under `backend/alembic/versions/`. Example filename: `005_poster_wizard.py`.

```python
def upgrade():
    op.create_table('poster_chat_turns', ...)
    op.create_index('idx_poster_chat_turns_artifact_id', ...)
    op.create_index('idx_poster_chat_turns_variant_id', ...)
    op.create_index('idx_poster_chat_turns_created_at', ...)

    op.create_table('poster_reference_images', ...)
    op.create_index('idx_poster_reference_images_uploader_id', ...)
    op.create_index('idx_poster_reference_images_artifact_id', ...)
    op.create_index('idx_poster_reference_images_expires_at', ...)

def downgrade():
    op.drop_index(...); op.drop_table(...)
    # fully reversible
```

Revisions in later phases (D, E) may add:
- `compliance_checks.field_name` column (Phase E, doc 08)
- `artifacts.content` GIN index if specific paths are queried heavily (monitor first)

No existing column renames, no destructive changes.

---

## Retention Sweeps

Two background jobs, registered under `backend/app/jobs/` (new folder if it does not yet exist; follow existing background-task patterns in `backend/app/services/`):

1. **`sweep_expired_reference_images`** — runs hourly. Deletes `poster_reference_images` rows where `expires_at < now()` and removes the corresponding S3/R2 object.
2. **`sweep_old_chat_turns`** — runs daily. Soft-deletes `poster_chat_turns` rows older than 30 days (sets `deleted_at`). Hard deletion can be a separate quarterly job.

If the repo does not yet have a scheduler, use FastAPI `BackgroundTasks` triggered on a schedule via an external cron (simplest for MVP). Upgrade to Celery Beat or APScheduler if volume warrants — defer that decision.

---

## Why Not a Dedicated `posters` Table?

Considered and rejected for v1. Reasons:
- The JSONB shape matches other artifact types; introducing a parallel relational structure breaks the single-artifact abstraction used by list views, search, and export.
- Query patterns on the wizard are overwhelmingly **by artifact id** (open-draft, continue-draft, read-for-render). No cross-poster aggregation that JSONB makes hard.
- If future v2 work needs e.g. variant-level analytics with strong relational joins, we can extract `poster_variants` then. Schema-v2 migration stays cleanly scoped.

---

## Cross-references

- Request/response Pydantic contracts → doc 02.
- `structural_change_detected` classifier design → docs 03, 07.
- Reference-image upload endpoint + sweep wiring → doc 04.
- `compliance_flags[]` producer contract → doc 08.
- Testing migrations & sweeps → doc 10.

*Continue to `02-backend-api-surface.md`.*
