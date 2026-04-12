# 04 — Image Generation Pipeline

The image pipeline is the highest-latency and highest-cost surface in the wizard. This doc specifies how the 4-variant parallel flow, text-vs-image mode branching, inpainting, and reference-image handling all fit together.

## Current State

`backend/app/services/ai_service.py` currently has:
- `generate_image(prompt: str) -> ImageResult` — single serial Imagen text-to-image call.
- `generate_storyboard(...)` — scene-by-scene serial generation for reels (sequential, not parallel).

No parallel execution, no image-to-image mode, no inpainting. Timeouts are per-call and not tuned for poster latency budgets.

## Target Architecture

Introduce a new service module `backend/app/services/poster_image_service.py` that owns:
- The 4-variant parallel orchestration.
- Text-to-image vs image-to-image branching.
- Inpainting.
- Reference-image lifecycle (in concert with the upload endpoint in doc 02).

`ai_service.py` stays as the **low-level Imagen wrapper**. `poster_image_service.py` is the **high-level orchestrator**. The wizard's API routes (`backend/app/api/ai.py`) call the orchestrator.

---

## 4-Variant Parallel Flow

### Strategy: `asyncio.gather` for v1

```python
async def generate_variants(
    merged_prompt: str,
    subject_type: SubjectType,
    reference_images: list[ReferenceImage],
    count: int = 4,
    format: Format,
) -> VariantSet:
    temperatures = [0.5, 0.65, 0.8, 0.9][:count]   # diversity
    tasks = [
        _single_variant(merged_prompt, subject_type, reference_images, t, format, slot=i)
        for i, t in enumerate(temperatures)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return _assemble_variant_set(results)
```

**Why gather and not a task queue for v1:**
- One HTTP request → one response matches the client model (client waits for all 4).
- Imagen latencies are typically 15–30s per call; 4 in parallel completes well within the 45s PRD budget (§14.1).
- Operational simplicity: no queue infrastructure to run, no workers to scale separately.
- Revisit if p95 exceeds budget or if we later support async notifications.

**Worker-pool sizing note:** FastAPI runs on uvicorn with default worker count; each request holds a worker for the full generation duration (up to 60s). Provision at least `ceil(peak_qps × avg_latency_s)` workers. For v1, start with 8 uvicorn workers in prod and monitor.

### Per-variant timeout + partial-failure UX

Each variant task wraps its Imagen call in `asyncio.wait_for(..., timeout=60)`. On timeout or exception, that slot's result is a `FailedVariant` with an error code. `gather(return_exceptions=True)` ensures one failure does not cancel the others.

Client receives mixed results:
```json
{
  "job_id": "…",
  "partial_failure": true,
  "variants": [
    { "slot": 0, "status": "READY", "image_url": "…" },
    { "slot": 1, "status": "FAILED", "error_code": "AI_TIMEOUT", "retry_token": "…" },
    { "slot": 2, "status": "READY", "image_url": "…" },
    { "slot": 3, "status": "READY", "image_url": "…" }
  ]
}
```

Client UI (doc 07) renders 3 real thumbnails + 1 retry tile.

### Retry

A retry endpoint `POST /api/ai/poster/generate-variants/retry` takes the `job_id` + `slot` + `retry_token` and re-runs just that slot. Token is a short-TTL signed blob to prevent abuse.

### One active job per session

PRD §12.2. Enforce server-side: on new generation request, look up `artifacts.content.generation.last_generation_job_id`; if a job is live, cancel it (set status to CANCELLED, ignore its eventual results). Canceled jobs' outputs are not stored.

---

## Text-to-Image vs Image-to-Image Branching

Subject type drives the Imagen mode:

| Subject Type | Imagen Mode | Inputs |
|---|---|---|
| HUMAN_MODEL | Text-to-image | `merged_prompt` only |
| PRODUCT_ASSET | **Image-to-image** | `merged_prompt` + reference image(s) |
| SCENE_ABSTRACT | Text-to-image | `merged_prompt` only |

For `PRODUCT_ASSET`:
- If 1 reference image: use it as base, condition strength 0.6–0.8 per variant.
- If >1: pick the first one as base for v1 (collage/blend requested in PRD is deferred to v2). Document this in doc 11.
- Background treatment (`REPLACE | EXTEND | KEEP_ORIGINAL | ABSTRACT_BLEND`) is already encoded in the merged prompt; the service does not need to translate it.

---

## Inpainting

`POST /api/ai/poster/inpaint` (doc 02, §10).

### Flow

1. Client sends multipart: current variant image URL (implicit in `variant_id`), mask PNG (alpha channel = region to regenerate), description, original merged prompt.
2. Service fetches the current image.
3. Service builds a focused prompt:
   ```
   Maintain the overall composition and style of this image.
   In the masked area only, {description}.
   Preserve everything outside the mask.
   Style anchor: {original_merged_prompt's style sentence}
   ```
4. Call Imagen inpainting endpoint (editing mode / masked generation — Imagen supports it via Vertex AI's `edit_image` API).
5. Store the new image, create a `poster_chat_turns` row with `action_type=INPAINT` and `inpaint_mask_url` pointing to the mask (mask retained 30 days with chat turn).
6. Return new image URL.

### Turn counting

Inpainting counts as a turn (PRD §9.7, §12.5). The 6-turn cap covers chat refinements AND inpaints combined.

### Mask constraints

- Mask must be same dimensions as the current image (server validates).
- Mask alpha: 0 = keep, 255 = regenerate. Intermediate values are supported for soft edges.
- Maximum mask coverage: 60% of the image area. Over this, redirect the user to "regenerate" instead (region too large for inpainting to behave reliably). This rule is explicitly called out in the UI (doc 07).

---

## Reference Image Lifecycle

### Upload (Phase C)

`POST /api/uploads/reference-image-temp` — writes to `poster_reference_images` table (doc 01) with `expires_at = now() + 24h`.

Storage: existing S3/R2 wiring (`backend/app/services/upload_service.py`). Use a dedicated prefix `poster-ref-temp/` so lifecycle policies can be applied at the bucket level as a secondary safety net.

### Serving to Imagen

The Imagen API accepts public URLs or base64 bytes. For session-temp images we prefer **signed URLs with short TTL** (15 min) over base64 — cheaper payload, same effect. Signing uses existing S3/R2 signing helpers.

### Sweep job

`sweep_expired_reference_images` (doc 01) runs hourly:
```sql
SELECT id, storage_url FROM poster_reference_images
WHERE expires_at < now() AND deleted_at IS NULL
LIMIT 100
```
Deletes the S3 object, then soft-deletes the row. Batch size 100 prevents runaway memory if backlog builds up.

### Secondary safety net

Configure the bucket's lifecycle policy to delete the `poster-ref-temp/` prefix after 48h. If the sweep job fails silently, objects still don't persist indefinitely.

---

## Retries & Backoff

Imagen failures fall into two categories:
1. **Transient** (5xx, timeout, rate limit from Vertex) → retry with exponential backoff (250ms, 500ms, 1s). Max 2 retries per variant slot.
2. **Terminal** (4xx, content-policy rejection, bad prompt) → fail the slot immediately with a specific error code so the UI can surface a helpful message.

Content-policy rejection on Imagen is a real concern (e.g., health/wellness claims that trip Gemini/Imagen safety filters). If rejected, the response `error_code = "AI_CONTENT_POLICY"` with a short hint ("Try less direct phrasing"). UI rewrites this as a user-friendly tip.

---

## Cost & Latency Budget

| Op | p50 target | p95 target |
|---|---|---|
| Single Imagen text-to-image | 18s | 35s |
| Single Imagen image-to-image | 22s | 45s |
| 4-variant gather (text-to-image) | 22s | 45s |
| 4-variant gather (image-to-image) | 28s | 55s |
| Inpaint | 15s | 30s |
| Upscale 2× | 20s | 35s |

Observability: emit `variant_generation_duration_ms` per slot to existing metrics pipeline. Alert when p95 breaches target for 3 consecutive 5-minute windows.

**Per-project daily cap:** 100 variants/project/day at v1 (doc 11 for final). Enforced via Redis counter. When exceeded, endpoint returns `error_code = "PROJECT_QUOTA_EXCEEDED"` with a readable message.

---

## Upscale (2×)

Post-generation, the user can click "2× upscale" on the selected variant (PRD §9.2). Imagen 3 has upscaling support; if not accessible, fall back to Pillow's Lanczos resample (lower quality, but a placeholder). Route this through `poster_image_service.upscale_variant(variant_id)`.

Does not count against the turn limit.

---

## Compositing Brand Logo (post-generation)

Imagen cannot reliably render exact brand logos. Current render pipeline (`render_service.py`) overlays the logo post-generation using Pillow. Poster Wizard continues this approach:

1. Imagen produces the base image.
2. On export (or when the user toggles "Show brand overlay"), `render_service` overlays: logo (brand kit), tagline, regulatory disclaimer, optional watermark.
3. The variant stored in S3 is the **raw Imagen output**. The branded composite is produced on export or live preview.

This separation means users can toggle the brand overlay off/on in preview without regenerating.

---

## Cross-references

- Endpoint contracts for `generate-variants`, `inpaint`, `retry` → doc 02.
- Prompt templates Imagen receives → doc 03.
- Frontend chat integration with inpainting trigger → doc 07.
- Render service overlay wiring → doc 09.

*Continue to `05-frontend-wizard-architecture.md`.*
