# Phase 5: Video Generation (Google Veo 3.1)

**Goal:** Google Veo 3.1 client, background worker that generates scenes sequentially via scene-extension chaining, trigger endpoint with one-active-job-per-project lock, polling API, and video card UI with four status states.

**User stories:** US-021 (Veo client), US-022 (Background worker), US-023 (Trigger API with project lock), US-024 (Poll API), US-025 (Videos page with card states)

**Dependencies:** Phase 4 (scenes must exist before video generation).

> **⚠ HARD EXTERNAL BLOCKER:** This phase requires Google Veo 3.1 API access. Before starting:
> - Confirm Veo API is enabled on the CRAFT Google Cloud project
> - `veo-3.1-generate-001` model is available in the deployment region
> - Per-scene quota and billing are approved by stakeholders
> - `GOOGLE_VEO_API_KEY` (or equivalent) is provisioned and rotated into secrets
>
> If any of these are pending, pause this phase and continue Phases 1–4 in parallel.

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/services/veo_client.py` | Typed wrapper around Veo 3.1. `generate_scene(prompt: str) -> bytes` (Scene 1, no prior clip). `extend_scene(prompt: str, previous_clip: bytes) -> bytes` (Scenes 2..N). Raises typed exceptions: `VeoTimeoutError`, `VeoPolicyError`, `VeoQuotaError`, `VeoMalformedResponseError`. 15-minute timeout per call. |
| `backend/app/core/config.py` (extend) | `GOOGLE_VEO_API_KEY`, `VEO_MODEL_ID = "veo-3.1-generate-001"`, `VEO_SCENE_TIMEOUT_SECONDS = 900`, `VIDEO_POLL_INTERVAL_SECONDS = 5` |
| `backend/app/services/video_generation_service.py` | `trigger(session_id, user_id) -> GeneratedVideo` — validates prerequisites, creates `GeneratedVideo` at QUEUED with `version = max(existing) + 1`, enforces 1-job-per-project lock, dispatches background task. `list_for_session(session_id)` — returns all generated videos newest-first. `cancel(generated_video_id)` — sets cancellation flag checked by worker between scenes. |
| `backend/app/services/video_generation_worker.py` | `generate_video_task(generated_video_id)` — the BackgroundTasks-dispatched worker. Fetches scenes ordered by sequence. Rebuilds merged prompts from latest scene fields (per PRD FR-13). Scene 1: `veo_client.generate_scene(merged_prompt)`. Scenes 2..N: `veo_client.extend_scene(merged_prompt, previous_clip)`. After each scene: update `progress_percent`, `current_scene`. On complete: upload final MP4 to storage, set `file_url`, status=READY. On any error: status=FAILED, `error_message` set. Checks cancellation flag between scenes. Cleans up intermediate clips. |
| `backend/app/services/upload_service.py` (reuse + extend) | Add `upload_video(clip_bytes, video_id) -> str` returning a public/signed URL. Reuses existing S3 client. |
| `backend/app/api/video_sessions.py` (extend) | `POST /api/video-sessions/{id}/generate` (trigger), `GET /api/video-sessions/{id}/videos` (list) |
| `backend/app/schemas/generated_video.py` | `GeneratedVideoResponse` (id, version, status, progress_percent, current_scene, file_url, error_message, created_at, completed_at). `GeneratedVideoListResponse` (videos: list, any_active: bool — convenience flag for frontend polling decision) |
| `backend/app/services/video_service.py` (reuse from Phase 4) | `build_merged_prompt()` called here at trigger-time to refresh each scene's prompt from latest field values |
| `backend/app/main.py` (extend) | Startup sweep: mark any QUEUED/RENDERING `GeneratedVideo` rows as FAILED with `error_message="Server restart during generation"`. Prevents orphans after server crashes. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/videos/page.tsx` | Videos step page: "Generate Video" button (disabled while any generation is active for this project), list of video cards newest-first, polling hook |
| `frontend/src/components/video/video-card.tsx` | Renders different content per status: Queued (hourglass + label), Rendering (progress bar + percent + "Scene N rendering"), Ready (play thumbnail + version title + Ready badge + Download + Delete), Failed (red ✕ + error message + Delete). Stubs the player open/download/delete handlers for Phase 6 to wire up. |
| `frontend/src/components/video/generation-status-banner.tsx` | Inline banner shown on the Videos page when another video is already generating for this project — disables the "Generate Video" button with the message from PRD US-023 |
| `frontend/src/hooks/useVideoPolling.ts` | Custom hook: polls `GET /api/video-sessions/{id}/videos` every 5s while `any_active === true`; stops when all videos terminal. Cleans up on unmount. |
| `frontend/src/lib/api/video-sessions.ts` (extend) | `triggerGeneration(sessionId)`, `listGeneratedVideos(sessionId)` |
| `frontend/src/lib/api/generated-videos.ts` | Stub file — populated in Phase 6 (stream, delete) |
| `frontend/src/types/generated-video.ts` | `GeneratedVideo`, `VideoStatus` types |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/video-sessions/{id}/generate` | Project member (write) | Triggers a new generation job; returns 409 if another video is active in the same project; 400 if zero scenes or any scene has empty dialogue |
| GET | `/api/video-sessions/{id}/videos` | Project member | List all generated videos newest-first, includes `any_active` flag |

## Scene-extension chaining (sequence diagram)

```
Worker starts  →  Fetch scenes ordered by sequence
                     │
                     ↓
         ┌──── Scene 1 ────┐
         │ veo.generate_scene(prompt_1) → clip_1
         │ upload progress 1/N
         └─────────────────┘
                     │
                     ↓
         ┌──── Scene 2 ────┐
         │ veo.extend_scene(prompt_2, clip_1) → clip_2
         │ upload progress 2/N
         └─────────────────┘
                     │
                     ↓
                    ...
                     │
                     ↓
         ┌──── Scene N ────┐
         │ veo.extend_scene(prompt_N, clip_{N-1}) → clip_N (FINAL)
         └─────────────────┘
                     │
                     ↓
         Upload clip_N to S3 → set file_url, status=READY, completed_at
         Clean up clip_1 … clip_{N-1} from temp storage
```

Scene 1 is the only independent generation. Every subsequent scene is an extension of the previous. This is the mechanism that preserves visual continuity (presenter appearance, lighting, style) — losing it would mean the final video looks like disconnected clips.

## Video status state machine

```
               POST /generate
                     │
                     ↓
               ┌──────────┐
               │  QUEUED  │ ← row inserted; BackgroundTasks dispatched
               └────┬─────┘
                    │ worker picks up
                    ↓
              ┌────────────┐
              │ RENDERING  │ ← progress_percent and current_scene update after each scene
              └─┬────────┬─┘
                │        │
        success │        │ error / cancel / timeout
                ↓        ↓
          ┌────────┐ ┌────────┐
          │ READY  │ │ FAILED │
          └────────┘ └────────┘
```

## Key implementation details

- **One-active-job-per-project lock:** At trigger time, query `GeneratedVideo JOIN VideoSession JOIN Artifact` filtering by `artifact.project_id == current_project_id AND status IN (QUEUED, RENDERING)`. If any row exists, return 409 with the exact message: `"A video is already being generated for this project."` Use a `SELECT ... FOR UPDATE` or unique partial index in PostgreSQL to prevent race conditions under concurrent triggers.
- **Version numbering:** `version = (max existing version for this session) + 1`. Use `SELECT COALESCE(MAX(version), 0)+1 ... FOR UPDATE` inside the same transaction as the insert, or rely on a partial unique index to retry on conflict.
- **Merged prompt refresh at trigger time:** Before dispatching the worker, iterate all scenes and call `video_service.build_merged_prompt(scene, presenter, brand_kit)` — this writes the latest-field-value-based prompt into `scene.merged_prompt` so user edits since scene generation take effect. PRD FR-13.
- **Prerequisite validation:** At least one scene exists AND every scene has non-empty dialogue. 400 if not satisfied (per PRD §10.3).
- **Per-scene timeout:** `VEO_SCENE_TIMEOUT_SECONDS = 900` (15 minutes). If a single scene exceeds this, the entire job fails with `error_message` including which scene timed out.
- **Cancellation flag:** The worker checks `generated_video.status` between scenes. If a DELETE or explicit cancel has flipped status away from RENDERING, abort gracefully — don't fight the user, don't hit Veo again.
- **Intermediate clip storage:** Keep clips 1..N-1 in a temp location (local disk or S3 temp prefix). After the final upload succeeds, delete the intermediate clips. If the job fails mid-way, leave intermediates in the temp prefix and rely on a cleanup cron (documented but out of scope for this PRD).
- **Background worker realism:** FastAPI `BackgroundTasks` runs in-process — good enough for MVP but provides no crash recovery. The `main.py` startup sweep mitigates crashes by marking orphans as FAILED with `error_message="Server restart during generation"`. For production, migrate to Celery + Redis (Redis is already in the stack).
- **Failure message clarity:** Don't leak raw API error strings into `error_message`. Translate `VeoPolicyError`, `VeoQuotaError`, `VeoTimeoutError`, `VeoMalformedResponseError` into user-friendly text. Log the raw error for operators.
- **Upload size considerations:** A 5-minute 8-scene video can be hundreds of MB. Use streaming uploads (boto3 `upload_fileobj` with multipart config) rather than in-memory `put_object`.
- **File naming:** Final MP4 saved at `videos/{artifact_id}/v{version}.mp4` in S3. Consistent and predictable for debugging.
- **Polling on the frontend:** 5-second interval (matches source spec §6.9). Hook must stop polling when `any_active === false` and restart on next trigger. Don't poll while the tab is backgrounded — use `document.visibilityState` to pause.
- **"Generate Video" button state:** Disabled when `any_active === true`. Inline banner shows the PRD-mandated message. On 409 from the endpoint (race condition), also show the same message.

## Verification

- Mock `veo_client` in tests to return fake bytes; simulate 3-scene video → progress updates 33% → 66% → 100%
- Simulate Veo timeout on Scene 2 → status transitions to FAILED, `error_message` populated, intermediate Scene 1 clip is cleaned up (or left for cron — per decision above)
- Trigger generation while another is RENDERING for the same project → 409 with correct message
- Trigger generation with zero scenes → 400
- Trigger generation with a scene whose dialogue is empty → 400
- Simulate server restart: insert a QUEUED row directly into DB, restart app → startup sweep marks it FAILED
- DELETE on a RENDERING video (Phase 6 will wire the endpoint) sets the cancellation flag → worker aborts between scenes and does NOT hit Veo again
- Frontend: trigger → card appears in QUEUED → state transitions to RENDERING → progress updates every 5s → reaches READY
- Frontend: simulate failure → card shows red ✕ + error message
- `cd backend && pytest tests/test_video_generation.py tests/test_veo_client.py` — covers all branches
- `cd backend && mypy app/` passes
- `cd frontend && npm run typecheck` passes
- Verify in browser using dev-browser skill
