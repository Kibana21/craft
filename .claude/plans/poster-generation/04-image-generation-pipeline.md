# 04 — Image Generation Pipeline

The image pipeline is the highest-latency and highest-cost surface in the wizard. This doc specifies how the 4-variant parallel flow, text-vs-image mode branching, region edits ("inpainting"), and reference-image handling all fit together.

All image generation calls go to the Gemini image model — `gemini-2.5-flash-image` (a.k.a. "Nano Banana"), documented at https://ai.google.dev/gemini-api/docs/image-generation — via the `google-genai` SDK (already in `backend/requirements.txt`). The same SDK and credentials already used for Gemini text generation are reused, so there is no second vendor integration.

## Current State

`backend/app/services/ai_service.py` currently has:
- `generate_image(prompt: str) -> ImageResult` — a single serial text-to-image call wired to the legacy Imagen path.
- `generate_storyboard(...)` — scene-by-scene serial generation for reels (sequential, not parallel).

No parallel execution, no image-to-image mode, no region-edit flow. Timeouts are per-call and not tuned for poster latency budgets. Poster Wizard migrates this module to `gemini-2.5-flash-image` as part of Phase C.

## Target Architecture

Introduce a new service module `backend/app/services/poster_image_service.py` that owns:
- The 4-variant parallel orchestration.
- Text-to-image vs image-editing branching (driven by subject type).
- Region-edit flow (mask-guided prompt editing).
- Reference-image lifecycle (in concert with the upload endpoint in doc 02).

`ai_service.py` stays as the **low-level Gemini wrapper** — one function `generate_image_gemini(prompt, input_images=[], config=...)` that calls `client.models.generate_content(model="gemini-2.5-flash-image", contents=[...])` and returns the first `inline_data` image part. `poster_image_service.py` is the **high-level orchestrator**. The wizard's API routes (`backend/app/api/ai.py`) call the orchestrator.

### SDK call shape (reference)

```python
from google import genai
from google.genai import types

client = genai.Client()  # uses GOOGLE_API_KEY / ADC

async def generate_image_gemini(
    prompt: str,
    input_images: list[bytes] | None = None,
) -> bytes:
    parts: list = [prompt]
    if input_images:
        for raw in input_images:
            parts.append(types.Part.from_bytes(data=raw, mime_type="image/png"))
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=parts,
    )
    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None):
            return part.inline_data.data
    raise GeminiImageError("no image part in response")
```

Exact kwargs follow the documented SDK — see https://ai.google.dev/gemini-api/docs/image-generation — and the helper centralises retry, timeout, and telemetry.

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
    seed_phrases = [
        "soft natural lighting, understated composition",
        "bold directional lighting, confident composition",
        "warm golden-hour lighting, cinematic framing",
        "cool editorial lighting, minimal composition",
    ][:count]
    tasks = [
        _single_variant(merged_prompt, subject_type, reference_images, seed, format, slot=i)
        for i, seed in enumerate(seed_phrases)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return _assemble_variant_set(results)
```

**Why per-slot seed phrases instead of temperature:** `gemini-2.5-flash-image` does not expose a continuous `temperature` knob in the same form as the text models; per-variant aesthetic diversity comes from appending a short style-direction phrase to each slot's prompt. The phrases are tuned to produce visually distinct outputs without changing the underlying subject/composition.

**Why gather and not a task queue for v1:**
- One HTTP request → one response matches the client model (client waits for all 4).
- `gemini-2.5-flash-image` latencies are typically 10–25s per call; 4 in parallel completes well within the 45s PRD budget (§14.1).
- Operational simplicity: no queue infrastructure to run, no workers to scale separately.
- Revisit if p95 exceeds budget or if we later support async notifications.

**Worker-pool sizing note:** FastAPI runs on uvicorn with default worker count; each request holds a worker for the full generation duration (up to 60s). Provision at least `ceil(peak_qps × avg_latency_s)` workers. For v1, start with 8 uvicorn workers in prod and monitor.

### Per-variant timeout + partial-failure UX

Each variant task wraps its Gemini call in `asyncio.wait_for(..., timeout=60)`. On timeout or exception, that slot's result is a `FailedVariant` with an error code. `gather(return_exceptions=True)` ensures one failure does not cancel the others.

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

## Text-to-Image vs Image-Editing Branching

`gemini-2.5-flash-image` handles text-to-image and image editing through the **same endpoint** — the only difference is whether input images are included in `contents`. Subject type drives the mode:

| Subject Type | Gemini mode | `contents` payload |
|---|---|---|
| HUMAN_MODEL | Text-to-image | `[merged_prompt]` |
| PRODUCT_ASSET | **Image editing** | `[merged_prompt, reference_image_bytes, ...]` |
| SCENE_ABSTRACT | Text-to-image | `[merged_prompt]` |

For `PRODUCT_ASSET`:
- If 1 reference image: pass it alongside the prompt. The prompt instructs the model to use it as the primary product element (phrased per https://ai.google.dev/gemini-api/docs/image-generation#image_editing_text_and_images_to_image).
- If >1: Gemini natively supports multi-image composition. Pass all reference images; the prompt instructs how each should be used (e.g., "Use the first image as the hero product. The second and third images provide brand texture and colour direction only."). This is a behaviour improvement over the previous Imagen-era first-only constraint — see doc 11 OQ-14 for the resolved position.
- Background treatment (`REPLACE | EXTEND | KEEP_ORIGINAL | ABSTRACT_BLEND`) is already encoded in the merged prompt; the service does not need to translate it.

Aspect ratio and output resolution are controlled via prompt phrasing per the Gemini image-generation docs (e.g., "portrait 4:5", "square 1:1", "1024×1792 pixels"). The composition assembler (doc 03) injects the format directive deterministically.

---

## Region Edits ("Inpainting")

Unlike the legacy Imagen path, `gemini-2.5-flash-image` has no dedicated mask-based inpainting endpoint. Region edits are performed via **mask-guided prompt editing**: pass the current image + a mask visualisation + a focused textual instruction. Gemini reads both images and applies the change inside the masked region.

`POST /api/ai/poster/inpaint` (doc 02, §10) orchestrates this.

### Flow

1. Client sends multipart: current variant image URL (implicit in `variant_id`), mask PNG (alpha channel = region to regenerate), description, original merged prompt.
2. Service fetches the current image.
3. Service builds a mask visualisation — a side-image that is the current image overlaid with a semi-transparent red fill on the masked region, so Gemini can visually localise the edit zone. (Binary masks alone are harder for the model to interpret than a visible overlay.)
4. Service builds a focused prompt:
   ```
   Maintain the overall composition and style of this image.
   Edit ONLY the area shown highlighted in red in the second image provided;
   leave every other pixel unchanged.
   In that area: {description}.
   Style anchor: {original_merged_prompt's style sentence}
   ```
5. Call `gemini-2.5-flash-image` with `contents = [prompt, current_image_bytes, mask_overlay_bytes]`.
6. Store the new image, create a `poster_chat_turns` row with `action_type=INPAINT` and `inpaint_mask_url` pointing to the original mask (mask retained 30 days with chat turn).
7. Return new image URL.

### Turn counting

Region edits count as a turn (PRD §9.7, §12.5). The 6-turn cap covers chat refinements AND region edits combined.

### Mask constraints

- Mask must be same dimensions as the current image (server validates).
- Mask alpha: 0 = keep, 255 = regenerate. Intermediate values are supported for soft edges — the red-fill overlay uses the alpha as opacity so Gemini sees feathered regions too.
- Maximum mask coverage: 60% of the image area. Over this, redirect the user to "regenerate" instead (region too large to behave reliably with prompt-driven editing). This rule is explicitly called out in the UI (doc 07).

### Known limitation — pixel-perfect preservation

Prompt-driven editing does not *guarantee* zero drift outside the masked region the way a classical inpainting model with a binary mask can. Gemini may subtly recompose surrounding pixels. Two mitigations:
1. **Server-side composite fallback:** after the Gemini edit returns, composite the original image's unmasked pixels over the Gemini output using the user's binary mask, so the unmasked region is pixel-identical to the source. Simple `PIL.Image.composite(original, edited, mask)`.
2. Surface an inline tip in the UI: "Small tweaks outside the selected area may occur. Use Save as variant before large edits."

Mitigation 1 is the default for v1 and is applied unconditionally — the returned URL points to the composited image.

---

## Reference Image Lifecycle

### Upload (Phase C)

`POST /api/uploads/reference-image-temp` — writes to `poster_reference_images` table (doc 01) with `expires_at = now() + 24h`.

Storage: existing S3/R2 wiring (`backend/app/services/upload_service.py`). Use a dedicated prefix `poster-ref-temp/` so lifecycle policies can be applied at the bucket level as a secondary safety net.

### Serving to Gemini

`gemini-2.5-flash-image` accepts inline image bytes via `types.Part.from_bytes(data=..., mime_type=...)` in `contents`. For session-temp images we fetch the bytes from storage (or signed URL) and inline them into the request payload. Per Google's docs the payload size per image should stay modest (≤ 7 MB encoded is a safe envelope); we downscale client-provided reference images to a max longest edge of 1536 px before inlining. The original is preserved in storage; only the inlined copy is downscaled.

Downscaling is done with Pillow's `Image.thumbnail((1536, 1536), Image.LANCZOS)` in the service.

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

Gemini image failures fall into two categories:
1. **Transient** (5xx, timeout, rate limit from the Gemini endpoint) → retry with exponential backoff (250ms, 500ms, 1s). Max 2 retries per variant slot.
2. **Terminal** (4xx, safety/policy rejection, bad prompt) → fail the slot immediately with a specific error code so the UI can surface a helpful message.

Safety-filter rejection is a real concern (e.g., health/wellness claims that trip Gemini's safety filters). When the response has no `inline_data` part and carries a `finish_reason` such as `SAFETY` or `PROHIBITED_CONTENT`, the slot fails with `error_code = "AI_CONTENT_POLICY"` with a short hint ("Try less direct phrasing"). UI rewrites this as a user-friendly tip.

The service also validates that the response actually contains an image part — `gemini-2.5-flash-image` can occasionally return text-only when the prompt leads it to refuse or describe. This is treated as `AI_UPSTREAM_ERROR` with the model's text echoed into structured logs (not the user message) for debugging.

---

## Cost & Latency Budget

| Op | p50 target | p95 target |
|---|---|---|
| Single Gemini text-to-image | 12s | 25s |
| Single Gemini image-editing (with 1–3 reference images) | 15s | 35s |
| 4-variant gather (text-to-image) | 18s | 35s |
| 4-variant gather (image-editing) | 22s | 45s |
| Region edit | 12s | 25s |
| Upscale 2× (see below) | 8s | 20s |

These targets are tighter than the Imagen-era targets because `gemini-2.5-flash-image` is positioned as a fast model. Verify empirically before committing them as SLOs — update this table after Phase C load tests.

Observability: emit `variant_generation_duration_ms` per slot to existing metrics pipeline. Alert when p95 breaches target for 3 consecutive 5-minute windows.

**Per-project daily cap:** 100 variants/project/day at v1 (doc 11 for final). Enforced via Redis counter. When exceeded, endpoint returns `error_code = "PROJECT_QUOTA_EXCEEDED"` with a readable message.

---

## Upscale (2×)

`gemini-2.5-flash-image` does not expose a dedicated upscale endpoint. Two strategies:

1. **Prompt-driven re-render at higher resolution.** Send the current image back into the model with a prompt like "Render this exact composition at twice the resolution, preserving every element; increase fine detail." Quality is acceptable but not pixel-identical to the source. Counts as one image generation request toward the per-project cap.
2. **Pillow Lanczos fallback.** Pure `img.resize((w*2, h*2), Image.LANCZOS)`. Lower perceptual quality but free and deterministic.

v1 default: try strategy 1; if it fails or returns an image that drifts from the source beyond a similarity threshold (compute a downscaled pHash of input vs output and compare), fall back to strategy 2. Route this through `poster_image_service.upscale_variant(variant_id)`.

Does not count against the chat turn limit. Does count toward the per-project daily variant cap when strategy 1 runs.

See doc 11 OQ-18 for the resolved Gemini-based upscale decision (supersedes the prior "Imagen 3 upscale" assumption).

---

## Compositing Brand Logo (post-generation)

`gemini-2.5-flash-image` can render approximations of brand logos but cannot reliably render exact marks. Current render pipeline (`render_service.py`) overlays the logo post-generation using Pillow. Poster Wizard continues this approach:

1. Gemini produces the base image.
2. On export (or when the user toggles "Show brand overlay"), `render_service` overlays: logo (brand kit), tagline, regulatory disclaimer, optional watermark.
3. The variant stored in S3 is the **raw Gemini output**. The branded composite is produced on export or live preview.

This separation means users can toggle the brand overlay off/on in preview without regenerating.

---

## Cross-references

- Endpoint contracts for `generate-variants`, `inpaint`, `retry` → doc 02.
- Prompt templates the Gemini image model receives → doc 03.
- Frontend chat integration with region-edit trigger → doc 07.
- Render service overlay wiring → doc 09.

*Continue to `05-frontend-wizard-architecture.md`.*
