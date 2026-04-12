# Phase 6: Playback & Video Management

**Goal:** HTTP Range–enabled streaming endpoint, full-screen video player overlay, MP4 download, and two-click delete with job cancellation for in-flight generations.

**User stories:** US-026 (Streaming endpoint), US-027 (Player overlay), US-028 (Download), US-029 (Delete with cancellation)

**Dependencies:** Phase 5 (`GeneratedVideo` rows exist and have file URLs).

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/generated_videos.py` | New router. `GET /api/generated-videos/{id}/stream` (HTTP Range streaming of the MP4; also used as download URL), `DELETE /api/generated-videos/{id}` (delete with job cancellation) |
| `backend/app/services/video_generation_service.py` (extend Phase 5 file) | `delete(generated_video_id, user_id)` — branches on status: if QUEUED or RENDERING, flip status to a terminal state (cancellation flag, worker aborts between scenes), then delete row; if READY, delete S3 object first, then row. Enforces project membership. |
| `backend/app/core/s3.py` (reuse) | Existing S3 client used to fetch byte ranges and delete objects |
| `backend/app/services/stream_service.py` | `stream_mp4(generated_video_id, range_header) -> StreamingResponse` — parses `Range: bytes=start-end`, reads that byte range from S3, returns 206 Partial Content with correct `Content-Range`, `Accept-Ranges: bytes`, `Content-Length`. Streams in 1 MB chunks. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/components/video/video-player-overlay.tsx` | Full-screen MUI Dialog (`fullScreen={true}`). HTML5 `<video>` with controls, autoplay, header showing "Version N", close button (×), clicking outside also closes, download button in footer. Video source is the streaming endpoint (US-026). |
| `frontend/src/components/video/video-card.tsx` (extend Phase 5 file) | Wire up the previously stubbed handlers: click thumbnail → open player overlay; click Download → trigger file download; click Delete → enter two-click confirm state |
| `frontend/src/components/video/video-delete-button.tsx` | Two-click confirm pattern. Initial state: trash icon. First click: red button with text "Confirm delete?" + "Cancel" link. Second click: calls `DELETE` endpoint. Cancel link resets state. |
| `frontend/src/lib/api/generated-videos.ts` (extend Phase 5 stub) | `streamUrl(videoId)` — returns the streaming endpoint URL for use as `<video src=...>`. `deleteVideo(videoId)` — calls DELETE. |
| `frontend/src/hooks/useVideoDownload.ts` | Hook that downloads the MP4 from the streaming endpoint. Uses `<a href download>` anchor trick to trigger browser download. File name derived from version (e.g. `Version 3.mp4`). |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/generated-videos/{id}/stream` | Project member | Streams the MP4 with HTTP Range support; 404 if status != READY; used for both playback and download |
| DELETE | `/api/generated-videos/{id}` | Project member | Delete video and/or cancel job; irreversible |

## Key implementation details

- **Streaming is the single source of truth for the MP4 URL.** Both the `<video>` tag and the download button hit the same endpoint. This matches PRD §7.3 / source spec §7.3 and avoids signed-URL expiration issues.
- **HTTP Range support is mandatory for player seek.** Without it, seeking to the middle of a long video would be impossible or would require full download first. Implementation: parse `Range: bytes=X-Y` header; use boto3 `get_object(Range=f"bytes={X}-{Y}")` to fetch just that chunk; return 206 Partial Content. If no Range header, return 200 with the full body (rare — browsers always send Range for video).
- **Authorization on every stream request.** Browsers will send authentication on each Range request. The endpoint must verify project membership on every call, not just the first one. Reuse existing RBAC.
- **404 for non-READY videos.** If the caller tries to stream a video that's QUEUED, RENDERING, or FAILED, return 404 with a clear message. Don't return 400 — 404 is semantically correct for "no file at this location."
- **Delete branches:**
  - **READY:** Delete S3 object first (best-effort — log warnings if it fails but proceed), then delete DB row.
  - **QUEUED or RENDERING:** Flip status to a terminal "cancelled" state. Worker checks between scenes and aborts. Then delete the DB row once worker acknowledges (or immediately, accepting a brief transient orphan; document this tradeoff). Do NOT hit Veo to cancel an in-flight call — the timeout on the worker side will handle that; we just stop starting new scenes.
  - **FAILED:** Delete DB row (no file to clean up).
- **Irreversibility:** No soft-delete. The source spec (§8.3) explicitly says deletion is irreversible. Make this visible to the user via the two-click confirm.
- **Two-click delete UX (frontend):**
  1. First click: button turns red, text becomes "Confirm delete?", "Cancel" link appears beside it
  2. Second click on the red button: fires DELETE
  3. Click "Cancel": resets to initial state
  4. Click elsewhere: also resets (blur handler) — prevents confusing stuck confirm state
- **Player overlay:** Use MUI `Dialog` with `fullScreen={true}` + `onClose` for backdrop clicks. Inside, a simple `<video controls autoplay>`. Keep it native — no custom controls library needed for v1.
- **File name in download:** HTTP header `Content-Disposition: attachment; filename="Version {version}.mp4"` served by the streaming endpoint when a query parameter like `?download=true` is present. The frontend `useVideoDownload` hook adds this param when the user clicks Download (but NOT when the `<video>` element requests the stream).
- **Reuse existing exports plumbing:** The `/api/artifacts/{id}/export` endpoint already exists and handles MP4 exports for the legacy static reel. For AI-generated videos, we don't need to route through that — our streaming endpoint already serves MP4s. Leave export for non-video artifact types unchanged.
- **Bandwidth/cost awareness:** Large MP4s streamed via the app server will consume bandwidth. For production, consider a signed CDN URL approach (CloudFront/R2 public bucket with short-lived signed URLs) — out of scope for this PRD. Flag in Phase 7 polish.

## Verification

- Click a Ready video thumbnail → full-screen player opens, autoplays
- Seek to the middle of a long video → plays from that point without buffering the start (Range works)
- Close player via × → returns to videos page with playback stopped
- Close player via outside click → same behaviour
- Click Download on the card → MP4 file downloads named `Version N.mp4`
- Click Download inside the player footer → same file
- First click on Delete → button turns red with "Confirm delete?" + Cancel link
- Click Cancel → button resets
- Second click on Confirm delete? → card disappears from list
- Delete a Ready video → S3 object is gone (check bucket); DB row is gone
- Delete a QUEUED video → status flips and row is removed; worker never starts
- Delete a RENDERING video mid-generation → worker aborts between scenes, row is removed, Veo is not hit again
- Unauthorized user attempting GET /stream on a Ready video → 403
- `cd backend && pytest tests/test_generated_videos.py` — covers all delete branches and Range parsing
- `cd backend && mypy app/` passes
- `cd frontend && npm run typecheck` passes
- Verify in browser using dev-browser skill
