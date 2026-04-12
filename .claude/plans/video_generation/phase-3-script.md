# Phase 3: Script Creation

**Goal:** Script CRUD with live word count / duration estimate, AI draft-from-brief, four-tone rewrite, version history with restore, and staleness tracking tied to scene generation.

**User stories:** US-009 (Script CRUD), US-010 (AI draft), US-011 (Tone rewrite), US-012 (Version history), US-013 (Staleness detection)

**Dependencies:** Phase 1 (models). Runs in parallel with Phase 2 — both depend only on Phase 1.

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/video_sessions.py` (extend) | Script endpoints: `GET /api/video-sessions/{id}/script`, `PATCH /api/video-sessions/{id}/script` (content update with auto-save), `POST /api/video-sessions/{id}/script/draft` (AI draft), `POST /api/video-sessions/{id}/script/rewrite` (tone rewrite), `GET /api/video-sessions/{id}/script-versions` (list), `POST /api/video-sessions/{id}/script-versions/{version_id}/restore` |
| `backend/app/schemas/video_script.py` | `ScriptResponse` (content, word_count, estimated_duration_seconds, updated_at), `ScriptUpdateRequest` (content), `ScriptDraftRequest` (optional overrides for brief fields), `ScriptRewriteRequest` (tone: ScriptAction enum restricted to {WARM, PROFESSIONAL, SHORTER, STRONGER_CTA}), `ScriptVersionResponse` (id, action, created_at, preview: first 150 chars) |
| `backend/app/services/video_script_service.py` | `get_or_create_script(session_id)`, `update_content(session_id, content)` — computes word_count and estimated_duration_seconds at 150 wpm, upserts the `VideoScript` row, creates a `ScriptVersion` with `action=MANUAL` if content meaningfully changed (diff-based). `draft_from_brief(session_id)` — pulls project brief + brand kit + target_duration, calls AI. `rewrite(session_id, tone)` — snapshots current as version, calls AI with tone-specific prompt, replaces content. `list_versions(session_id)`. `restore(session_id, version_id)` — snapshots current as version, replaces content with restored text. |
| `backend/app/services/ai_service.py` (extend) | `draft_script(brief, brand_kit, target_duration_seconds) -> str`, `rewrite_script(current_content, tone) -> str` |
| `backend/app/services/prompt_builder.py` (extend) | `build_script_draft_prompt(brief, brand_kit, duration)` — includes video type, target audience, key message, CTA, tone; instructs Gemini to produce intro → content → CTA structure fitting target duration at 150 wpm. `build_script_rewrite_prompt(script, tone)` — tone-specific instructions matching PRD Tone Rewrite table. |
| `backend/app/services/video_session_service.py` (extend) | `get_session_with_script(session_id)` with `selectinload(VideoSession.current_script)` |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/script/page.tsx` | Script step page: large textarea, live word count + duration estimate, "Auto-draft from brief" button, four tone chips, version history drawer trigger |
| `frontend/src/components/video/script-editor.tsx` | Controlled textarea with debounced auto-save (2s after last keystroke). Displays `{word_count} words · ~{duration} seconds (target: {target})`. Color-coded when estimate is >20% off target. |
| `frontend/src/components/video/tone-chips.tsx` | Four pill buttons (Warm & Personal, More Professional, Shorter, Stronger CTA). Each disables itself while its call is in flight. On error, shows inline message near the button; textarea content unchanged. |
| `frontend/src/components/video/script-version-drawer.tsx` | Right-side drawer listing versions newest-first with action label, timestamp, 150-char preview, "Restore" button. Restore shows a confirmation toast "Your current script will be saved as a version first." |
| `frontend/src/lib/api/video-sessions.ts` (extend) | `getScript(sessionId)`, `updateScript(sessionId, content)`, `draftScript(sessionId)`, `rewriteScript(sessionId, tone)`, `listScriptVersions(sessionId)`, `restoreScriptVersion(sessionId, versionId)` |
| `frontend/src/types/video-script.ts` | `Script`, `ScriptVersion`, `ScriptAction` types |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/video-sessions/{id}/script` | Project member | Returns current script (creates empty row if none) |
| PATCH | `/api/video-sessions/{id}/script` | Project member | Update content; recomputes word_count + estimate |
| POST | `/api/video-sessions/{id}/script/draft` | Project member | Gemini writes full script from project brief |
| POST | `/api/video-sessions/{id}/script/rewrite` | Project member | Gemini rewrites in selected tone; previous saved as version |
| GET | `/api/video-sessions/{id}/script-versions` | Project member | List script versions, newest-first |
| POST | `/api/video-sessions/{id}/script-versions/{version_id}/restore` | Project member | Restore a prior version; current saved as a new version first |

## Key implementation details

- **Word count / duration math:** `word_count = len(content.split())`. `estimated_duration_seconds = round(word_count / 150 * 60)`. 150 wpm is the industry-standard speaking pace; keep it as a constant for easy tuning.
- **Auto-save debounce:** 2 seconds after last keystroke (matches existing CRAFT patterns). Avoid saving on every keystroke — too noisy. The `PATCH` endpoint is idempotent.
- **Version creation rules:** AI actions (DRAFT, WARM, PROFESSIONAL, SHORTER, STRONGER_CTA) always save the prior content as a version before replacing. Manual edits save as a version only when the diff is "meaningful" — proposal: when word count changes by ≥10 OR 60 seconds have passed since the last MANUAL version. Prevents version spam while keeping recovery possible.
- **Restore behaviour:** Restoring always first snapshots the current script as a new `ScriptVersion` (action=MANUAL). That way a restore is always recoverable.
- **Staleness tracking (US-013):** Only updated in Phase 4 (when scenes are generated, `video_sessions.scenes_script_version_id = latest_script_version.id`). In this phase, we make sure every script update creates a new `ScriptVersion` so version IDs advance monotonically — the storyboard page compares these in Phase 4.
- **Brief inputs for AI draft:** Pull from `project.brief` JSONB (video_type, target_audience, key_message, cta_text) + `project.brand_kit_id` → brand_kit (tone) + `video_session.target_duration_seconds`. The AI draft endpoint does NOT take request body fields by default; the brief drives it. Optional override body (`ScriptDraftRequest`) lets the frontend pass one-off adjustments without mutating the project brief.
- **Tone rewrite options:** Only the four values in the PRD are accepted. The `ScriptAction` enum also includes `DRAFT` and `MANUAL` but those must NOT be accepted on the rewrite endpoint — validate and reject with 400.
- **AI error rule:** On Gemini failure, return 502; script content is not mutated. Frontend shows inline message; textarea value is preserved (FR).
- **Debounced save vs AI action race:** If the user triggers an AI action while a debounced save is pending, the AI service should read the current DB state (authoritative) not the request body. Pattern: flush the pending auto-save before dispatching the AI call from the frontend.

## Verification

- Create a VIDEO artifact, assign presenter, navigate to script step — GET returns empty script
- Type in the textarea — word count and duration update live; after 2s the save fires
- Click "Auto-draft from brief" — full script appears; a `ScriptVersion` row with `action=DRAFT` is created (snapshotting the prior empty content)
- Click "More Professional" — script rewritten in formal tone; another version with `action=PROFESSIONAL` is created
- Open version drawer — both versions listed newest-first with previews
- Click "Restore" on the DRAFT version — current script replaced; another MANUAL version is created for the professional script
- Trigger Gemini failure (mock) — 502 returned; textarea unchanged
- `cd backend && pytest tests/test_video_script.py` — covers word count, version creation rules, restore, rewrite validation
- `cd backend && mypy app/` passes
- `cd frontend && npm run typecheck` passes
- Verify in browser using dev-browser skill
