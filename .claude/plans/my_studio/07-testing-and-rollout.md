# 07 — Testing & Rollout

What to verify before each phase ships, and the open questions to resolve along the way.

---

## Test matrix (by phase)

### Phase A — Library foundation

**Backend**
- Upload: single file, multi-file (3 files), oversized file (> 25 MB → 413), bad MIME (→ 415), non-image payload (→ 415).
- List: user-scope isolation (user B can't see user A's images); type filter returns only matching rows; search `q` ILIKE match; pagination correctness on 50+ images.
- Get: 404 on non-existent; 403 on another user's image.
- Rename: persists; empty name rejected.
- Soft delete: row `deleted_at` set; subsequent GET returns 404; list query no longer includes it.

**Frontend**
- Grid/list toggle persists across page refreshes via localStorage (optional polish).
- Empty state renders for a fresh account.
- Upload dropzone accepts multi-file drag + browse-files; rejects files > 25 MB before sending (client-side guard + server guard both).
- Multi-select: clicking a card's checkbox enters selection mode; "Batch workflow" button disabled until 2+ selected (matches PRD §11.2 entry rule).
- Filter chips + search both reset pagination to page 1.

### Phase B — Single-image enhancement workflow

**Backend**
- Prompt builder: each intent returns a non-empty `merged_prompt` + 3–5 `ai_enrichments`; source-image analysis injects subject language when `source_image_id` provided; JSON-parse failure falls back to skeleton + empty enrichments.
- Generate: single run with variation_count ∈ {1,2,4,8} creates that many `studio_images` rows on DONE; each output has `source_image_id`, `workflow_run_id`, `prompt_used` populated.
- Quota: simulated 100-variation cap on the day → 429 `STUDIO_QUOTA_EXCEEDED`.
- Retry-slot: failing a single Gemini call (mock), then retry-slot, produces exactly one new image row.

**Frontend**
- 4-step wizard navigable forward + back; step indicator shows completed/current/pending; clicking a completed step jumps back (retains state).
- Style inputs adapt to intent: switching intent wipes incompatible fields.
- Prompt Review textarea is editable; Regenerate counter caps at 3; Previous-prompt undo works.
- Generate screen polls every 2 s, renders thumbnails as they arrive.
- Save-to-library is a no-op at the DB level (outputs already persist) but closes the workflow and routes back to `/my-studio`.
- Detail view Before/After slider drag + keyboard (← →) both work.

### Phase C — Batch workflow

**Backend**
- Batch of 4 × 1-variation: 4 Gemini calls in parallel (concurrency ≤ 4); run ends DONE.
- Batch 20 × 4 = 80 variations: capped at 40 per PRD; 20 × 2 = 40 runs fine.
- Individual failure: mock one slot to fail → run ends PARTIAL, 15/16 outputs saved, failed slot reported in status with retry handle.
- Concurrent runs by the same user: second dispatch blocked until first completes (reuse the poster "one active job" pattern if needed — or allow parallel, since runs are independent).

**Frontend**
- Selected ≥ 2 images → "Batch workflow" button unlocks.
- Batch page can add more images via "+ Add more".
- Progress panel updates per-image (polling hook), individual retry button works.
- Notification fires when the run completes in the background.

### Phase D — Integrations

**Poster Wizard deep-link**
- "Use in Poster Wizard" on a StudioImage → navigates to `/projects/{...}/artifacts/new-poster/subject?load=...&ref=...`.
- Subject step hydrates with the reference image visible + `subject.type = "PRODUCT_ASSET"` locked in.
- Original StudioImage is unchanged; the PosterReferenceImage row has a 24h `expires_at`.

**Poster export auto-import**
- Export a poster as PNG → on completion, `studio_images` row created with `type=POSTER_EXPORT`, `metadata->>'export_log_id'` set.
- Re-exporting the same poster (idempotent?) does NOT duplicate — existing row is found by `export_log_id`.
- MP4 exports do NOT create StudioImage rows.

**Gamification**
- Upload 3 images → +15 points (3 × 5).
- Run single enhancement → +10 points; re-running the same run via retry-slot does NOT double-award (idempotent on `related=run_id`).
- Batch run → +25 points regardless of image count.

---

## Unit test locations

- `backend/tests/test_studio_image_service.py` — CRUD + ownership + soft delete behaviour.
- `backend/tests/test_studio_prompt_service.py` — prompt skeleton correctness per intent; LLM fallback path.
- `backend/tests/test_studio_generation_worker.py` — mocked `generate_image_gemini`, verify row creation, status transitions, concurrency respect.
- `backend/tests/test_studio_integration_poster.py` — the poster bridge endpoint + reference-image creation.

Existing backend has **no tests** (see `backend/tests/` — just `__init__.py` + `conftest.py`). These would be the first real tests. Value high; effort moderate. Recommend writing at least the three most important ones alongside Phase B.

Frontend typecheck (`cd frontend && npx tsc --noEmit`) on every merge — CRAFT has no runtime tests currently but tsc clean is a hard gate.

---

## Performance sanity checks (PRD §16.1)

| Operation | Target | Measurement |
|---|---|---|
| Library load (100 images) | < 2 s | Open DevTools Network; measure `GET /images` with `per_page=100` response time |
| Thumbnail render | First frame < 500 ms | Progressive image loading; `<img loading="lazy">` |
| Prompt building | < 6 s | Measure `POST /workflows/prompt-builder` latency |
| Single variation | < 30 s | `studio_slot_succeeded` log `duration_ms` p50 |
| Batch start (first image) | < 30 s | Time from dispatch to first `studio_slot_succeeded` |
| Upload 25 MB | < 10 s on broadband | Manual smoke |

If any regress beyond the target, add a log metric and revisit.

---

## Rollout plan

### Pre-merge per phase

- `make test-frontend` (tsc) clean
- `python -c "from app.main import app; print('OK')"` clean
- Manual smoke of the exit-criteria flow in doc 00

### Post-merge

- Phase A → dogfood internally (brand team + one FSC) for 2 days before Phase B ships.
- Phase B → same.
- Phase C → open to ~10 agents for a week; measure: median time-to-first-output (target < 3 min per PRD §2.2) and "% prompts accepted without major edits" (target > 60%).
- Phase D → GA once metrics above look healthy.

### Rollback plan

- Nav tab can be hidden via a simple conditional check (e.g. `if (user.email in STUDIO_ALLOWLIST)` for Phase A) if we want a soft rollout. Otherwise remove the `NAV_LINKS` entry to pull the tab without touching routes.
- Routes themselves can stay; the auth guard protects them regardless of nav.
- DB tables stay — they're additive. No destructive rollback needed.

---

## Open questions / decisions deferred to implementation

1. **Project selection for "Use in Poster Wizard"**: do we always prompt for project, or auto-pick most recent? (See doc 06 §1.) Recommend: auto-pick recent; add a small picker only if > 1 active project.

2. **Per-image points on upload**: unlimited 5-pt awards per upload (gameable) vs. daily cap vs. lifetime cap? Recommend daily cap: first 5 uploads per day award; 6th+ award 0. Matches existing gamification spirit.

3. **Thumbnail generation timing**: inline on upload (adds ~200 ms latency per file) vs. lazy on first GET? Recommend **inline** — first-view latency matters more than upload latency, and uploads are already async client-side.

4. **HEIC handling**: Pillow doesn't read HEIC natively on all platforms. Either install `pillow-heif` as a backend dependency or reject HEIC at upload and ask the user to convert. Recommend adding `pillow-heif` — the PRD explicitly lists HEIC as a supported format.

5. **Library capacity (500 images, PRD §14.1)**: enforced at the DB or just a soft banner? Recommend soft banner at 450 + hard block at 500 — surfaces the constraint without a silent surprise.

6. **Batch failure threshold**: if >50% of images fail, should the run be FAILED instead of PARTIAL? Recommend: always PARTIAL if ≥ 1 succeeds, FAILED if all fail. Simpler mental model for users.

7. **Regeneration-count persistence**: client-side only for v1 (doc 03 §Prompt Regeneration). Move to server if users start hammering it — would need `regeneration_count` on `studio_workflow_runs`.

8. **Sweep job for old workflow runs**: runs table grows forever. Add a 90-day sweep similar to the poster-chat-turns sweep — not urgent for v1.

---

## Documentation to update on ship

On Phase A merge:
- `CLAUDE.md` (root) — Implementation Status: add "My Studio — Phase A shipped"; API Surface: add `studio` router row; Data Models: add `studio_images` and `studio_workflow_runs`; Migration Chain HEAD update.
- `backend/CLAUDE.md` — Models section, API Routes table, Services list, Celery queue config, migration chain.
- `frontend/CLAUDE.md` — Project Structure tree, API Modules (`studio.ts`), Types, a short Shared Components note for the new wizard shell.

Same delta pattern as the Phase D poster merge.
