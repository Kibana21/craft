# 00 — Overview & Phasing

Companion plan for implementing **My Studio** per `/Users/kartik/Documents/Work/Projects/craft/craft/CRAFT_MY_STUDIO_PRD.md`. This folder is the implementation counterpart to the PRD (PRD = *what*, these docs = *how*).

---

## Context

**What we're building**: a new top-level tab "My Studio" — a personal, user-scoped image workspace with (a) a permanent image library, (b) a lightweight 4-step AI enhancement workflow (Intent → Style → AI-built Prompt → Generate), and (c) a batch-workflow variant. Distinct from the Poster Wizard (no brand-kit enforcement, no MAS compliance engine, no 5-step guided wizard — this is intentionally faster and more personal).

**Why now**: gives AIA agents and marketing staff a persistent space for their own image assets and an AI enhancement pipeline that doesn't require prompt-writing expertise. Feeds the Poster Wizard via an upstream "Use in Poster Wizard" link.

**Why this is a small build, not a big one**: roughly **80% of the infrastructure already exists**. We can reuse:
- `generate_image_gemini()` (`backend/app/services/ai_service.py:120`) for both Text→Image and Image→Image
- `poster_image_service._single_variant()`'s retry + backoff + seed-phrase pattern for parallel variation generation
- `upload_image_bytes()` and the existing S3/local fallback in `upload_service.py:76`
- Celery infrastructure — add a `studio` queue alongside `video` + `poster`
- Gamification hooks (`gamification_service.award_points_once`)
- `WizardProgress` component (now with clickable-step support)
- The gallery/card + hover-action patterns from the project detail page (`projects/[id]/page.tsx`)

What's genuinely new: data model (`studio_images` + `studio_workflow_runs`), the intent-aware prompt builder, nav tab, a simpler wizard shell, batch progress UI, and the deep-link into the Poster Wizard.

---

## Goals (from PRD §2)

- Persistent, per-user image repository (private by default)
- AI enhancement in < 3 minutes median
- Guided intent collection replaces prompt-writing
- Natural upstream asset pipeline into the Poster Wizard
- Batch support for consistent multi-image processing

---

## Phasing (4 phases, each independently demoable)

### Phase A — Library foundation *(no dependencies)*
- New tables: `studio_images` (permanent, user-owned), `studio_workflow_runs`
- Alembic migration
- Backend CRUD: upload (multi-file), list (paginated, filterable), detail, rename, soft-delete
- `/my-studio` route with grid view, filter chips, search, upload dropzone, multi-select
- `CreatorNav` + `AgentNav` entries
- **Exit criteria**: a user can upload images, browse their library, rename, delete, and toggle grid/list view.

### Phase B — Single-image enhancement workflow *(depends on A)*
- `/my-studio/workflow/new?source={imageId}` — 4-step wizard:
  1. Intent selector (5 options)
  2. Style inputs (intent-specific fields)
  3. Prompt Review (AI-built prompt + "what AI added" panel + editable textarea + regenerate)
  4. Generate (1/2/4/8 variations)
- `studio_prompt_service.build_prompt(intent, style_inputs, source_image_bytes?)`
- `studio_generation_service.enqueue_run()` + Celery `studio.generate` task
- Image Detail view with Before/After slider, metadata, prompt used, actions
- **Exit criteria**: a user can enhance one uploaded image and see generated outputs saved back to the library in ≤ 3 minutes median.

### Phase C — Batch workflow *(depends on B)*
- Multi-select in library enables "⚡ Batch workflow" button
- `/my-studio/workflow/batch` — shared intent + style + prompt, applied to 2–20 images, 1/2/4 variations each
- Same Celery task path, but worker iterates `source_image_ids` with `asyncio.Semaphore(4)` for concurrency
- Batch progress panel with per-image status; notifications on completion
- **Exit criteria**: a user can select 4 headshots, run them through the same enhancement, and see results in the library; individual failures don't block the batch.

### Phase D — Integrations & polish *(depends on A–C; can overlap)*
- "Use in Poster Wizard" deep-link (opens Wizard Step 2 with StudioImage as reference)
- Poster exports auto-register in My Studio with type `POSTER_EXPORT`
- Gamification: `MY_STUDIO_UPLOAD` (5 pts), `MY_STUDIO_ENHANCE` (10 pts), `MY_STUDIO_BATCH` (25 pts)
- Mobile responsive + accessibility polish
- **Exit criteria**: round-trip flows from My Studio → Poster Wizard → export back to My Studio work end to end; all PRD §16 NFRs met.

### Dependency graph

```
A ─► B ─► C ─► D
              (D can start once A done; polish items cumulative)
```

---

## Standards Gates

Every phase must satisfy:
- **Security** (`.claude/skills/security.md`): every endpoint gated by `Depends(get_current_user)`; StudioImage access checked against `user_id`
- **Postgres** (`.claude/skills/postgres.md`): explicit FK indexes; async session; JSONB validated at the boundary
- **UI** (`.claude/skills/ui-design.md`): MUI `sx` only; AIA design tokens; fully rounded buttons; 16px card radii
- `make test-frontend` (tsc) + backend import check clean on every merge

---

## Out of Scope (v1 — defer)

- Team / shared image libraries (needs access-control infra)
- Image annotation or drawing tools
- Direct social publishing from My Studio
- Face recognition / identity matching
- Version history for enhanced images
- Watermarking (legal decision pending)
- Stock / third-party image search

All deferred per PRD §17.
