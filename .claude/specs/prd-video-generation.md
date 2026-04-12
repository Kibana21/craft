# PRD: AI Video Generation Pipeline

**Version:** 1.0
**Date:** April 2026
**Status:** Draft
**Source spec:** `.claude/specs/FUNCTIONAL_REQUIREMENTS_VIDEO_GENERATION.md`
**Replaces:** Existing static reel creator (`frontend/src/components/reel-creator.tsx`)

---

## 1. Introduction

CRAFT currently produces static artifacts (posters, WhatsApp cards) and a static "reel" storyboard that does not render an actual video. This PRD defines the end-to-end AI video generation pipeline that replaces the static reel creator with a four-stage wizard: **Presenter → Script → Storyboard → Video Generation**.

The pipeline produces a single cohesive MP4 by generating scenes sequentially via Google Veo 3.1 (`veo-3.1-generate-001`), chaining each scene as an extension of the previous one to preserve visual continuity. The same presenter appearance is embedded into every scene's prompt to guarantee the same person appears throughout the video.

This feature sits inside the existing project → artifact pipeline. A video is an `Artifact` of type `VIDEO` (or `REEL`); its pipeline state (presenter, script, scenes, generated videos) lives in dedicated models linked to the artifact.

## 2. Goals

- Replace the static reel creator with a working AI video generation flow for artifact types `VIDEO` and `REEL`
- Guarantee presenter visual consistency across every scene in a generated video
- Support script drafting, tone rewriting, and version history with AI assist at every step
- Generate multi-scene videos up to 5 minutes long using Google Veo 3.1 scene-extension chaining
- Maintain compatibility with existing CRAFT systems: compliance scoring, comments, exports, gamification, and project-level access control
- Allow users to manage multiple generated video versions per project, compare them, and delete selectively
- Provide real-time progress feedback (percent + current scene) while videos render

## 3. Architecture Overview

### 3.1 Data model (hybrid: Artifact shell + dedicated pipeline models)

```
Artifact (type=VIDEO or REEL) ← existing model, extended
    │ 1:1
    ▼
VideoSession  ← new; holds pipeline state for one artifact
    │
    ├─ presenter_id → Presenter (library item; nullable)
    ├─ current_script_id → VideoScript (nullable until first draft)
    ├─ scenes: Scene[] (ordered by sequence)
    ├─ script_versions: ScriptVersion[] (history)
    └─ generated_videos: GeneratedVideo[] (Version 1, 2, 3, …)
```

**New models:**

| Model | Purpose | Key fields |
|-------|---------|-----------|
| `Presenter` | Reusable library entity for on-screen person | id, name, age_range, appearance_keywords, full_appearance_description, speaking_style, is_library, created_by_id |
| `VideoSession` | 1:1 pipeline state for one VIDEO artifact | id, artifact_id (unique FK), presenter_id (FK), target_duration_seconds, current_script_id (FK), scenes_script_version_id (FK; used for staleness detection), current_step |
| `VideoScript` | The current script text for a session | id, video_session_id (FK), content (TEXT), word_count, estimated_duration_seconds, updated_at |
| `ScriptVersion` | Immutable history record of a prior script | id, video_session_id (FK), content (TEXT), action (enum), created_at |
| `Scene` | One scene card with merged prompt | id, video_session_id (FK), sequence (int), name, dialogue (TEXT), setting, camera_framing (enum), merged_prompt (TEXT), script_version_id (FK) |
| `GeneratedVideo` | A rendered video version | id, video_session_id (FK), version (int), status (enum), progress_percent, current_scene, file_url, error_message, created_at, completed_at |

**New enums:**
- `SpeakingStyle`: AUTHORITATIVE, CONVERSATIONAL, ENTHUSIASTIC, EMPATHETIC
- `CameraFraming`: WIDE_SHOT, MEDIUM_SHOT, CLOSE_UP, OVER_THE_SHOULDER, TWO_SHOT, AERIAL, POV
- `VideoStatus`: QUEUED, RENDERING, READY, FAILED
- `ScriptAction`: DRAFT, WARM, PROFESSIONAL, SHORTER, STRONGER_CTA, MANUAL
- `TargetDuration`: SECONDS_30, SECONDS_60, SECONDS_90, MINUTES_2, MINUTES_3, MINUTES_5
- `VideoSessionStep`: PRESENTER, SCRIPT, STORYBOARD, GENERATION

### 3.2 Integration with existing CRAFT systems

| System | Integration point |
|--------|-------------------|
| Project membership / RBAC | Scoped via `artifact.project_id` — reuse existing permission checks |
| Compliance scoring | Run `ComplianceCheck` against the generated video's script on completion (text-based scoring, same as other artifacts) |
| Comments | Attach to `Artifact.id` as today |
| Exports | The existing `/api/artifacts/{id}/export` works for the final MP4; no new export flow needed |
| Gamification | Award points when a `GeneratedVideo` reaches `READY` (new trigger alongside existing artifact-status triggers) |
| Notifications | Fire on generation `READY` / `FAILED` |

### 3.3 Replaced components

The existing `frontend/src/components/reel-creator.tsx` is replaced in full. New wizard pages live under:

```
/projects/[id]/artifacts/[artifactId]/video/
    ├─ page.tsx               # wizard shell with step indicator
    ├─ presenter/page.tsx
    ├─ script/page.tsx
    ├─ storyboard/page.tsx
    └─ videos/page.tsx
```

The artifact type selector (`/projects/artifacts/new`) routes `VIDEO` and `REEL` types to this new wizard instead of the old static reel creator.

---

## 4. User Stories

User stories are grouped into seven implementation phases. Each phase can be implemented in order; phases 2–4 can run partially in parallel once phase 1 is complete. **UI stories must also include "Verify in browser using dev-browser skill" as acceptance criteria.**

### Phase 1 — Data model & infrastructure

#### US-001: Add new enums to the backend
**Description:** As a developer, I need the enums required by the video pipeline so models can reference them.

**Acceptance Criteria:**
- [ ] Add `SpeakingStyle`, `CameraFraming`, `VideoStatus`, `ScriptAction`, `TargetDuration`, `VideoSessionStep` enums in `backend/app/models/enums.py` (or the existing enum location)
- [ ] All enum values match §11 of the source functional spec
- [ ] `mypy app/` passes

#### US-002: Create Presenter model and migration
**Description:** As a developer, I need a `presenters` table to store reusable presenter definitions for the library.

**Acceptance Criteria:**
- [ ] `Presenter` model with fields: id (UUID), name, age_range, appearance_keywords, full_appearance_description (TEXT), speaking_style (enum), is_library (bool, default true), created_by_id (FK → users.id), created_at, updated_at, deleted_at
- [ ] Alembic migration generated and runs cleanly (`make migrate`)
- [ ] Index on `created_by_id`
- [ ] `mypy app/` passes

#### US-003: Create video pipeline models and migration
**Description:** As a developer, I need `video_sessions`, `video_scripts`, `script_versions`, `scenes`, and `generated_videos` tables so the pipeline can persist state.

**Acceptance Criteria:**
- [ ] Create all five models as specified in §3.1 above
- [ ] `video_sessions.artifact_id` is a unique FK to `artifacts.id` (1:1)
- [ ] `scenes.sequence` is an integer with a composite unique constraint on `(video_session_id, sequence)`
- [ ] `generated_videos.version` has a composite unique constraint on `(video_session_id, version)`
- [ ] All FK columns have explicit indexes
- [ ] Alembic migration generated and runs cleanly
- [ ] `mypy app/` passes

#### US-004: Auto-create VideoSession on VIDEO/REEL artifact creation
**Description:** As a developer, I want a `VideoSession` row created automatically whenever an artifact of type `VIDEO` or `REEL` is created, so the wizard has state to attach to.

**Acceptance Criteria:**
- [ ] In `artifact_service.py` artifact creation, if `type in (VIDEO, REEL)`, create a companion `VideoSession` row with `current_step = PRESENTER`
- [ ] `target_duration_seconds` defaults to 60 seconds but can be overridden by the artifact creation payload
- [ ] Rollback on failure — artifact creation must be atomic with session creation
- [ ] Backend test covers both success and rollback paths

### Phase 2 — Presenter management

#### US-005: Presenter library CRUD API
**Description:** As a BRAND_ADMIN or FSC, I want to create, list, update, and delete saved presenters.

**Acceptance Criteria:**
- [ ] `GET /api/presenters` — list presenters visible to the user (own + shared library)
- [ ] `POST /api/presenters` — create a presenter
- [ ] `GET /api/presenters/{id}` — fetch one
- [ ] `PATCH /api/presenters/{id}` — update own presenters only (enforce via RBAC)
- [ ] `DELETE /api/presenters/{id}` — soft-delete own presenters only
- [ ] Request/response Pydantic schemas in `app/schemas/presenter.py`
- [ ] All endpoints require authentication

#### US-006: AI-generate presenter appearance description
**Description:** As a user, I want the AI to write a full appearance paragraph from my keywords so I don't have to write it manually.

**Acceptance Criteria:**
- [ ] `POST /api/presenters/generate-appearance` accepts `{appearance_keywords, speaking_style}` and returns `{full_appearance_description}`
- [ ] Uses Gemini via `ai_service.py` with a dedicated prompt template in `prompt_builder.py`
- [ ] Returns a 2–4 sentence prose paragraph covering physical appearance, clothing, setting, and manner
- [ ] The triggering button on the frontend is disabled while the call is in progress (see US-008)

#### US-007: Presenter form and library picker UI
**Description:** As a user, I want to fill presenter fields or pick from my library so I can assign a presenter to this video.

**Acceptance Criteria:**
- [ ] `/projects/[id]/artifacts/[artifactId]/video/presenter` page renders presenter form and a "Pick from library" button
- [ ] Form fields: Name, Age Range (dropdown), Appearance Keywords, Full Appearance Description (textarea), Speaking Style (dropdown)
- [ ] "Generate from keywords" button calls the AI endpoint and fills the description textarea
- [ ] Library picker modal lists existing presenters and pre-fills the form on selection
- [ ] Changes to a selected library presenter do not mutate the saved library entry unless the user clicks "Save to library"
- [ ] `npm run typecheck` passes
- [ ] Verify in browser using dev-browser skill

#### US-008: Assign presenter to video session
**Description:** As a user, I want to save the presenter I've configured so the pipeline can use it.

**Acceptance Criteria:**
- [ ] `PATCH /api/video-sessions/{id}/presenter` accepts either `{presenter_id}` (reuse library) or full presenter fields (create new + assign)
- [ ] When full fields are submitted, creates a new `Presenter` row with `is_library = false` (session-only) unless the user also ticked "Save to library"
- [ ] Updates `video_session.presenter_id` and `video_session.current_step = SCRIPT`
- [ ] "Continue" button on presenter page calls this endpoint and navigates to `/script`
- [ ] Verify in browser using dev-browser skill

### Phase 3 — Script creation

#### US-009: Script CRUD + live word count
**Description:** As a user, I want to write and save a script with real-time word count and duration estimate.

**Acceptance Criteria:**
- [ ] `PATCH /api/video-sessions/{id}/script` accepts `{content}`, computes word_count and estimated_duration_seconds (at 150 wpm), updates the `video_scripts` row (creates if none exists)
- [ ] `GET /api/video-sessions/{id}/script` returns current script
- [ ] Frontend `/script` page shows large textarea, live word count, and estimated duration vs target
- [ ] Debounced auto-save (2 seconds after last keystroke)
- [ ] Verify in browser using dev-browser skill

#### US-010: AI-draft script from project brief
**Description:** As a user, I want to generate a complete script from the project brief so I don't start from a blank page.

**Acceptance Criteria:**
- [ ] `POST /api/video-sessions/{id}/script/draft` uses project brief + brand kit + target duration to generate a script via Gemini
- [ ] Response replaces current script and creates a `ScriptVersion` with `action = DRAFT` recording the previous content (if any)
- [ ] "Auto-draft from brief" button on the script page triggers this; disabled during the call
- [ ] On error, script field content is preserved unchanged
- [ ] Verify in browser using dev-browser skill

#### US-011: Tone rewrite (4 variants)
**Description:** As a user, I want to rewrite my script in a different tone without losing the prior version.

**Acceptance Criteria:**
- [ ] `POST /api/video-sessions/{id}/script/rewrite` accepts `{tone}` where tone ∈ {WARM, PROFESSIONAL, SHORTER, STRONGER_CTA}
- [ ] Saves prior content as a `ScriptVersion` with the matching action, then replaces the script content with the rewritten version
- [ ] Four tone chip buttons on the script page trigger this; each disabled during its own call
- [ ] Verify in browser using dev-browser skill

#### US-012: Script version history API + UI
**Description:** As a user, I want to see prior script versions and restore one if a rewrite went wrong.

**Acceptance Criteria:**
- [ ] `GET /api/video-sessions/{id}/script-versions` returns versions newest-first with `{id, action, created_at, preview (first 150 chars)}`
- [ ] `POST /api/video-sessions/{id}/script-versions/{version_id}/restore` saves the current script as a new version and replaces current content with the restored version's text
- [ ] Frontend version history drawer lists all versions with action label, timestamp, preview, and "Restore" button
- [ ] Verify in browser using dev-browser skill

#### US-013: Storyboard staleness detection
**Description:** As a user, I want to be warned when my scenes are out of date because I changed the script after generating them.

**Acceptance Criteria:**
- [ ] When scenes are generated, `video_sessions.scenes_script_version_id` is set to the current script version id
- [ ] Each script edit creates a new `ScriptVersion` so version ids advance
- [ ] The storyboard page compares `scenes_script_version_id` to the latest script version id; if they differ, render a warning banner with a "Regenerate scenes" CTA
- [ ] Verify in browser using dev-browser skill

### Phase 4 — Scene storyboarding

#### US-014: AI scene generation (split script into scenes)
**Description:** As a user, I want the AI to split my script into scenes automatically when I arrive at the storyboard step.

**Acceptance Criteria:**
- [ ] `POST /api/video-sessions/{id}/scenes/generate` runs only if no scenes currently exist; otherwise returns 409
- [ ] Uses Gemini with a prompt that receives the full script + target duration and returns structured scenes (scene name, dialogue slice, setting, camera framing)
- [ ] Scene count follows §10.8 heuristics (e.g. 30s → 1–2 scenes, 60s → 2–3, …, 5min → 8–12)
- [ ] Each scene's `merged_prompt` is computed (see US-017) and stored
- [ ] `video_sessions.scenes_script_version_id` is updated to the current version
- [ ] `video_sessions.current_step = STORYBOARD`
- [ ] On error, no partial scenes are written (transactional)

#### US-015: Regenerate all scenes
**Description:** As a user, I want to discard all current scenes and re-split the script.

**Acceptance Criteria:**
- [ ] `POST /api/video-sessions/{id}/scenes/regenerate` deletes all scenes for the session and re-runs generation
- [ ] Atomic — if generation fails, prior scenes are restored (or wrapped in a DB transaction)
- [ ] "Regenerate all scenes" button on the storyboard page shows a confirmation modal ("This will delete all current scenes") before calling the endpoint
- [ ] Verify in browser using dev-browser skill

#### US-016: Scene edit API
**Description:** As a user, I need to edit individual scene fields.

**Acceptance Criteria:**
- [ ] `PATCH /api/scenes/{id}` accepts any subset of `{name, dialogue, setting, camera_framing}`
- [ ] Does NOT rebuild the merged prompt (per §4.6 of source spec); the merged prompt is only rebuilt on scene generation/insertion, and re-derived on video-generation trigger
- [ ] Returns the updated scene

#### US-017: Merged prompt builder
**Description:** As a developer, I need a single function that builds the merged scene prompt from scene + presenter + brand kit so the logic is consistent across create/regenerate/insert paths.

**Acceptance Criteria:**
- [ ] Pure function `build_merged_prompt(scene, presenter, brand_kit) -> str` in `app/services/video_service.py` (or similar)
- [ ] Output matches the template in §5.2 of the source spec exactly (dialogue + Setting + Camera + Presenter full_appearance + Speaking style + Brand kit)
- [ ] Handles missing presenter gracefully (omits presenter section per §10.1)
- [ ] Unit test covering: all fields present, missing presenter, missing brand kit

#### US-018: Scene insertion API
**Description:** As a user, I want to insert a new scene before Scene 1 or between any two existing scenes.

**Acceptance Criteria:**
- [ ] `POST /api/video-sessions/{id}/scenes` accepts `{position, name, dialogue, setting, camera_framing}`
- [ ] All scenes at sequence ≥ position are renumbered (sequence += 1) atomically
- [ ] `merged_prompt` is built for the new scene at creation time
- [ ] Response returns all scenes in the new order

#### US-019: Scene deletion API
**Description:** As a user, I want to delete a scene, with remaining scenes renumbered contiguously.

**Acceptance Criteria:**
- [ ] `DELETE /api/scenes/{id}` removes the scene and shifts subsequent sequences down by 1
- [ ] Operation is atomic (single transaction)

#### US-020: Storyboard page + scene cards UI
**Description:** As a user, I want to see, edit, insert, and delete scenes in a vertically ordered list.

**Acceptance Criteria:**
- [ ] `/storyboard` page fetches scenes ordered by sequence and renders each as a card
- [ ] Card shows: scene number (fixed), scene name (text), dialogue (italic, left-border), setting (text), camera framing (dropdown), "Presenter Locked" tag, "Brand Locked" tag, Save button, Delete button
- [ ] Save button shows "Saved ✓" briefly on success
- [ ] Insert button appears between adjacent cards and above Scene 1; opens an insert modal
- [ ] Delete button uses single-click delete per §4.8 of source spec (no separate confirmation on scene cards — contrast with video deletion)
- [ ] "Regenerate all scenes" button at top of page
- [ ] Staleness warning banner (US-013) renders above the list when applicable
- [ ] `npm run typecheck` passes
- [ ] Verify in browser using dev-browser skill

### Phase 5 — Video generation (Veo 3.1)

#### US-021: Google Veo 3.1 API client
**Description:** As a developer, I need a typed Python client for the Veo `veo-3.1-generate-001` endpoint used for initial scene generation and scene-extension chaining.

**Acceptance Criteria:**
- [ ] New module `app/services/veo_client.py`
- [ ] `generate_scene(prompt: str) -> bytes` for Scene 1
- [ ] `extend_scene(prompt: str, previous_clip: bytes) -> bytes` for Scenes 2..N
- [ ] 15-minute timeout per call per §10.7 of source spec; raises `VeoTimeoutError`
- [ ] Catches policy-violation, quota-exceeded, malformed-response errors and raises typed exceptions
- [ ] API key loaded from env (`GOOGLE_VEO_API_KEY` or equivalent via `core/config.py`)
- [ ] Unit test with mocked Veo API

#### US-022: Video generation background worker
**Description:** As a developer, I need a background task that generates a video scene-by-scene and updates status as it progresses.

**Acceptance Criteria:**
- [ ] `generate_video_task(generated_video_id)` runs via FastAPI `BackgroundTasks`
- [ ] On start: set status = RENDERING
- [ ] For Scene 1: call `veo_client.generate_scene(scene.merged_prompt)`
- [ ] For Scenes 2..N: call `veo_client.extend_scene(scene.merged_prompt, previous_clip)`
- [ ] After each scene: update `progress_percent` (= completed/total * 100), `current_scene`
- [ ] On completion: upload final MP4 to S3 / local storage, set `file_url`, status = READY, fire gamification + notification hooks
- [ ] On failure: status = FAILED, `error_message` populated from the Veo exception, fire notification
- [ ] Cleans up intermediate scene clips after final clip is saved

#### US-023: Trigger video generation API
**Description:** As a user, I want to start a video generation job from the storyboard step.

**Acceptance Criteria:**
- [ ] `POST /api/video-sessions/{id}/generate` creates a `GeneratedVideo` row at `status = QUEUED`, `version = max(existing) + 1`, dispatches the background task
- [ ] Returns 409 with message "A video is already being generated for this project" if another `GeneratedVideo` for the same project is in QUEUED or RENDERING
- [ ] Returns 400 if zero scenes exist or any scene has empty dialogue (per §10.3)
- [ ] Merged prompts are rebuilt at trigger time from the latest scene fields (per §4.6 of source spec)

#### US-024: Poll generated video status API
**Description:** As a frontend, I need to poll for progress updates during generation.

**Acceptance Criteria:**
- [ ] `GET /api/video-sessions/{id}/videos` returns all `GeneratedVideo` rows newest-first with status, progress_percent, current_scene, version, file_url, error_message, created_at
- [ ] Stable response shape across all statuses

#### US-025: Videos page with card states
**Description:** As a user, I want to see all generated video versions for this session with their current status.

**Acceptance Criteria:**
- [ ] `/videos` page lists all `GeneratedVideo` rows for the session, newest-first
- [ ] Card state rendering matches §8.2 of the source spec:
  - Queued: hourglass icon + "Queued…" label, no progress bar
  - Rendering: progress bar + percent + "Scene N rendering"
  - Ready: play button thumbnail + version title + Ready badge + Download + Delete
  - Failed: red ✕ + "Failed" + error message + Delete
- [ ] Polls `GET /api/video-sessions/{id}/videos` every 5 seconds **only while** any video is QUEUED or RENDERING; polling stops when all reach terminal state
- [ ] "Generate Video" button visible when at least one scene exists; disabled with inline message while a generation is in progress
- [ ] `npm run typecheck` passes
- [ ] Verify in browser using dev-browser skill

### Phase 6 — Playback & video management

#### US-026: Video streaming endpoint
**Description:** As a developer, I need a streaming endpoint so players can seek without waiting for full download.

**Acceptance Criteria:**
- [ ] `GET /api/generated-videos/{id}/stream` serves the MP4 with HTTP Range support
- [ ] Same URL used for in-browser playback and download (per §7.3)
- [ ] Returns 404 if status != READY
- [ ] Returns 403 if the caller is not a member of the video's project

#### US-027: Full-screen video player overlay
**Description:** As a user, I want to watch a generated video in a full-screen player.

**Acceptance Criteria:**
- [ ] Clicking a Ready video thumbnail opens a full-screen overlay
- [ ] Player auto-plays
- [ ] Controls: play/pause, seek bar, volume, fullscreen toggle
- [ ] Header shows the video title ("Version N")
- [ ] Close (×) in corner; clicking outside the player also closes
- [ ] Download button in the footer (same URL as player source)
- [ ] Verify in browser using dev-browser skill

#### US-028: Download video as MP4
**Description:** As a user, I want to download any Ready video as an MP4.

**Acceptance Criteria:**
- [ ] Download button on the video card AND inside the player footer
- [ ] Downloaded file is named `Version N.mp4`
- [ ] Streams from the same endpoint as playback (US-026)
- [ ] Verify in browser using dev-browser skill

#### US-029: Delete video with two-click confirmation
**Description:** As a user, I want to delete any video with a safety confirm step.

**Acceptance Criteria:**
- [ ] `DELETE /api/generated-videos/{id}` removes the record; if status was READY, deletes the MP4 file from storage; if QUEUED or RENDERING, cancels the job (set a cancellation flag the worker checks between scenes)
- [ ] Delete button UI: first click turns button red + text becomes "Confirm delete?" + "Cancel" link appears; second click triggers deletion; "Cancel" resets
- [ ] Deletion is irreversible
- [ ] Verify in browser using dev-browser skill

### Phase 7 — Integration & polish

#### US-030: Route VIDEO/REEL artifact creation to the new wizard
**Description:** As a user, when I create an artifact of type VIDEO or REEL, I should land in the new 4-step wizard instead of the old static reel creator.

**Acceptance Criteria:**
- [ ] `/projects/artifacts/new` routes VIDEO and REEL selections to `/projects/[id]/artifacts/[artifactId]/video/presenter`
- [ ] Delete `frontend/src/components/reel-creator.tsx` and any routes/imports that reference it
- [ ] Components that the new wizard reuses (tone-selector, format-selector) are retained; others are removed
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Verify in browser using dev-browser skill

#### US-031: Wizard shell with step indicator
**Description:** As a user, I want to see which step I'm on and move between steps.

**Acceptance Criteria:**
- [ ] Shared layout at `/projects/[id]/artifacts/[artifactId]/video/layout.tsx` renders a 4-step indicator (Presenter → Script → Storyboard → Videos)
- [ ] Current step is highlighted based on `video_session.current_step`
- [ ] Steps ahead of `current_step` are disabled (users must complete the previous step to unlock)
- [ ] Completed steps are clickable to revisit
- [ ] Verify in browser using dev-browser skill

#### US-032: Compliance scoring on generated video
**Description:** As a BRAND_ADMIN, I want generated videos to be compliance-scored automatically when they finish so the review queue works.

**Acceptance Criteria:**
- [ ] When a `GeneratedVideo` reaches READY, the background worker triggers a `ComplianceCheck` against the final script content (per existing pattern in `compliance_scorer.py`)
- [ ] The check attaches to the parent `Artifact.id` (not `GeneratedVideo.id`) so existing compliance UI surfaces it
- [ ] Updates `artifact.compliance_score`

#### US-033: Gamification hook on video completion
**Description:** As a user, I want to earn points when a video I generate reaches READY.

**Acceptance Criteria:**
- [ ] On `GeneratedVideo` → READY, call `gamification_service.award_points(user, reason="VIDEO_GENERATED", amount=…)`
- [ ] Point amount follows the existing gamification table (see `gamification_service.py`); if no row exists, add one with a reasonable default
- [ ] Points are awarded once per artifact (not per version) — repeat generations of the same artifact do not double-count

#### US-034: Notifications on READY and FAILED
**Description:** As a user, I want an in-app notification when my video finishes or fails, so I don't have to keep the tab open.

**Acceptance Criteria:**
- [ ] On READY: create a `Notification` with type=`VIDEO_READY`, related_id=artifact_id, for all project members
- [ ] On FAILED: create a `Notification` with type=`VIDEO_FAILED`, related_id=artifact_id, for the user who triggered generation

---

## 5. Functional Requirements (summary)

- **FR-1:** Videos are represented as `Artifact` of type VIDEO or REEL, with a 1:1 companion `VideoSession` row holding pipeline state.
- **FR-2:** A presenter's `full_appearance_description` is embedded verbatim into every scene's `merged_prompt` at scene generation time.
- **FR-3:** The merged prompt is a fixed template: dialogue + setting + camera + presenter full_appearance + speaking style + brand kit.
- **FR-4:** Scene generation uses Gemini; video generation uses Google Veo 3.1 (`veo-3.1-generate-001`).
- **FR-5:** Scene 1 is generated independently; Scenes 2..N extend the previous scene's video output (scene-extension chaining).
- **FR-6:** Scene count is proportional to target duration per the §10.8 heuristics.
- **FR-7:** Only one video generation job may be QUEUED or RENDERING per project at any time; a second trigger returns 409.
- **FR-8:** Per-scene timeout is 15 minutes; exceeding it fails the entire job.
- **FR-9:** Frontend polls `/api/video-sessions/{id}/videos` every 5 seconds while any video is non-terminal; stops when all are READY or FAILED.
- **FR-10:** Multiple generated video versions per session are retained; user can delete individually. No auto-deletion.
- **FR-11:** Every AI action (draft or tone rewrite) saves the prior script as a `ScriptVersion`; restore is available.
- **FR-12:** Scenes store the script version they were generated from; a newer script triggers a staleness warning with a regenerate CTA.
- **FR-13:** Editing scene fields does not rebuild the merged prompt; the prompt is rebuilt on video-generation trigger from the latest field values.
- **FR-14:** Presenters saved to the library are reusable across projects. Using a library presenter in a session does not mutate the library entry unless the user explicitly saves back.
- **FR-15:** Updating a presenter's appearance does NOT retroactively update existing scenes' merged prompts. Scenes must be regenerated.
- **FR-16:** Scene insertion renumbers subsequent scenes atomically; deletion renumbers remaining scenes contiguously.
- **FR-17:** The existing reel creator (`reel-creator.tsx`) is fully replaced by the new wizard for VIDEO/REEL types.
- **FR-18:** Generated videos feed into existing CRAFT systems: compliance scoring (on final script), comments (on Artifact), exports (existing endpoint), gamification (on READY), notifications (on READY/FAILED).

---

## 6. Non-Goals (Out of Scope)

- **Project management, auth, dashboard, and artifact-export history** — already handled by existing CRAFT systems. This PRD only describes integration points.
- **Per-scene presenter override** — intentionally disallowed (see FR-2, §2.7 of source spec). All scenes share one presenter.
- **Live video editing after generation** — no trimming, cropping, or splicing of the final MP4. Only regenerate-from-scratch.
- **Promoting a version to "final"** — all versions are equal; no version promotion concept (per §8.4 of source spec).
- **Retrying failed videos in place** — a new Version N is created instead (per §6.8).
- **Webhooks / external notifications** — only in-app notifications. No email or Slack.
- **Video thumbnails generated server-side** — the first frame of the MP4 serves as the thumbnail via the HTML5 video element.
- **Custom voice selection or voice cloning** — the Veo model handles audio output with its default voice for the chosen speaking style; no TTS voice picker.
- **Subtitles, captions, or transcription output** — out of scope for v1.
- **Multi-presenter scenes** — only one presenter per video. Two-Shot camera framing is a visual choice only; the AI renders one presenter in such shots.
- **Importing external video clips** — the pipeline is fully AI-generated. No upload-your-own-clip integration.

---

## 7. Design Considerations

- **Wizard UX:** Mirror the existing project creation wizard's step indicator pattern (`frontend/src/components/project-wizard-steps/`). Consistent look = lower learning curve.
- **Scene cards:** Follow the spacious, Airbnb-inspired card pattern already established in the codebase (per CLAUDE.md preferences). Dialogue in italic with a left accent border (per §4.4 of source spec).
- **Tags on scene cards:** "Presenter Locked" and "Brand Locked" are small chip-style badges; non-interactive.
- **Tone chips on script page:** four pill-shaped buttons (matching the NotebookLM-style pill tabs already in the dashboard per user feedback memory).
- **Staleness warning:** Amber banner above the scene list — not a blocker; user can still view stale scenes and edit them, but is nudged to regenerate.
- **Player overlay:** Match the dark, full-screen feel typical of media players. MUI `Dialog` with `fullScreen` prop is sufficient.
- **Delete confirmations:**
  - Scenes: single-click delete (per §4.8 of source spec — scenes are cheap to re-add)
  - Videos: two-click "Confirm delete?" (per §8.3 — files are expensive and irreversible)
- **Component reuse:** Keep `tone-selector.tsx` and `format-selector.tsx` from the old reel creator — both map cleanly to the new wizard. Delete everything else tied to the static storyboard.
- **AIA brand:** Presenter appearance defaults should respect AIA's target audience (mix of Asian demographics), but this is a descriptive-prompt concern, not a UI one.

---

## 8. Technical Considerations

### 8.1 External dependencies (must be confirmed before build)
- **Google Veo 3.1 API access** (`veo-3.1-generate-001`) — requires Google Cloud account provisioning, API key, and confirmed per-scene quota/billing. This is a hard blocker for Phase 5.
- **Storage bucket sizing** — MP4s from a 5-minute 8–12 scene video are substantial. Confirm S3/R2 bucket quotas and CDN strategy before Phase 5.

### 8.2 Performance
- Scene-extension chaining is inherently sequential — a 12-scene video cannot parallelize. Plan UX around a realistic 10–30 minute wait for long videos.
- The 5-second polling interval is a conservative default; consider server-sent events or WebSocket streaming in a later iteration if polling load becomes a concern.

### 8.3 Data integrity
- Wrap scene generation and regeneration in DB transactions — partial scene sets are worse than no scenes.
- Scene sequence renumbering (insert, delete) must use a single `UPDATE ... WHERE sequence >= N` with a deferred unique constraint, or use a negative-temporary-value two-pass strategy to avoid unique-constraint collisions.
- Cancellation flag for in-flight video generation: worker checks `generated_video.status` between scenes; if set to something other than RENDERING, abort gracefully.

### 8.4 Background jobs
- FastAPI `BackgroundTasks` is sufficient for v1 but has no crash recovery. If the server restarts mid-generation, a QUEUED/RENDERING row will be orphaned. Consider a startup sweep that marks orphaned jobs as FAILED with `error_message = "Server restart during generation"`.
- For production scale-up, migrate to Celery + Redis queue (Redis already deployed for leaderboard).

### 8.5 Security
- `POST /api/video-sessions/{id}/generate` must verify the caller has write access to the parent artifact's project.
- Presenter records are scoped per creator; `is_library = true` presenters are visible to all authenticated users (intentional — the library is shared).
- Streaming endpoint must enforce project membership before serving MP4 bytes.

### 8.6 Existing patterns to follow
- Async SQLAlchemy with `selectinload()` on FK relations (`scenes`, `script_versions`, `generated_videos`)
- Explicit FK indexes on all new tables
- UUIDs generated server-side (`uuid4()`)
- Soft-deletes where applicable (`deleted_at`)
- Pydantic schemas in `app/schemas/`

---

## 9. Success Metrics

- A 60-second single-presenter video generates successfully and is viewable within 15 minutes of triggering.
- Presenter visual consistency: a human reviewer cannot identify a scene cut based on presenter appearance drift in 9/10 generated videos.
- Script draft → completed video in under 10 user-facing clicks (presenter pick → script draft → continue → generate → play).
- Polling returns status updates within 1 second of a scene completing.
- Zero orphaned QUEUED/RENDERING rows after a server restart (startup sweep catches them).
- All generated videos ≥ 70% compliance score by default (compliance checks integrate cleanly with the existing rules engine).

---

## 10. Open Questions

- **Veo API regional availability:** Is `veo-3.1-generate-001` available in the Singapore region or must requests be routed elsewhere? Latency implications for a Singapore-based user base.
- **Veo billing model:** Per-scene? Per-second of output? Needed to inform cost-per-video and quotas.
- **Concurrent jobs across projects:** The one-job-per-project limit is explicit. Do we also need a global concurrency limit to control cost/quota? Suggest a system setting in `core/config.py`.
- **Preview frames during rendering:** Should we show a low-res preview of completed scenes as they finish, or only reveal the final video? The source spec is silent; assumed "final only" for v1.
- **Brand kit format inside the merged prompt:** `{project.brand_kit}` is templated literally, but brand kit is a structured object (colors, fonts, logo URL). Need to define the stringification format. Suggest: `"Brand colors: {primary} and {secondary}; tone: {brand_kit.tone or 'professional'}"`.
- **Presenter deletion safety:** If a user deletes a library presenter that's referenced by an existing `VideoSession`, what happens? Proposed: soft-delete the library row but keep `VideoSession.presenter_id` reference valid (FK with `ON DELETE SET NULL` is an option, but we need the appearance text preserved — consider snapshotting the presenter description into the session at assignment time).
- **Rate limits on AI-assist buttons:** Should we throttle "Auto-draft from brief" / tone rewrites per user per hour? Not in source spec; defer to backend config.
- **Audio language:** The source spec doesn't specify. Default to English for Singapore market; open for Phase 2 multi-language support.

---

*This PRD translates the April 2026 functional requirements spec into CRAFT-specific user stories, data model choices, and integration points. Implementation should proceed phase-by-phase; Phase 5 (Veo integration) depends on external API provisioning being confirmed.*
