# Reliability & Demo-Readiness Hardening Plan

## Context

A live demo at AIA surfaced that projects and artifacts would intermittently appear empty, then "come back" after refresh / logout / navigation. Root cause was ~11 frontend call sites using `.catch(() => {})` or `.catch(() => [])` that silently turned transient backend failures into visible empty states. We just finished migrating the biggest list surfaces to TanStack Query with proper retry + stale-while-revalidate + invalidation (see `frontend/src/lib/query-client.ts`, `query-keys.ts`, `components/common/error-banner.tsx`).

A three-track audit (frontend / backend / operational) found **additional areas with the same or adjacent patterns**. This plan sequences them so the user can ship the highest-impact fixes first (tactical, pre-next-demo) and carry the rest as structured tech-debt without rushing.

**Outcome target**: no more "data disappeared" demo moments; errors become visible, retryable, and recoverable; backend stops silently swallowing failures in places the user can see.

---

## Execution tiers (in order)

### Tier 0 — Before the next demo (≤ 1 hour, zero-risk)

**0.1 Disable uvicorn `--reload` for demo sessions**
- File: `Makefile:11` — remove `--reload` from the `backend` target, OR create a second target `backend-demo` without it.
- Rationale: `--reload` is the single biggest amplifier of flakiness; every `.py` save kills in-flight requests.
- Effort: 1 line.

**0.2 Pre-demo smoke checklist (manual, documented)**
- New file: `docs/PRE_DEMO_CHECKLIST.md` — 10 items covering: PG up, Redis up, `video-key.json` present, `make seed` produces demo-quality data, login → create project → upload → generate → export works end-to-end.
- Rationale: zero integration tests exist; a manual checklist is the cheapest hedge.
- Effort: 15 min.

**0.3 Drop leftover test uploads**
- `rm -rf backend/uploads/poster-variants/* backend/uploads/studio/*` before any demo.
- Add to the checklist above.

**0.4 Write `.env.example`**
- New file: `backend/.env.example` listing every var read by `app/core/config.py:Settings`.
- Rationale: a colleague running the demo instead needs this; `.env` is git-ignored.
- Effort: 10 min.

### Tier 1 — Frontend reliability (remaining silent catches, ~2–3 hrs)

These are the `.catch(() => {})` / `.catch(() => null)` patterns the Tier-0 migration didn't reach. Apply the same pattern we used for the list pages: migrate to `useQuery` / `useMutation`, surface errors via `<ErrorBanner />` (at `frontend/src/components/common/error-banner.tsx`), preserve data on failure.

**1.1 Remaining component fetches (CRITICAL — user-visible)**
Migrate each to `useQuery` with a proper query key; add `ErrorBanner` render path:
- `frontend/src/components/compliance/score-breakdown.tsx:25`
- `frontend/src/components/artifacts/comment-thread.tsx:26`
- `frontend/src/app/(authenticated)/leaderboard/page.tsx:27`

**1.2 Wizard init fetches (CRITICAL — blank-screen-on-blip)**
Each wizard `layout.tsx` fetches artifact + session on mount and silently swallows errors, leaving a blank page. Replace with `useQuery` AND an error UI:
- Video: `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/layout.tsx:~69`
- Video presenter step: `.../video/presenter/page.tsx:40`
- Poster: `frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/layout.tsx:~165,212`
- Studio workflow: `frontend/src/app/(authenticated)/my-studio/workflow/new/page.tsx:102` and `batch/page.tsx:59`

**1.3 Mutation failures that silently route forward (HIGH — data-loss appearance)**
These `.catch()` blocks swallow save errors and still `router.push` to the next step — the user thinks it saved, it didn't:
- `video/script/page.tsx:84` (handleSave)
- `video/storyboard/page.tsx:108,119` (scene gen + reload)

**1.4 Polling hook error surfacing (HIGH — stuck spinners)**
- `frontend/src/hooks/useVideoPolling.ts:34` — surface errors to caller; the caller should render a banner when `anyActive && error`.
- `frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/_hooks/use-variant-generation.ts:108` — already has `error` state; audit whether the caller actually renders it (`generate/page.tsx`).

**1.5 Root error boundary (HIGH — single uncaught exception crashes whole app)**
- `frontend/src/app/layout.tsx` — wrap children in a React error boundary. Use a minimal `ErrorBoundary` class component or install `react-error-boundary` (already a transitive dep of `@tanstack/react-query` — check first; if not, it's MIT and ~2 KB).
- Fallback UI: friendly "Something went wrong" + reload button. Log to console (or Sentry when configured).

**1.6 Token storage (HIGH — breaks multi-tab demos)**
- `frontend/src/lib/auth.ts:6-14` — access token is in `sessionStorage` (per-tab), refresh in `localStorage`. Open the app in a second tab = second tab has no session, even though the user is "logged in."
- Fix: move access token to `localStorage` AND listen to `storage` events so tab A's logout propagates to tab B. Risk: slightly larger XSS exposure surface — acceptable given CRAFT's threat model.

**1.7 Double-submit guards (MEDIUM)**
- New project wizard, poster generate, studio generate — audit every Continue button and confirm `disabled={isSubmitting}` is set. Most are correct; grep for `onClick={handleContinue` and verify.

**1.8 Polling hooks: AbortController on unmount (MEDIUM)**
- `useVideoPolling`, `useVariantGeneration`, `useStudioRunPolling` — add AbortController so unmount cancels in-flight requests. Prevents "setState on unmounted component" warnings and stale updates after navigation.

### Tier 2 — Backend reliability & data integrity (~3–4 hrs)

**2.1 Silent exception swallowers (CRITICAL — masks real failures)**
- `backend/app/api/artifacts.py:71` — `_award_points_bg` uses bare `except: pass`; no log. Add `logger.warning(..., exc_info=True)`.
- `backend/app/services/scoring_task.py:22-24` — `print` instead of `logger.error`. Same fix.
- `backend/app/services/poster_generation_worker.py:146-148` — catches but doesn't re-raise; Celery task shows as COMPLETED when it's actually failed. Re-raise after logging + persisting status to the DB.
- `backend/app/services/video_generation_worker.py:106-111` — notification failure swallowed silently. Log and add a pending-notification flag so a retry path exists.

**2.2 Missing ownership check on export (CRITICAL — security)**
- `backend/app/services/export_service.py:31-36` (`trigger_export`) — no verification that the requesting user owns the artifact or is a project member. Any authenticated user can export any artifact by guessing a UUID.
- Fix: add `await require_artifact_access(artifact_id, current_user, db)` (helper already exists at `backend/app/core/rbac.py`).

**2.3 No rollback on generate-variants dispatch failure (CRITICAL — partial-write state)**
- `backend/app/api/poster_ai.py:355-381` — if `dispatch_generate_variants_job()` raises after mutating `artifact.content`, no `db.rollback()`. Wrap in try/except and roll back.

**2.4 Background-task export stuck in "processing" (HIGH)**
- `backend/app/api/exports.py:28` — `BackgroundTasks.add_task(run_export, ...)` swallows the task's exception; `ExportLog.status` stays `processing` forever. The user polls and sees no progress.
- Fix: either (a) move export to Celery with a task result written to `ExportLog.status`, OR (b) add a sweep job that flips `processing` rows > 24h old to `failed`.

**2.5 Race: concurrent poster chat turns (MEDIUM — turn-cap bypass)**
- `backend/app/services/poster_refine_service.py:175-320` — `count_turns()` and turn insertion are in separate transactions. Two concurrent requests can both pass the limit check. Already uses `with_for_update()` on the artifact row but the count query doesn't lock.
- Fix: move `count_turns()` + the turn-insert into one transaction behind the same `with_for_update` lock.

**2.6 Orphan sweeps (MEDIUM — data hygiene)**
Extend existing sweep pattern (`poster_sweep_service`, studio orphan sweep in `main.py` lifespan):
- `PosterReferenceImage` — 24h TTL already on the model; add auto-trigger (startup sweep + periodic Celery beat task).
- `ExportLog` — flip `processing` > 24h to `failed`.
- `poster_chat_turns` — variant_id is a JSONB reference not a FK; turns for deleted variants become orphans. Add a sweep that purges turns whose `variant_id` no longer appears in `artifact.content.generation.variants[].id`.

**2.7 Redis fail-open logs a warning (HIGH — observability)**
- `backend/app/services/studio_generation_service.py:41-82` and equivalent in gamification / poster image service — when Redis is unreachable, the code continues silently. Already logs in some places, not all. Ensure every `except Exception` around Redis has a `logger.warning("...", exc_info=True)` so ops can tell when quotas aren't being enforced.

**2.8 Rate limiting on AI endpoints (HIGH — cost/quota protection)**
- `/api/ai/generate-image`, `/api/ai/generate-taglines`, `/api/ai/poster/generate-variants`, `/api/ai/poster/refine-chat`, `/api/studio/workflows/generate` — no rate limit.
- Install `slowapi` (or similar). Apply `@limiter.limit("10/minute")` per user. Protects daily Vertex quota.

**2.9 Auth: refresh endpoint rate limit + token rotation (MEDIUM)**
- `backend/app/core/auth.py` — `POST /auth/refresh` has no rate limit and doesn't rotate the refresh token. Issue a new refresh token on refresh; invalidate the old one.

**2.10 JWT expiry on an active session (MEDIUM — but causes weird UX)**
- Access token: 60 min. Refresh token: 7 days. Current flow: 401 → redirect to login, no refresh attempt.
- Add interceptor in `frontend/src/lib/api-client.ts`: on 401, try one refresh via `/api/auth/refresh`; if it succeeds, replay the original request; only redirect on second failure.

### Tier 3 — Operational hygiene (≥ 1 day, structured)

**3.1 Structured request-ID logging**
- FastAPI middleware that generates a UUID per request, attaches it to structured logs + to the `X-Request-ID` response header. Client stores it and includes it in error banners so users can quote it.
- Replace ad-hoc `logger.info(...)` calls in workers with `structlog` or `loguru` with a consistent JSON format.

**3.2 Integration tests on critical paths (HIGH)**
Write pytest coverage for: login, create project, create artifact, upload studio image, generate one poster variant (mock Gemini), delete project/artifact. Even 10 tests closes the biggest regression hole.
- Location: `backend/tests/` (currently empty aside from `conftest.py`).
- Target: run on every commit via GitHub Actions.

**3.3 CI/CD (MEDIUM)**
- New: `.github/workflows/ci.yml` — run on PR: `make lint` + `make test-backend` + `npx tsc --noEmit` + `npm run build`.
- Effort: 1 hr for a minimal version.

**3.4 Error tracking (MEDIUM)**
- Install Sentry (frontend + backend) OR a self-hosted equivalent. Critical for catching errors you didn't see live.
- Gated behind env var so it's silent in dev.

**3.5 Top-level README (LOW but important)**
- `README.md` currently has only `# craft`. Add a 15-line quickstart (clone → install → migrate → seed → 3 terminal commands). Pulls from what's already in `CLAUDE.md`.

---

## Critical files to modify (by tier)

### Tier 0
- `Makefile`
- `backend/.env.example` (new)
- `docs/PRE_DEMO_CHECKLIST.md` (new)

### Tier 1 (frontend reliability)
- `frontend/src/components/compliance/score-breakdown.tsx`
- `frontend/src/components/artifacts/comment-thread.tsx`
- `frontend/src/app/(authenticated)/leaderboard/page.tsx`
- `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/layout.tsx`
- `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/{presenter,script,storyboard}/page.tsx`
- `frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/layout.tsx`
- `frontend/src/app/(authenticated)/my-studio/workflow/{new,batch}/page.tsx`
- `frontend/src/hooks/useVideoPolling.ts`
- `frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/_hooks/use-variant-generation.ts`
- `frontend/src/hooks/useStudioRunPolling.ts`
- `frontend/src/app/layout.tsx` (error boundary)
- `frontend/src/lib/auth.ts` (token storage)
- `frontend/src/lib/api-client.ts` (401 refresh interceptor — Tier 2 link)

### Tier 2 (backend)
- `backend/app/api/artifacts.py` (silent points award)
- `backend/app/services/scoring_task.py` (print → logger)
- `backend/app/services/poster_generation_worker.py` (re-raise on fail)
- `backend/app/services/video_generation_worker.py` (notification retry)
- `backend/app/services/export_service.py` (ownership check)
- `backend/app/api/poster_ai.py` (rollback on dispatch failure)
- `backend/app/api/exports.py` (Celery-ify or sweep ExportLog)
- `backend/app/services/poster_refine_service.py` (single-txn turn count + insert)
- `backend/app/services/poster_sweep_service.py` (extend with new sweeps)
- `backend/app/main.py` (startup sweeps for PosterReferenceImage, ExportLog)
- `backend/app/core/auth.py` (refresh rotation, rate limit)
- `backend/app/api/ai.py`, `poster_ai.py`, `studio.py` (rate limits on AI endpoints)

### Tier 3 (operational)
- `.github/workflows/ci.yml` (new)
- `backend/tests/test_*.py` (new)
- `README.md`
- Sentry config (frontend + backend)

---

## Patterns & utilities to reuse (don't rebuild)

Already built in this session — use them:

- **`ErrorBanner`** — `frontend/src/components/common/error-banner.tsx`. Amber stale-while-revalidate banner with retry button. Compact variant for cards.
- **`queryKeys`** — `frontend/src/lib/query-keys.ts`. Typed key factory; add new keys here, don't hard-code arrays in call sites.
- **`makeQueryClient`** — `frontend/src/lib/query-client.ts`. Smart retry (skip 4xx, retry 5xx + network, exponential backoff), 30s staleTime, 5min gcTime, refetchOnWindowFocus.
- **`fetchMeWithRetry`** — `frontend/src/components/providers/auth-provider.tsx`. Retry-with-401-bailout pattern; generalize into a utility if we need it elsewhere.
- **`staticStudioUrl`** — `frontend/src/lib/api/studio.ts`. URL resolver for static uploads; works in dev + prod. Copy this pattern for any new static-asset client code.

Backend:
- **`require_artifact_access`** — `backend/app/core/rbac.py`. Exactly the helper missing from `export_service`. Reuse.
- **`mark_orphans_failed`** — `backend/app/services/studio_generation_service.py` (and `video_generation_service.py`). Copy pattern for ExportLog + PosterReferenceImage sweeps.
- **`with_for_update()`** — already used for artifact-row locking in poster + studio services. Use the same pattern for the turn-count race fix (2.5).

---

## Verification (by tier)

**Tier 0**:
- Run `make backend-demo` (new target) → hit `/api/health` while saving a `.py` file → backend should NOT restart (curl succeeds without ECONNRESET).
- `backend/.env.example` → `diff <(grep -Eo '[A-Z_]+ *=' backend/.env.example | sort -u) <(grep -Eo '[A-Z_]+ *=' backend/.env | sort -u)` should match.

**Tier 1**:
- `cd frontend && npx tsc --noEmit` clean after every migration.
- Manual: stop backend mid-fetch on each migrated surface → expect `ErrorBanner` to appear, cached data to remain visible, retry button to work when backend comes back.
- Multi-tab: log in on tab A → open tab B → tab B should see the same session (after token-storage fix).
- Error boundary: deliberately throw in a component → app shows fallback, doesn't blank-screen.

**Tier 2**:
- Silent-catch fixes: trigger the failure path (stop Redis, break gamification mid-run) and verify backend logs show a warning with a stack trace instead of being silent.
- Export ownership: log in as user A, `POST /api/artifacts/{id}/export` where `id` belongs to user B → expect 403.
- Orphan sweeps: manually insert a stale PosterReferenceImage older than 24h → restart backend → row is purged.
- Rate limits: hit `/api/ai/generate-image` 20 times in 60s → expect 429 after the 10th.
- Refresh-token rotation: call `POST /auth/refresh`; old refresh token should no longer work after it.
- 401 interceptor (frontend): manually expire access token → next API call should auto-refresh and succeed; only on a second failure should the user be routed to `/login`.

**Tier 3**:
- `pytest backend/tests/ -v` — ≥ 10 tests pass; they hit real DB via `conftest.py` fixture; Gemini is mocked.
- CI: open a PR → `ci.yml` runs lint + typecheck + tests + build; red on deliberate regression, green on main.
- Sentry: throw a test error on staging → event lands in Sentry dashboard with stacktrace + user context.

---

## Sequencing recommendation

1. **Today / pre-next-demo**: Tier 0 (≤ 1 hr).
2. **This week**: Tier 1 in one clean-tree session (~3 hrs). This closes every remaining "data disappeared" hole.
3. **Next sprint**: Tier 2 as a tracked workstream (~1 day total, parallelisable across frontend interceptor + backend silent-catches + rate limits).
4. **Background**: Tier 3 as tech-debt work. Sentry + CI pay for themselves fast.

Everything in Tier 0–1 is low-risk and additive; nothing here requires a migration or schema change. Tier 2 has one schema-adjacent item (token rotation on refresh tokens if we store them) but it's additive too.

After the full plan lands, the reliability posture moves from "brittle, depends on not saving files" to "retries every transient failure, surfaces real errors, survives backend restarts and Redis outages."
