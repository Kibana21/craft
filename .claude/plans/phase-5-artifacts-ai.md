# Phase 5: Artifact Creation + AI Generation

**Goal:** Poster, WhatsApp card, and reel creation with Imagen 3 image gen, Gemini taglines, and photo compositing.

**User stories:** US-011 (poster), US-012 (WhatsApp card), US-013 (reel), US-014 (taglines), US-015 (Imagen 3), US-021 (photo compositing), US-024 (Quick Create)

**Dependencies:** Phase 3 (projects, artifact model). Phase 4 recommended for remix locks.

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/artifacts.py` (extend) | `POST /api/projects/{id}/artifacts` (create), `GET /api/artifacts/{id}` (detail), `PATCH /api/artifacts/{id}` (update content), `DELETE /api/artifacts/{id}` (soft delete) |
| `backend/app/api/ai.py` | `POST /api/ai/generate-image` (Imagen 3), `POST /api/ai/generate-taglines` (Gemini), `POST /api/ai/generate-storyboard` (Gemini for reel frames) |
| `backend/app/api/uploads.py` | `POST /api/uploads/photo` — upload headshot, crop/resize, store in S3. `POST /api/uploads/asset` — generic asset upload. |
| `backend/app/schemas/artifact.py` (extend) | `CreateArtifactRequest(type, name, content)`, `UpdateArtifactRequest(name?, content?)`, `ArtifactDetailResponse(id, project_id, creator, type, name, content, thumbnail_url, compliance_score, compliance_details, status, locks, created_at)` |
| `backend/app/schemas/ai.py` | `GenerateImageRequest(prompt_context, artifact_type, tone, style, aspect_ratio)`, `GenerateImageResponse(image_url, prompt_used)`, `GenerateTaglinesRequest(product, audience, tone, count)`, `GenerateTaglinesResponse(taglines: list[str])`, `GenerateStoryboardRequest(topic, key_message, product, tone)`, `GenerateStoryboardResponse(frames: list[StoryboardFrame])` |
| `backend/app/schemas/upload.py` | `UploadResponse(url, filename, content_type)` |
| `backend/app/services/artifact_service.py` (extend) | `create_artifact(user, project_id, data)` — validates membership, creates artifact, triggers async compliance scoring. `update_artifact(user, artifact_id, data)` — validates access, updates, re-triggers scoring. |
| `backend/app/services/ai_service.py` | `generate_image(prompt_context, artifact_type, brand_kit, aspect_ratio)` — constructs Imagen 3 prompt, calls API, stores in S3, returns URL. `generate_taglines(product, audience, tone, count)` — calls Gemini. `generate_storyboard(topic, key_message, product, tone, brand_kit)` — calls Gemini for structured frame sequence. |
| `backend/app/services/image_service.py` | `composite_headshot(background_url, headshot_url, region, user_name)` — Pillow compositing. `resize_for_format(image_url, aspect_ratio)` — 1:1, 4:5, 9:16 variants. `generate_thumbnail(image_url)` — small preview. |
| `backend/app/services/upload_service.py` | `upload_to_s3(file, path)` — uploads to S3/R2, returns URL. `process_headshot(file)` — crop to square, resize to 400x400. |
| `backend/app/services/prompt_builder.py` | `build_image_prompt(brief, brand_kit, artifact_type, tone, aspect_ratio)` — detailed Imagen 3 prompt from project brief + brand kit constraints. Includes negative prompts (no competitor logos, etc.). |
| `backend/app/core/s3.py` | S3 client configuration, `get_s3_client()` dependency |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/new/page.tsx` | Type selector (if not pre-selected), renders type-specific creation form |
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/page.tsx` | Artifact editor/viewer: preview, editable fields (respecting locks), compliance score, export button |
| `frontend/src/components/artifacts/create/poster-creator.tsx` | Headline input + "Generate taglines" button, product, audience, tone selector, photo upload, aspect ratio (1:1, 4:5, 9:16). "Generate" calls image API. Shows preview. |
| `frontend/src/components/artifacts/create/whatsapp-creator.tsx` | Message text + AI assist, product, photo upload. Generates 800x800 card. |
| `frontend/src/components/artifacts/create/reel-creator.tsx` | Topic, key message, product, tone, photo. Generates storyboard. Shows frame-by-frame preview. |
| `frontend/src/components/artifacts/preview/artifact-preview.tsx` | Universal preview: poster as image, WA card as image, reel as animated frames |
| `frontend/src/components/artifacts/preview/reel-preview.tsx` | Animated storyboard: auto-plays through frames with transitions |
| `frontend/src/components/artifacts/editor/artifact-editor.tsx` | Edit mode for content: tagline, message, tone. Respects `locks` field from remixed content (disabled fields). |
| `frontend/src/components/artifacts/tagline-generator.tsx` | "Generate taglines" panel: button → 5 options as selectable chips, pick or write custom. FSCs see approved taglines first. |
| `frontend/src/components/artifacts/photo-upload.tsx` | Upload with preview, crop indicator. Can use profile photo or per-artifact upload. |
| `frontend/src/components/artifacts/tone-selector.tsx` | Professional, Friendly, Urgent, Inspirational, Festive |
| `frontend/src/components/artifacts/format-selector.tsx` | 1:1 (Instagram square), 4:5 (feed), 9:16 (story/reel). Visual preview of each. |
| `frontend/src/components/artifacts/compliance-badge.tsx` | Score badge: green >= 90%, amber 70-89%, red < 70%. Clickable for breakdown. |
| `frontend/src/components/ui/skeleton.tsx` | shadcn Skeleton for AI generation loading |
| `frontend/src/components/ui/progress.tsx` | shadcn Progress bar |
| `frontend/src/lib/api/ai.ts` | `generateImage(params)`, `generateTaglines(params)`, `generateStoryboard(params)` |
| `frontend/src/lib/api/uploads.ts` | `uploadPhoto(file)`, `uploadAsset(file)` |
| `frontend/src/lib/api/artifacts.ts` (extend) | `createArtifact(projectId, data)`, `updateArtifact(id, data)`, `fetchArtifactDetail(id)` |
| `frontend/src/types/ai.ts` | `GenerateImageRequest`, `GenerateImageResponse`, `GenerateTaglinesRequest`, `StoryboardFrame` types |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/projects/{id}/artifacts` | Member | Create artifact in project |
| GET | `/api/artifacts/{id}` | Member/Admin | Get artifact detail |
| PATCH | `/api/artifacts/{id}` | Creator/Admin | Update artifact content |
| DELETE | `/api/artifacts/{id}` | Creator/Admin | Soft delete |
| POST | `/api/ai/generate-image` | Any | Imagen 3 generation |
| POST | `/api/ai/generate-taglines` | Any | Gemini taglines |
| POST | `/api/ai/generate-storyboard` | Any | Gemini reel storyboard |
| POST | `/api/uploads/photo` | Any | Upload headshot |
| POST | `/api/uploads/asset` | Any | Upload generic asset |

## Quick Create flow (US-024)

Frontend-only orchestration — no special backend endpoint:
1. FSC taps format button on home screen (e.g., "Poster")
2. Frontend calls `POST /api/projects` with type=personal, auto-name ("Quick poster — Apr 2026"), default brief
3. Redirects to `/projects/{new_id}/artifacts/new?type=poster`
4. User can edit brief later from project detail

## Artifact content JSON structures

**Poster:**
```json
{
  "headline": "Secure your family's future with PAA",
  "product": "PAA",
  "tone": "professional",
  "image_url": "s3://craft-assets/generated/abc123.png",
  "headshot_url": "s3://craft-assets/photos/maya-chen.jpg",
  "formats": {
    "1:1": "s3://craft-assets/renders/abc123-1x1.png",
    "4:5": "s3://craft-assets/renders/abc123-4x5.png",
    "9:16": "s3://craft-assets/renders/abc123-9x16.png"
  },
  "locks": ["brand_colors", "logo_position", "disclaimer"]
}
```

**Reel storyboard (from Gemini):**
```json
{
  "frames": [
    { "frame_number": 1, "duration_seconds": 4, "text_overlay": "Did you know...", "visual_description": "Young family at park", "transition": "fade" },
    { "frame_number": 2, "duration_seconds": 5, "text_overlay": "PAA protects what matters", "visual_description": "Shield icon over family", "transition": "slide_left" }
  ]
}
```

## Imagen 3 prompt construction example

```
Create a professional insurance marketing poster for AIA Singapore.
Product: PRUActive Aspire. Target: Young parents aged 25-35.
Tone: Warm and reassuring. Style: Modern minimal.
Must use brand colors: red #D0103A as accent, dark background #1A1A18.
Include space for logo placement top-right.
Do not include any text — text will be overlaid separately.
Aspect ratio: 1:1 square.
Do not include competitor logos or branding.
```

## Key implementation details

- Photo compositing: Imagen 3 generates background, Pillow composites headshot into a designated region (e.g., bottom-left quarter circle), renders name text alongside.
- AI endpoints should include rate limiting: simple in-memory counter per user per hour for MVP; Redis-backed in production.
- Compliance scoring triggers asynchronously via `BackgroundTasks` — artifact saved with `compliance_score=None` initially ("Scoring..." state).
- Reel: Gemini produces structured JSON storyboard (5-8 frames). Frontend previews as animated sequence. Actual MP4 rendering via ffmpeg happens at export (Phase 7).

## Verification

- Create a poster artifact in a project → AI generates image → preview shown
- Generate taglines → 5 options appear → select one → updates headline
- Upload headshot → composited into generated image
- Create WhatsApp card → 800x800 preview
- Create reel → storyboard frames appear as animated preview
- Quick Create from home screen → auto-creates project → opens artifact creation
- Compliance score appears (or "Scoring..." then updates)
- `npm run typecheck` passes
- `pytest` passes
