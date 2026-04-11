# Phase 7: Brand Kit Management + Export Pipeline

**Goal:** Brand kit admin UI + server-side rendering of exports (PNG/JPG for posters/cards, MP4 for reels).

**User stories:** US-019 (brand kit management), US-020 (export artifacts)

**Dependencies:** Phase 5 (artifacts with content), Phase 6 (compliance scoring gates exports)

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/brand_kit.py` | `GET /api/brand-kit` (get current), `PATCH /api/brand-kit` (update), `POST /api/brand-kit/logo` (upload logo), `POST /api/brand-kit/font` (upload font file) |
| `backend/app/api/exports.py` | `POST /api/artifacts/{id}/export` (trigger export), `GET /api/exports/{id}/status` (poll status), `GET /api/exports/{id}/download` (download file) |
| `backend/app/schemas/brand_kit.py` | `BrandKitResponse(id, logo_url, secondary_logo_url, primary_color, secondary_color, accent_color, fonts, updated_by, updated_at)`, `UpdateBrandKitRequest(primary_color?, secondary_color?, accent_color?, fonts?)` |
| `backend/app/schemas/export.py` | `ExportRequest(format: png|jpg|mp4, aspect_ratio?)`, `ExportResponse(export_id, status)`, `ExportStatusResponse(export_id, status: processing|ready|failed, download_url?)` |
| `backend/app/services/brand_kit_service.py` | `get_brand_kit()` — returns singleton row. `update_brand_kit(user, data)` — validates brand_admin. `upload_logo(user, file, variant)`. `upload_font(user, file, slot)`. |
| `backend/app/services/export_service.py` | `export_artifact(user, artifact_id, format, aspect_ratio)` — validates compliance >= 70, dispatches to renderer, logs export in export_log, stores result in S3, returns download URL. |
| `backend/app/services/render_service.py` | `render_poster(artifact, brand_kit, aspect_ratio, format)` — Pillow + CairoSVG: background image, text overlays (headline, tagline using brand fonts), logo placement, disclaimer block, headshot compositing, brand colors. Output: high-res image (2048px longest side). `render_whatsapp_card(artifact, brand_kit)` — similar, fixed 800x800. `render_reel(artifact, brand_kit)` — ffmpeg-python: render each storyboard frame as still (Pillow), concatenate with crossfade transitions, add text overlay animations, encode H.264 MP4 at 1080x1920 (9:16). |
| `backend/app/services/watermark_service.py` | `apply_watermark(image_bytes, watermark_type, user_name?)` — Pillow. "AIA Official" for Brand Library items. "Crafted with CRAFT — {agent_name}" for personal artifacts. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/brand-kit/page.tsx` | Brand kit management (admin only): logo upload, color pickers, font upload, live preview panel |
| `frontend/src/components/brand-kit/logo-upload.tsx` | Logo upload with preview (primary + secondary variants) |
| `frontend/src/components/brand-kit/color-picker.tsx` | Hex color input with visual swatch. Fields: primary, secondary, accent. |
| `frontend/src/components/brand-kit/font-upload.tsx` | Font file upload for heading, body, accent slots. Shows font name + preview text. |
| `frontend/src/components/brand-kit/brand-preview.tsx` | Live preview: renders a sample poster mockup using current brand kit settings |
| `frontend/src/components/artifacts/export-dialog.tsx` | Export dialog: available formats based on artifact type, compliance score check, processing spinner, download button |
| `frontend/src/components/artifacts/export-format-options.tsx` | Format selection: poster (PNG/JPG, 1:1/4:5/9:16), WhatsApp (PNG 800x800), Reel (MP4 9:16) |
| `frontend/src/lib/api/brand-kit.ts` | `fetchBrandKit()`, `updateBrandKit(data)`, `uploadLogo(file, variant)`, `uploadFont(file, slot)` |
| `frontend/src/lib/api/exports.ts` | `exportArtifact(artifactId, format, aspectRatio)`, `checkExportStatus(exportId)`, `downloadExport(exportId)` |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/brand-kit` | Any | Get current brand kit |
| PATCH | `/api/brand-kit` | brand_admin | Update brand kit |
| POST | `/api/brand-kit/logo` | brand_admin | Upload logo |
| POST | `/api/brand-kit/font` | brand_admin | Upload font |
| POST | `/api/artifacts/{id}/export` | Any | Trigger export |
| GET | `/api/exports/{id}/status` | Any | Check export status |
| GET | `/api/exports/{id}/download` | Any | Download exported file |

## Export flow (async)

```
1. User clicks Export → selects format
2. Frontend: POST /api/artifacts/{id}/export { format: "png", aspect_ratio: "1:1" }
3. Backend validates compliance_score >= 70 (else 400)
4. Backend creates export record, dispatches render to BackgroundTasks
5. Returns { export_id, status: "processing" }
6. Frontend polls GET /api/exports/{id}/status every 2 seconds
7. When status = "ready", download_url is available
8. Frontend shows download button / auto-downloads
```

Reel rendering with ffmpeg can take 10-30 seconds; poster/card rendering takes 2-5 seconds.

## Render pipeline (poster/card)

```python
render_poster(artifact, brand_kit, aspect_ratio, format):
  1. Load AI-generated background image from S3
  2. Resize/crop to target dimensions (1:1=1080x1080, 4:5=1080x1350, 9:16=1080x1920)
  3. Overlay brand colors (gradient or tint per brand_kit)
  4. Place logo (from brand_kit.logo_url) at designated position (top-right)
  5. Render headline text (brand_kit heading font, brand colors)
  6. Render tagline/sub-headline
  7. Composite FSC headshot (if present) in designated region
  8. Render agent name next to headshot
  9. Add disclaimer block at bottom (auto-inserted per product type)
  10. Apply watermark
  11. Encode as PNG or JPG (quality 95)
  12. Upload to S3, return URL
```

## Render pipeline (reel)

```python
render_reel(artifact, brand_kit):
  1. For each storyboard frame:
     a. Generate/load background image (from Imagen 3 or per-frame visual_description)
     b. Apply brand color tint
     c. Render text_overlay (brand fonts, positioned center)
     d. Add logo watermark (corner)
     e. Save as temporary PNG
  2. Use ffmpeg-python to concatenate frames:
     - Each frame displayed for duration_seconds
     - Crossfade transitions between frames
     - H.264 encoding, 1080x1920, 30fps
  3. Upload MP4 to S3, return URL
```

## File naming convention

`{product}_{audience}_{type}_{format}.{ext}`

Examples:
- `PAA_Young_Parents_poster_1x1.png`
- `HealthShield_customer_whatsapp_800x800.png`
- `PAA_Young_Parents_reel_9x16.mp4`

## Key implementation details

- Brand kit is a singleton — one row in `brand_kit` table, seeded in the seed script.
- Changes to brand kit apply to newly created/exported artifacts only; existing artifacts are not retroactively changed.
- Every export is logged in `export_log` with compliance score at time of export (audit trail).
- Watermark types: "AIA Official" (semi-transparent bottom-right) for library-sourced content, "Crafted with CRAFT — Maya Chen" for personal content.
- The download endpoint should return the file with proper `Content-Disposition` header for automatic browser download.

## Verification

- Brand admin updates colors → preview panel reflects changes
- Brand admin uploads logo → logo appears in preview
- Export poster as PNG → file downloads with correct dimensions
- Export reel as MP4 → video plays, has transitions and text overlays
- Export blocked when compliance score < 70 (400 response)
- Watermark applied correctly based on artifact origin (library vs personal)
- Export logged in export_log table
- `pytest` passes
- `npm run typecheck` passes
