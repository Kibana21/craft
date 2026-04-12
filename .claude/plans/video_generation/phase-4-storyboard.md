# Phase 4: Scene Storyboarding

**Goal:** AI scene generation that splits the script into ordered scenes, per-scene edit/insert/delete with contiguous renumbering, the merged-prompt builder, and the storyboard UI with scene cards.

**User stories:** US-014 (AI scene generation), US-015 (Regenerate all), US-016 (Scene edit API), US-017 (Merged prompt builder), US-018 (Scene insertion), US-019 (Scene deletion), US-020 (Storyboard UI)

**Dependencies:** Phase 2 (presenter required for merged prompt) + Phase 3 (script required for AI split).

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/video_sessions.py` (extend) | `POST /api/video-sessions/{id}/scenes/generate` (first-time split), `POST /api/video-sessions/{id}/scenes/regenerate` (wipe + re-split), `GET /api/video-sessions/{id}/scenes` (list ordered) |
| `backend/app/api/scenes.py` | New router. `PATCH /api/scenes/{id}` (update any subset of name/dialogue/setting/camera_framing), `POST /api/video-sessions/{id}/scenes` (insert at position), `DELETE /api/scenes/{id}` |
| `backend/app/schemas/scene.py` | `SceneResponse` (id, sequence, name, dialogue, setting, camera_framing, merged_prompt_present: bool — don't expose the full prompt), `SceneUpdate` (all fields optional), `SceneInsertRequest` (position, name, dialogue, setting, camera_framing), `SceneListResponse` (scenes: list, scenes_script_version_id, current_script_version_id — for staleness detection) |
| `backend/app/services/video_service.py` | Core pipeline service. `build_merged_prompt(scene, presenter, brand_kit) -> str` — pure function, exact template from PRD §3.1. `generate_scenes(session_id)` — fetches script, calls Gemini, bulk-inserts scenes. `regenerate_scenes(session_id)` — wraps delete-all + generate_scenes in a single transaction. `update_scene(scene_id, data)` — does NOT rebuild merged prompt (per PRD FR-13). `insert_scene(session_id, position, data)` — renumbers via deferred-constraint transaction + builds new merged prompt. `delete_scene(scene_id)` — atomically shifts subsequent sequences down by 1. |
| `backend/app/services/ai_service.py` (extend) | `split_script_into_scenes(script, target_duration_seconds) -> list[dict]` — structured Gemini call returning scenes array |
| `backend/app/services/prompt_builder.py` (extend) | `build_scene_split_prompt(script, duration)` — instructs Gemini to split by target duration per PRD §3.8 heuristics, returning strict JSON: `[{name, dialogue, setting, camera_framing}, ...]`. `build_scene_merged_prompt(scene, presenter, brand_kit)` — implementation of the public merged-prompt template |
| `backend/app/services/brand_kit_service.py` (reuse) | `get_by_id(brand_kit_id)` — existing service feeds into merged prompt builder |
| `backend/app/core/config.py` (extend) | Add `VIDEO_SPEAKING_PACE_WPM = 150` constant if not already set in Phase 3 |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/storyboard/page.tsx` | Storyboard step page: auto-triggers `scenes/generate` if no scenes exist, renders list of `SceneCard` in sequence order, shows "Regenerate all scenes" button + staleness banner |
| `frontend/src/components/video/scene-card.tsx` | Editable card per scene. Fields: scene number (fixed label), name (text input), dialogue (textarea, italic with left-border styling), setting (text input), camera framing (dropdown), "Presenter Locked" + "Brand Locked" chips (non-interactive), Save button (shows "Saved ✓" briefly), single-click Delete button. Form dirty-state tracked client-side. |
| `frontend/src/components/video/scene-insert-button.tsx` | Small "+ Insert scene" button rendered between adjacent cards and above Scene 1. Opens the insert modal. |
| `frontend/src/components/video/scene-insert-modal.tsx` | Modal with fields Name, Dialogue, Setting, Camera Framing. Confirm calls the insert endpoint with the chosen position. |
| `frontend/src/components/video/staleness-banner.tsx` | Amber banner rendered above the scene list when `scenes_script_version_id != current_script_version_id`. Has "Regenerate scenes" CTA that triggers `scenes/regenerate` with a confirmation dialog. |
| `frontend/src/components/video/camera-framing-select.tsx` | Dropdown with the 7 PRD-defined options, each with a short descriptor for user guidance |
| `frontend/src/lib/api/video-sessions.ts` (extend) | `generateScenes(sessionId)`, `regenerateScenes(sessionId)`, `listScenes(sessionId)` |
| `frontend/src/lib/api/scenes.ts` | `updateScene(sceneId, data)`, `insertScene(sessionId, position, data)`, `deleteScene(sceneId)` |
| `frontend/src/types/scene.ts` | `Scene`, `CameraFraming` types matching backend enums |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/video-sessions/{id}/scenes/generate` | Project member | AI-split script into scenes (409 if scenes already exist) |
| POST | `/api/video-sessions/{id}/scenes/regenerate` | Project member | Wipe all scenes and re-split |
| GET | `/api/video-sessions/{id}/scenes` | Project member | List scenes in sequence order + script version metadata for staleness check |
| PATCH | `/api/scenes/{id}` | Project member | Update scene fields (does NOT rebuild merged prompt) |
| POST | `/api/video-sessions/{id}/scenes` | Project member | Insert a new scene at a given position; renumber subsequent scenes |
| DELETE | `/api/scenes/{id}` | Project member | Delete and renumber remaining scenes contiguously |

## Merged prompt template (per PRD §3.1 / source spec §5.2)

```
{scene.dialogue}

Setting: {scene.setting}
Camera: {scene.camera_framing}

Presenter: {presenter.full_appearance_description}

Speaking style: {presenter.speaking_style}

Brand kit: {brand_kit_formatted}
```

`brand_kit_formatted` starts as `"Brand colors: {primary} and {secondary}; tone: {brand_kit.tone or 'professional'}"`. Finalise per PRD Open Question in Phase 4 or Phase 7 as the template shape is confirmed.

## AI scene-split response schema (JSON mode)

```json
{
  "scenes": [
    {
      "name": "string",
      "dialogue": "string",
      "setting": "string",
      "camera_framing": "WIDE_SHOT | MEDIUM_SHOT | CLOSE_UP | OVER_THE_SHOULDER | TWO_SHOT | AERIAL | POV"
    }
  ]
}
```

Scene count follows PRD §10.8: 30s→1–2, 60s→2–3, 90s→3–4, 2min→4–5, 3min→5–7, 5min→8–12. Passed to Gemini as guidance.

## Key implementation details

- **Merged prompt builder is a pure function.** No DB writes. Called from `generate_scenes`, `regenerate_scenes`, and `insert_scene`. Unit-tested independently with a fake `Presenter`, `Scene`, `BrandKit`. Critical invariant: presenter full_appearance text is inserted verbatim — no AI rewriting.
- **Missing presenter handling:** If `presenter is None`, omit the `Presenter:` and `Speaking style:` lines entirely (per PRD §10.1). Test this branch explicitly.
- **Presenter snapshot vs FK:** Because the merged prompt embeds the full appearance text at scene creation time, later presenter updates do NOT retroactively update scenes (per PRD FR-15 and source spec §10.6). The `merged_prompt` column is the source of truth at generation time.
- **Renumbering safety:** Phase 1 set up the `(video_session_id, sequence)` unique constraint as `DEFERRABLE INITIALLY DEFERRED`. Insert = `UPDATE scenes SET sequence = sequence + 1 WHERE video_session_id = ? AND sequence >= ?` inside a transaction, then INSERT the new row at the position. Delete = DELETE + `UPDATE scenes SET sequence = sequence - 1 WHERE sequence > deleted_sequence`. Both must be a single transaction.
- **Edit does NOT rebuild merged prompt.** Per PRD FR-13 and source spec §4.6. The merged prompt is only (re)built on generate/regenerate/insert. At video-generation time (Phase 5), the worker rebuilds merged prompts from the latest field values so edits take effect without requiring the user to regenerate the prompt manually.
- **Staleness banner logic:** Storyboard page sends `GET /scenes` which returns both `scenes_script_version_id` and the latest script version id. Banner renders iff they differ AND scenes exist. When the user clicks "Regenerate scenes," show a confirmation dialog ("This will delete all current scenes") before calling the endpoint.
- **Auto-generate on first visit:** Storyboard page calls `GET /scenes` first. If the response is empty AND a script exists with non-empty content, calls `scenes/generate` automatically. If no script exists, shows an error state directing the user back to the script step.
- **Atomicity of regenerate:** Wrap delete-all + generate inside a single transaction. If generation fails, roll back — don't leave the session with zero scenes.
- **Transaction boundaries:** Use `async with session.begin()` in the service layer. Do NOT rely on route-level auto-commit.
- **Frontend delete confirmation:** Single-click delete per PRD Design §7 / source spec §4.8 — scenes are cheap to re-add, unlike video deletion which requires two-click confirm.
- **Save button UX:** On successful `PATCH`, button text flips to "Saved ✓" for ~2 seconds then resets. Use a React ref + timeout.
- **Camera framing dropdown guidance:** Each option includes a short help text (e.g., "Wide Shot — full environment visible; presenter small in frame"). Helps users understand when to use which.

## Verification

- Visit storyboard step on a session with script + presenter + no scenes → AI auto-runs; expected scene count for the target duration appears
- Each scene card shows "Presenter Locked" and "Brand Locked" chips
- Edit a scene name → click Save → "Saved ✓" briefly; reload page → edit persists; merged_prompt unchanged (query DB to confirm)
- Insert scene between positions 2 and 3 → new scene becomes sequence 3; former 3 and later shift to 4, 5, …
- Delete scene at sequence 3 → subsequent scenes renumber contiguously; no gaps
- Click "Regenerate all scenes" → confirm → all scenes replaced
- Update the script (changes `current_script_version_id`) → revisit storyboard → amber staleness banner appears
- Test merged prompt builder with fixture: presenter, scene, brand kit → output matches template exactly
- Test merged prompt with `presenter=None` → presenter lines omitted
- Test inserting at position 1 (before Scene 1) → all existing scenes shift
- Test delete-then-insert cycle → sequence integrity preserved
- `cd backend && pytest tests/test_video_service.py tests/test_scenes.py` — all above covered
- `cd backend && mypy app/` passes
- `cd frontend && npm run typecheck` passes
- Verify in browser using dev-browser skill
