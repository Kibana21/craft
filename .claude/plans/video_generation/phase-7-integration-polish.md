# Phase 7: Integration & Polish

**Goal:** Route VIDEO/REEL artifact creation to the new wizard, delete the old static reel creator, build the wizard shell with step indicator, and wire video completion into compliance scoring, gamification, and notifications.

**User stories:** US-030 (Replace reel creator), US-031 (Wizard shell), US-032 (Compliance hook), US-033 (Gamification hook), US-034 (Notifications)

**Dependencies:** Phase 6 (full pipeline must be playable end-to-end before integrations are meaningful).

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/services/video_generation_worker.py` (extend Phase 5 file) | On status=READY: (1) fire compliance scoring for the final script against the parent Artifact; (2) fire gamification award_points if not already awarded for this artifact; (3) emit VIDEO_READY notification to all project members. On status=FAILED: emit VIDEO_FAILED notification to the triggering user only. |
| `backend/app/services/compliance_scorer.py` (reuse) | Existing scorer already handles text scoring. Call `score_artifact(artifact_id, content_text=script.content)` — it writes `ComplianceCheck` and updates `artifact.compliance_score`. |
| `backend/app/services/gamification_service.py` (extend) | Add `VIDEO_GENERATED` reason to the points table (points value TBD with product; proposed: 50 points — aligns with the existing tiers). `award_points_once(user, reason, related_artifact_id)` — idempotent: if a PointsLog row with `(user_id, reason, related_artifact_id)` exists, return without awarding again. Prevents double-counting across video versions. |
| `backend/app/services/notification_service.py` (create if not present; otherwise reuse) | `notify_video_ready(artifact_id)` — creates Notification rows for all project members. `notify_video_failed(artifact_id, user_id)` — creates one row for the triggering user. |
| `backend/app/models/notification.py` (reuse) | Existing model supports typed notifications. Add `VIDEO_READY` and `VIDEO_FAILED` to the notification type enum. |
| `backend/app/models/gamification.py` (reuse) | Existing `PointsLog` supports arbitrary `reason`; just ensure `related_id` is usable as artifact id. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/layout.tsx` | Shared wizard shell layout. Renders the step indicator (Presenter → Script → Storyboard → Videos). Fetches video session state; current step is highlighted based on `video_session.current_step`. Steps ahead of current are disabled; completed steps are clickable to revisit. |
| `frontend/src/components/video/wizard-step-indicator.tsx` | Four-pill step indicator matching the existing project creation wizard's pattern (`frontend/src/components/projects/wizard/wizard-progress.tsx`). Reuse styling classes where possible. |
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/new/page.tsx` (extend) | When user selects VIDEO or REEL artifact type, create the artifact immediately (hit `POST /api/projects/{id}/artifacts`) and redirect to `/projects/{projectId}/artifacts/{artifactId}/video/presenter`. For other types, existing flow unchanged. |
| `frontend/src/components/artifacts/create/reel-creator.tsx` | **DELETE.** No longer used; replaced by the new wizard pages under `/video/`. |
| `frontend/src/components/artifacts/preview/reel-preview.tsx` (if exists) | **DELETE** if only used by the old reel creator. Check imports before removing. |
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/new/page.tsx` (edit) | Remove imports of `reel-creator.tsx`; remove the old REEL branch. |
| `frontend/src/lib/api/video-sessions.ts` (extend) | `getSession(sessionId)` — returns full session state including `current_step`, `presenter_id`, `current_script_id`, scene count, and generated video count for use by the layout |

## API endpoints

No new endpoints. Phase 7 is wiring, deletion, and the layout component. All integration work happens inside the Phase 5 worker and the existing compliance/gamification/notification services.

## Files to delete (explicit list)

Before starting this phase, grep for imports of these files to ensure no dangling references:

- `frontend/src/components/artifacts/create/reel-creator.tsx`
- `frontend/src/components/artifacts/preview/reel-preview.tsx` (verify it's only consumed by the old reel-creator; keep if referenced elsewhere — e.g. by other previews)
- Any `.tsx` file whose sole purpose was the static storyboard reel preview

Deletion checklist:
1. `grep -r "reel-creator" frontend/src/` — must return zero results after deletion
2. `grep -r "reel-preview" frontend/src/` — same, unless still used elsewhere
3. `npm run typecheck` still passes

## Wizard step indicator behaviour

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Presenter   │    Script    │  Storyboard  │    Videos    │
│  (completed) │   (current)  │  (disabled)  │  (disabled)  │
└──────────────┴──────────────┴──────────────┴──────────────┘
   ✓ clickable    highlighted    not clickable   not clickable
```

- Unlock rule: a step is unlocked when `video_session.current_step` equals it OR precedes it. Completed steps (preceding current) are clickable; users can revisit to edit presenter / script / scenes.
- Current step advances only via the service layer on "Continue" actions (Phase 2: assign presenter → step=SCRIPT; Phase 3: draft or manual script save → step=STORYBOARD; Phase 4: scenes generated → step=GENERATION).

## Integration hook sequence diagram (on video READY)

```
Worker finishes final scene upload
         │
         ↓
GeneratedVideo.status = READY
         │
    ┌────┼────────────────────────────────────┐
    │    │                                    │
    ↓    ↓                                    ↓
compliance_scorer.score_artifact      notification_service.notify_video_ready
(final script content)                (all project members receive VIDEO_READY)
    │
    ↓
gamification_service.award_points_once(user, VIDEO_GENERATED, artifact_id)
    │
    ↓
artifact.compliance_score updated
```

All three hooks fire in sequence within the worker. Wrap each in try/except — a failure in notifications must not cause the whole generation to appear failed to the user; log the error and continue.

## Key implementation details

- **Compliance scoring runs on the final script, not the MP4.** The existing scorer is text-based (Gemini against rules). Calling it with the approved script content is sufficient and matches what happens for posters/WhatsApp cards. The score attaches to `Artifact.id`, not `GeneratedVideo.id`, so the existing compliance UI surfaces it automatically.
- **Gamification idempotency:** Points award is keyed on `(user_id, reason, related_artifact_id)`. Users can regenerate the same artifact many times and get points only once. Check PointsLog before awarding; if a row exists, no-op. This prevents gaming the system by deleting and regenerating.
- **Notification fan-out:** VIDEO_READY goes to all project members (per CRAFT's existing pattern for project-shared events). VIDEO_FAILED goes only to the triggering user (private). Reuse the notification_service pattern from existing flows.
- **Wizard shell data fetching:** The layout component fetches `getSession(sessionId)` once and provides the state via React context to child pages. Child pages refetch on their own mutations but read initial state from context. Avoids prop-drilling.
- **Route parameter consistency:** The wizard uses `projectId` + `artifactId` from URL params. The `sessionId` is resolved server-side via `artifact_id` (1:1 relationship from Phase 1). Frontend may cache `sessionId` once resolved to avoid repeated lookups.
- **Step advancement vs UI navigation:** `current_step` is a hint for the step indicator. Users can navigate freely back to completed steps and their edits are preserved. The pipeline does NOT force linear completion — e.g. a user can change the presenter after generating scenes (scenes become stale but remain viewable).
- **Deletion safety of old reel creator:** Check `.claude/specs/unimplemented-features.md` item "Reel Animated Preview" — this PRD fulfils that deferred item. Remove it from the unimplemented list as part of this phase.
- **Project brief fields expected by AI draft:** Phase 3 AI draft reads `project.brief` JSONB. If existing projects don't have `video_type`, `target_audience`, `key_message`, `cta_text`, the draft endpoint falls back to sensible defaults. Document the expected brief schema in the project brief wizard step for future projects.
- **Backwards compatibility:** Existing VIDEO/REEL artifacts (if any in the database) don't have `VideoSession` rows. On first visit to their artifact page, a migration service creates the missing VideoSession. Alternatively, a data migration backfills. Proposed: on-demand creation — simpler, no migration required.

## Verification

End-to-end smoke test:
1. Log in as a FSC; create a new project with a brief
2. Create an artifact of type VIDEO from the project → redirected to `/video/presenter`
3. Step indicator shows Presenter as current; other steps disabled
4. Fill presenter form (or pick from library); click Continue → `/video/script`, step indicator updates
5. Click "Auto-draft from brief" → script appears; continue to `/video/storyboard`
6. Scenes auto-generate; review and edit one; click Continue to `/video/videos`
7. Click "Generate Video" → card appears in QUEUED → transitions to RENDERING with progress → READY
8. Verify compliance score appears on the parent artifact page
9. Verify a PointsLog row was created for the user with reason=VIDEO_GENERATED
10. Regenerate the same artifact → second video appears, but NO new points awarded
11. Verify all project members received a VIDEO_READY notification
12. Trigger a failure (mock Veo to error) → only the triggering user receives VIDEO_FAILED

Cleanup verification:
- `grep -r "reel-creator" frontend/src/` → zero results
- Visit `/projects/{id}/artifacts/new` → REEL and VIDEO both route to the new wizard
- Visit a legacy VIDEO artifact (if any) → VideoSession is auto-created on first visit; wizard opens on Presenter step

General:
- `cd backend && pytest` — full suite passes
- `cd backend && mypy app/` passes
- `cd frontend && npm run typecheck` passes
- `cd frontend && npm run lint` passes
- Verify in browser using dev-browser skill
- Update `.claude/specs/unimplemented-features.md` — remove "Reel Animated Preview" entry; close the loop
