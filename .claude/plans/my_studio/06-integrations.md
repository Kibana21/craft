# 06 — Integrations

Three existing CRAFT surfaces that need hooks into My Studio. Each is small and independent; can be merged in any order once Phase A is shipped.

---

## 1. Poster Wizard ← My Studio — "Use in Poster Wizard" deep-link

**Goal**: clicking "Use in Poster Wizard" on a My Studio image opens a **new draft poster** with that image pre-loaded as the Subject → Product/Asset reference.

### Data-layer: bridging StudioImage → PosterReferenceImage

The Poster Wizard expects reference images in `poster_reference_images` (session-temp, 24h TTL, artifact-scoped). StudioImages are permanent. Don't break that invariant — instead, **bridge**:

- New endpoint `POST /api/uploads/reference-image-from-studio` — body `{studio_image_id}`. Fetches bytes from `studio_image.storage_url`, uploads to the reference-image subfolder (reusing existing upload path), inserts a fresh `PosterReferenceImage` row with `expires_at = now + 24h`. Returns `{id, storage_url, expires_at}` — same shape as `uploadReferenceImage()` today.
- Clean separation: Studio image is unchanged, temp reference is a short-lived copy.

### Frontend flow

1. User clicks "Use in Poster Wizard" in the overflow menu on a StudioImage.
2. Client creates a fresh poster artifact via `createArtifact(projectId, {type: "poster", name: "Untitled poster"})` — **but which project?** Prompt the user with a simple dialog: "Which project do you want to work in?" with a quick-pick of recent projects + "Create new" option.
3. Given the new artifact_id, POST `/api/uploads/reference-image-from-studio` with the studio_image_id → receive a new `reference_image_id`.
4. Navigate to `/projects/{projectId}/artifacts/new-poster/subject?load={artifactId}&ref={referenceId}`.
5. The subject page reads `?ref=` on mount and pre-populates `subject.product_asset.reference_image_ids = [ref]` + `subject.type = "PRODUCT_ASSET"` in the PosterWizardContext.
6. The poster layout's deepest-step resolver (added in this session — `layout.tsx` `resolveDeepestSegment`) sees a populated subject and keeps the user on Step 2, which is exactly where we want them.

### Alternative — skip the project prompt

PRD §14.4 says "the Poster Wizard opens with the image pre-loaded" — it doesn't say how projects are chosen. Simplest v1: open the **same project** the user is in if they're already in a project context; otherwise open the "most recently-active project" (from a GET on `/api/projects?page=1&per_page=1`). Add the project-picker dialog only if the user has multiple active projects with no clear default.

---

## 2. Poster export → My Studio — auto-register

**Goal**: when a user exports a poster (PNG/JPG) via `/api/artifacts/{id}/export`, the exported file is also registered as a StudioImage with `type = POSTER_EXPORT`. This populates the library's "Poster exports" filter without user effort (PRD §6.1).

### Hook point

`backend/app/services/export_service.py` — the background task `run_export`. After a successful PNG/JPG upload (not MP4 — that's the video branch), call:

```python
# inside run_export, after ExportLog is marked READY
from app.services.studio_image_service import register_poster_export
await register_poster_export(
    db,
    user_id = export_log.user_id,
    export_log_id = export_log.id,
    artifact_id = artifact.id,
    storage_url = export_log.download_url,
)
```

### Behaviour

- `register_poster_export` fetches bytes, reads dimensions via Pillow, inserts a StudioImage row with `type=POSTER_EXPORT`, `name = f"Export · {artifact.name}"`, `metadata = {artifact_id, export_log_id}`.
- Idempotent: before insert, check for an existing StudioImage with `metadata->>'export_log_id' == str(export_log_id)` (fast partial index or a simple LIKE — or just a unique constraint on `(metadata->>'export_log_id')`).
- If the user later deletes the poster artifact, the StudioImage stays — it's the user's copy of the export, independent of the source artifact.

### Video exports are excluded

MP4 exports stay in the existing video flow. Only raster exports (PNG/JPG) flow into My Studio.

---

## 3. Gamification hooks

Per PRD goals + the `award_points_once` pattern already used for other actions.

### New `PointsAction` enum values

In `backend/app/models/enums.py`:

```python
class PointsAction(str, enum.Enum):
    # existing...
    MY_STUDIO_UPLOAD  = "MY_STUDIO_UPLOAD"
    MY_STUDIO_ENHANCE = "MY_STUDIO_ENHANCE"
    MY_STUDIO_BATCH   = "MY_STUDIO_BATCH"
```

### Point values

Added to `POINTS_MAP` in `backend/app/services/gamification_service.py`:

```python
POINTS_MAP = {
    ...,
    PointsAction.MY_STUDIO_UPLOAD:  5,
    PointsAction.MY_STUDIO_ENHANCE: 10,
    PointsAction.MY_STUDIO_BATCH:   25,  # per run, not per image
}
```

### Call sites

- `studio_image_service.create_from_upload` → `award_points_once(user_id, MY_STUDIO_UPLOAD, related=image_id)` after successful insert. **First upload of the day** only (idempotent by `related` — we could cap to 1 per day by using a dated `related` value; v1 uses image_id so every upload awards 5 pts up to a natural cap).
- `studio_generation_worker._execute_run` → on DONE/PARTIAL: `award_points_once(user_id, MY_STUDIO_ENHANCE if not is_batch else MY_STUDIO_BATCH, related=run_id)`.

### UI

No gamification UI changes needed — points flow into the existing leaderboard automatically. Optionally show a tiny "+10" toast on successful generation (reuse the existing toast pattern if present, else skip for v1).

---

## 4. Navigation tab placement

Already covered in doc 05 §Navigation. One-line reminder:

- CreatorNav: insert between Library and Brand Kit.
- AgentNav: FSC users also get the tab (per PRD §4.1, always visible).

---

## 5. Notifications (batch only)

Long-running batch runs (≥ 4 images) finish in 2+ minutes. Per PRD §11.4 "You can leave this page — we'll notify you when all images are ready." So:

- On run DONE / PARTIAL, insert a `Notification` row:
  - `type = "my_studio_batch_complete"`
  - `title = f"Batch enhancement ready — {n} images"`
  - `data = {run_id, outputs_count, status}`
- User sees it in the existing notifications UI; clicking it deep-links to `/my-studio` with the recent run highlighted (or the Image Detail view for a single output).

Single-image runs don't trigger notifications — the user is usually still on the generate screen watching.

---

## 6. Brand kit (opt-in, PRD §14.6)

My Studio does NOT auto-apply the brand kit. But the Prompt Builder's "Custom" intent allows free-text notes; the UI can surface a tiny hint: "Tip: type 'use AIA brand colours' if you want brand-aligned outputs." Keep it soft, not enforced.

No backend changes — brand kit is opt-in via user text, nothing to wire.

---

## 7. Compliance (explicitly no integration, PRD §14.5)

My Studio is a personal workspace. The MAS compliance engine does not run here. No integration — call out in docs so future contributors don't add it by reflex.

When an image flows out via "Use in Poster Wizard", compliance kicks in at the poster step (Step 3 Copy and export gate) per existing behaviour. Nothing to change.
