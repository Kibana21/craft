# 09 — Export Pipeline Extension

The PRD calls for **print-ready PDF** (300 DPI, CMYK, bleed) alongside digital PNG (including a 2× upscale option). The current pipeline produces RGB Pillow output — this doc specifies the extensions required for print-readiness.

## Current State

`backend/app/services/export_service.py`:
- `trigger_export(artifact_id, format)` — validates compliance score ≥ 70, creates `ExportLog`, queues a background task.
- `run_export()` → `render_service.render_poster()` composites base image + logo + tagline + disclaimer via Pillow → `apply_watermark()` → stores to `/uploads/`.

`render_service.py`:
- RGB only.
- Output formats: PNG, JPG, PDF (via Pillow's PDF encoder — not print-grade).
- Font loading via Pillow's `ImageFont.truetype`.
- Watermark: fixed position, fixed opacity.

**Gaps:**
1. No CMYK conversion.
2. No DPI enforcement (PDFs export at 72 DPI by default in Pillow).
3. No bleed/trim geometry.
4. No proper font embedding for print (Pillow rasterises text).
5. No 2× upscale integration.

---

## Target Output Matrix

| Option | Format | Resolution | Colour | Use case |
|---|---|---|---|---|
| Export PNG | PNG | 1× (matches variant resolution, typically 1024–2048px longest edge) | sRGB | Digital, social, email |
| Export PNG (2× upscale) | PNG | 2× via Gemini re-render or Pillow fallback (doc 04 §Upscale) | sRGB | High-DPI digital, large-format digital |
| Export PDF (print-ready) | PDF | 300 DPI, format-dependent pixel dims | CMYK with ICC | Print production |
| Save as variant | Internal | Same as source variant | sRGB | Preserve state |

---

## Print-Ready PDF Generation

Pillow is inadequate for print-grade PDF. Two paths:

### Path A (recommended): Pillow + `reportlab` or `pypdf`

Render composite at final pixel dimensions via Pillow (same code path we use today), then:
1. Convert raster to CMYK (with ICC profile).
2. Wrap in a PDF via **`reportlab`** (richer typography, supports CMYK images, DPI metadata, trim/bleed boxes, embedded fonts). ReportLab is a mature, permissive-licensed library that fits this use case.

Flow:
```
render_poster(variant_id, format, include_overlay=True)
  → PIL.Image (RGB, full resolution)
    → cmyk = convert_to_cmyk(rgb_image, icc_profile)
      → pdf_document = assemble_print_pdf(
            image=cmyk,
            width_mm=..., height_mm=...,
            bleed_mm=3,  # AIA spec; see doc 11
            include_trim_marks=True,
            fonts=[...],
            regulatory_text=artifact.content.copy.regulatory_disclaimer,
         )
        → write to storage, return URL
```

### Path B: Pillow only with output profile
Pillow can emit CMYK via `Image.convert("CMYK", dither=None)` and attach ICC profile bytes, but its PDF encoder doesn't expose bleed or trim boxes. Rejected for print-readiness.

**Chosen: Path A with `reportlab`.**

---

## CMYK Conversion

Use ICC profile conversion via `PIL.ImageCms`:

```python
from PIL import Image, ImageCms

def convert_to_cmyk(img: Image.Image, cmyk_profile_path: str) -> Image.Image:
    srgb_profile = ImageCms.createProfile("sRGB")
    cmyk_profile = ImageCms.getOpenProfile(cmyk_profile_path)
    transform = ImageCms.buildTransform(srgb_profile, cmyk_profile, "RGB", "CMYK")
    return ImageCms.applyTransform(img, transform)
```

**ICC profile file** bundled with the app under `backend/app/assets/icc/`:
- Choice between FOGRA39 (European coated), GRACoL 2013 (US coated), or SWOP (US uncoated) is a **doc 11 open question**. Default to FOGRA39 for v1 pending AIA print-house confirmation. Singapore print houses commonly accept FOGRA39.

---

## DPI & Geometry

### DPI

Print-ready = 300 DPI. If the variant's native resolution at the target physical size drops below 300 DPI, the pipeline:
1. Applies a 2× upscale (Gemini re-render with Pillow fallback — see doc 04 §Upscale) automatically for PDF export.
2. If still below threshold after upscale, warns the user: "Output will be < 300 DPI. Continue with lower-DPI print or 2×-upscale first?"

Minimum pixel dimensions per format at 300 DPI:

| Format | Dimensions |
|---|---|
| A4 portrait (210×297 mm) | 2480 × 3508 px |
| A3 portrait (297×420 mm) | 3508 × 4961 px |
| Square 1:1 | 3000 × 3000 px (treated as 10×10 in at 300 DPI for print) |
| Landscape 16:9 print | 3300 × 1856 px (11×6.2 in) |

(Digital formats — Story 9:16, Square 1080, Landscape 16:9 digital — are PNG targets; DPI irrelevant.)

### Bleed & trim

For PDF:
- Add 3 mm bleed on all sides (AIA print-house default; doc 11).
- Draw trim marks at each corner (optional toggle — default off for AIA internal; on for third-party print).
- `reportlab` supports `canvas.setPageSize` + `BoxInfo` for trim and bleed boxes.

Elements near edges (logo, regulatory text) must be set back from trim at least 5 mm. The composition prompt already biases for this via "margin breathing room"; verify in preview before export.

---

## Font Embedding

For PDF export only. Brand kit fonts must be embedded so print houses render them correctly.

Flow:
1. Brand kit fonts are stored as font files (TTF/OTF) in object storage.
2. Export pulls the fonts, passes them to `reportlab.pdfbase.pdfmetrics.registerFont(TTFont(...))`.
3. Any text in the PDF uses embedded fonts; the output embeds the glyphs used (subsetted).

If no brand kit is configured, fall back to bundled Inter / DM Sans fonts in `backend/app/assets/fonts/`.

Custom font upload by users is out of scope for v1 (doc 11).

---

## Overlays (post-Gemini composite)

Doc 04 established that the raw Gemini image is preserved untouched; logo/tagline/disclaimer are overlaid post-generation. In the export path:

- Logo: top-right per existing convention, sized 12% of shortest edge.
- Brand tagline: below logo in brand kit font.
- Regulatory disclaimer: bottom strip, smallest legible size (8pt at 300 DPI = ~33 px in the raster). Always present if `content.copy.regulatory_disclaimer` is non-empty (PRD §12.4).
- Optional watermark: applied only on low-tier free exports. For AIA staff / FSC, watermarking off.

The overlay step runs **before** CMYK conversion, so text colours can be computed in sRGB and then translated cleanly.

---

## 2× Upscale

`POST /api/ai/poster/upscale` (new endpoint):
- Input: `variant_id`.
- Output: new upscaled image URL, stored alongside the original.
- Counts under the cost quota but not against the turn limit (PRD §9.6).

For PDF export: if the user has not explicitly upscaled, the export service may auto-upscale for print quality (see DPI section above). Emit a telemetry event when auto-upscale is triggered so cost is attributable.

---

## Storage & URLs

Existing `uploads/` convention:
- Raw variants: `poster-variants/{artifact_id}/{variant_id}.png`
- Upscaled variants: `poster-variants/{artifact_id}/{variant_id}@2x.png`
- Exported assets: `exports/{artifact_id}/{export_id}.{ext}`
- Masks: `poster-masks/{artifact_id}/{turn_id}.png` (doc 04)

Download URLs are signed, short-TTL (10 min) signed URLs for authenticated download. Public URLs are never exposed.

---

## Compliance Gating at Export (continued)

Per doc 08:
- Score < 70: hard block.
- Score ≥ 70 with unresolved flags: soft warning modal.
- All exports log the flag snapshot into `export_logs` for audit.

If BRAND_ADMIN override lands in v1 (doc 11), it is a force-export flag on the request that bypasses the hard block but still records the snapshot and emits a high-priority telemetry event.

---

## Background Task Lifecycle

Exports run as FastAPI `BackgroundTasks` (existing pattern). `ExportLog.status` transitions:
- `PENDING` → `PROCESSING` → `READY` or `FAILED`.

Client polls `GET /api/artifacts/{id}/exports/{export_id}` every 2 seconds until `READY`. On `READY`, a signed download URL is returned.

For larger PDFs (> 50 MB), consider multipart upload to the store; Pillow + reportlab outputs rarely exceed 20 MB at A3 CMYK, so multipart is optional.

---

## Observability

Per export:
- `export_requested` (format, artifact_id)
- `export_completed` (format, duration_ms, size_bytes)
- `export_failed` (format, error_code)
- `export_auto_upscaled` (artifact_id)
- `export_gated_low_score` (score)

PRD §14.1 target: PDF export < 20 s. Upscale counted separately.

---

## Testing

Unit:
- `convert_to_cmyk` idempotent on CMYK input, correct on RGB input, ICC profile loaded.
- `assemble_print_pdf` produces a PDF with trim/bleed boxes at correct offsets (parse with `pypdf`).
- Font embedding subset contains the glyphs used in sample text.

Integration:
- End-to-end PNG export happy path.
- End-to-end PDF export produces a file validatable by a PDF linter (e.g., `pdfminer.six` checks for expected metadata).
- Compliance score < 70 blocks export.

Load:
- Concurrent 10 exports stay under the 20 s p95 budget.

---

## Cross-references

- Existing render + overlay code → `render_service.py`.
- Variant sources → doc 04.
- Compliance gating contract → doc 08.
- Artifact content consumed at export → doc 01.
- Export audit trail → doc 08 §Audit Trail.

*Continue to `10-testing-strategy.md`.*
