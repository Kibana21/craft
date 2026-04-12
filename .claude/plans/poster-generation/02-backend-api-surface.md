# 02 — Backend API Surface

Every new endpoint introduced by Poster Wizard. All sit under `/api/` per existing repo convention.

## Endpoint Inventory

| # | Method & Path | Auth | Rate Limit | Phase |
|---|---|---|---|---|
| 1 | `POST /api/ai/poster/generate-brief` | `get_current_user` | 20/min/user | B |
| 2 | `POST /api/ai/poster/generate-appearance-paragraph` | `get_current_user` | 20/min/user | B |
| 3 | `POST /api/ai/poster/generate-scene-description` | `get_current_user` | 20/min/user | B |
| 4 | `POST /api/ai/poster/copy-draft-all` | `get_current_user` | 15/min/user | B |
| 5 | `POST /api/ai/poster/copy-draft-field` | `get_current_user` | 30/min/user | B |
| 6 | `POST /api/ai/poster/tone-rewrite` | `get_current_user` | 15/min/user | B |
| 7 | `POST /api/ai/poster/generate-composition-prompt` | `get_current_user` | 20/min/user | C |
| 8 | `POST /api/ai/poster/generate-variants` | `get_current_user` | 10/min/user | C |
| 9 | `POST /api/ai/poster/refine-chat` | `get_current_user` | 12/min/user | D |
| 10 | `POST /api/ai/poster/inpaint` | `get_current_user` | 10/min/user | D |
| 11 | `POST /api/ai/poster/classify-structural-change` | `get_current_user` | 30/min/user | D |
| 12 | `POST /api/compliance/check-field` | `get_current_user` | 60/min/user | E |
| 13 | `POST /api/uploads/reference-image-temp` | `get_current_user` | 10/min/user | C |
| 14 | `DELETE /api/uploads/reference-image-temp/{id}` | `get_current_user` (owner) | — | C |
| 15 | `POST /api/artifacts/{id}/save-as-variant` | `get_current_user` (owner) | — | D |

All endpoints share:
- JWT auth via existing `get_current_user` dependency (`backend/app/core/auth.py`).
- RBAC: for anything scoped to an artifact, verify `artifact.creator_id == user.id` OR user has `OWNER`/`MEMBER` row in `project_members` for `artifact.project_id`. Reuse the existing ownership helper; if none exists, extract one into `app/core/rbac.py` as a single source of truth.
- Input validation via Pydantic `v2` models in `app/schemas/poster.py` (new file).
- Structured error envelope matching existing repo convention:
  ```json
  { "detail": "human-readable", "error_code": "MACHINE_READABLE" }
  ```

---

## 1. `POST /api/ai/poster/generate-brief`
Synthesises a brief narrative paragraph from Step 1 fields.

**Request**
```python
class GenerateBriefRequest(BaseModel):
    campaign_objective: CampaignObjective
    target_audience: str = Field(min_length=1, max_length=500)
    tone: Tone
    call_to_action: str = Field(min_length=1, max_length=300)
    existing_brief: str | None = None  # if provided, AI regenerates with awareness
```

**Response**
```python
class GenerateBriefResponse(BaseModel):
    brief: str                 # 60-120 words target
    generation_id: UUID        # for telemetry / accept-tracking
```

**Errors:** `400` invalid enum, `429` rate limited, `502` upstream Gemini failure.

## 2. `POST /api/ai/poster/generate-appearance-paragraph`
Expands Human-Model keywords into a 40–80 word appearance paragraph (PRD §6.3).

**Request**
```python
class AppearanceParagraphRequest(BaseModel):
    appearance_keywords: str
    expression_mood: str
    posture_framing: PostureFraming
    brief_context: str | None = None
```

**Response**
```python
class AppearanceParagraphResponse(BaseModel):
    paragraph: str
    word_count: int
```

## 3. `POST /api/ai/poster/generate-scene-description`
Scene/Abstract subject type (PRD §6.5).

**Request**
```python
class SceneDescriptionRequest(BaseModel):
    visual_style: VisualStyle
    brief_context: str | None = None
    seed_hint: str | None = None   # optional user text
```

**Response:** `{ description: str }`

## 4. `POST /api/ai/poster/copy-draft-all`
Drafts all copy fields in one call (PRD §7.4). Uses structured-output schema in prompt (doc 03).

**Request**
```python
class CopyDraftAllRequest(BaseModel):
    brief: str
    tone: Tone
    campaign_objective: CampaignObjective
    audience: str | None = None
```

**Response**
```python
class CopyDraftAllResponse(BaseModel):
    headline: str
    subheadline: str
    body: str
    cta_text: str
```

## 5. `POST /api/ai/poster/copy-draft-field`
Single-field regenerate (used by per-field AI chips in Step 3).

**Request**
```python
class CopyDraftFieldRequest(BaseModel):
    field: Literal["headline", "subheadline", "body", "cta_text"]
    brief: str
    tone: Tone
    current_values: CopyValues         # sibling field context
```

**Response:** `{ value: str }`

## 6. `POST /api/ai/poster/tone-rewrite`
Rewrites all copy fields in one call (PRD §7.5). Preserves structure; user gets one-level undo client-side.

**Request**
```python
class ToneRewriteRequest(BaseModel):
    rewrite_tone: Literal["SHARPER", "WARMER", "MORE_URGENT", "SHORTER"]
    current_copy: CopyValues
```

**Response:** `{ rewritten: CopyValues }`

## 7. `POST /api/ai/poster/generate-composition-prompt`
**Deterministic** string assembly (not an LLM call) with an optional LLM-polished "style sentence" sub-slot. See doc 03 §Composition Assembler. Despite being deterministic, it lives under `/ai/` for consistency with sibling endpoints and because the style-sentence slot may call Gemini.

**Request**
```python
class CompositionPromptRequest(BaseModel):
    brief: BriefContent
    subject: SubjectContent
    copy: CopyValues
    composition_settings: CompositionSettings   # format, layout, style, palette
```

**Response**
```python
class CompositionPromptResponse(BaseModel):
    merged_prompt: str
    style_sentence: str             # the LLM-polished sub-slot, returned separately for UI highlight
```

## 8. `POST /api/ai/poster/generate-variants`
Fires 4 parallel Imagen calls via `asyncio.gather` (doc 04). Returns when all 4 complete or timeout elapses.

**Request**
```python
class GenerateVariantsRequest(BaseModel):
    artifact_id: UUID
    merged_prompt: str
    subject_type: SubjectType
    reference_image_ids: list[UUID] = []     # required if subject_type = PRODUCT_ASSET
    count: int = 4                            # fixed at 4 for v1 (see doc 11)
    format: Format
```

**Response**
```python
class GenerateVariantsResponse(BaseModel):
    job_id: UUID
    variants: list[Variant]   # each with status READY or FAILED
    partial_failure: bool
```

Timeout per variant: 60s (PRD §9.3). Failed slots return with `status=FAILED` and a `retry_token` the client can post back to `/generate-variants/retry/{slot}` (see §15, below).

## 9. `POST /api/ai/poster/refine-chat`
One refinement turn (PRD §9.5).

**Request**
```python
class RefineChatRequest(BaseModel):
    artifact_id: UUID
    variant_id: UUID
    user_message: str
    change_history: list[ChangeLogEntry]   # full history, reconstructed each call
    original_merged_prompt: str
```

**Response**
```python
class RefineChatResponse(BaseModel):
    turn_id: UUID
    ai_response: str                # human-readable confirmation
    change_description: str         # short pill label for change log
    new_image_url: str | None       # null if action was REDIRECT or TURN_LIMIT_NUDGE
    action_type: Literal["CHAT_REFINE", "REDIRECT", "TURN_LIMIT_NUDGE"]
    redirect_target: Literal["STEP_2_SUBJECT", "STEP_3_COPY", "STEP_4_COMPOSITION"] | None
    turn_index: int                 # 0-based; client uses this to render counter
```

The server is the source of truth for turn counting — it checks the current count for the variant before processing.

## 10. `POST /api/ai/poster/inpaint`
Region edit (PRD §9.7). Mask delivered as a PNG file (multipart) or a base64 JSON field — choose multipart (matches existing upload convention).

**Request (multipart/form-data)**
- `artifact_id`: UUID
- `variant_id`: UUID
- `mask_png`: file (alpha channel = region to regenerate)
- `description`: string
- `original_merged_prompt`: string

**Response**
```python
class InpaintResponse(BaseModel):
    turn_id: UUID
    new_image_url: str
    change_description: str         # e.g. "Region edit: replace background"
```

Counts against the 6-turn limit.

## 11. `POST /api/ai/poster/classify-structural-change`
Cheap intent classifier used by the chat endpoint (also exposed so the client can optionally pre-check before sending). Hybrid keyword + LLM fallback (doc 03).

**Request:** `{ message: str }`
**Response:** `{ is_structural: bool, target: "STEP_2_SUBJECT"|"STEP_3_COPY"|"STEP_4_COMPOSITION"|null, confidence: float }`

## 12. `POST /api/compliance/check-field`
Per-field inline compliance (PRD §11, doc 08).

**Request**
```python
class CheckFieldRequest(BaseModel):
    field: Literal["headline", "subheadline", "body", "cta_text"]
    text: str
    tone_context: Tone
    content_hash: str | None = None   # client-computed for cache lookup
```

**Response**
```python
class CheckFieldResponse(BaseModel):
    flags: list[ComplianceFlag]      # may be empty
    cached: bool
```

Warning-only; never blocks Continue. Caching in doc 08.

## 13. `POST /api/uploads/reference-image-temp`
Session-temp tier (PRD §12.7, doc 01).

**Request (multipart):** `file`, optional `artifact_id`
**Response**
```python
class RefImageUploadResponse(BaseModel):
    id: UUID
    storage_url: str
    expires_at: datetime
```

Server enforces:
- MIME whitelist (PNG/JPG/WEBP)
- 20 MB cap
- Per-artifact cap of 3 (query existing rows)
- Sets `expires_at = now() + 24h`

## 14. `DELETE /api/uploads/reference-image-temp/{id}`
Owner-only deletion; removes row + S3 object.

## 15. `POST /api/artifacts/{id}/save-as-variant`
PRD §9.5 save-as-variant. Snapshots current `generation.variants[selected]` into a new variant entry with `parent_variant_id` lineage and resets `turn_count_on_selected` to 0.

**Request:** `{ variant_id: UUID }` (the one to snapshot)
**Response:** `{ new_variant_id: UUID }`

Not a new artifact — just a new entry in the JSONB `generation.variants[]` array. Uses row-level lock on the artifact to avoid concurrent writes.

---

## Rate Limits

Rate limits are enforced via existing middleware (or introduced under `app/core/rate_limit.py` if absent). Keyed by `user.id` for logged-in endpoints. Limits above are defaults; tune based on observed usage. The cost-heavy endpoints (variants generation, inpaint) are capped tightest.

**Per-project cap:** in addition to per-user, a per-project ceiling on image generation per day (e.g., 100 variants) prevents runaway spend. Final number is in doc 11.

---

## Error Envelope Catalog

Standardised `error_code` values for client handling:

| Code | Meaning |
|---|---|
| `AUTH_REQUIRED` | No/invalid JWT |
| `RBAC_DENIED` | User has no access to artifact/project |
| `RATE_LIMITED` | User exceeded endpoint rate limit |
| `AI_UPSTREAM_ERROR` | Gemini/Imagen returned error |
| `AI_TIMEOUT` | Upstream exceeded per-call timeout |
| `VALIDATION_ERROR` | Pydantic validation failed |
| `TURN_LIMIT_REACHED` | 6 turns already used on this variant |
| `SUBJECT_LOCKED` | Attempt to modify locked subject |
| `STALE_PROMPT` | Continue from Step 4 blocked; copy changed |
| `REFERENCE_LIMIT_EXCEEDED` | More than 3 temp images for artifact |
| `FILE_TOO_LARGE` | > 20 MB upload |

---

## Authentication & Ownership Helpers

All artifact-scoped endpoints use one helper (new or existing, verify during implementation):

```python
async def require_artifact_access(
    artifact_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Artifact:
    ...
```

This helper returns the artifact or raises 403. All poster wizard endpoints that take an `artifact_id` use this dependency.

---

## Streaming vs Unary

All endpoints are unary in v1. Streaming candidates (for UX polish in v2):
- `generate-variants` — could stream per-variant completion events.
- `refine-chat` — could stream AI response text.

Rationale for v1 unary: simpler turn-counter atomicity (doc 07), simpler retry semantics, simpler rate-limit accounting.

---

## Cross-references

- Prompt templates for endpoints 1–6, 11 → doc 03.
- Image generation concurrency and Imagen integration for 8, 10 → doc 04.
- Compliance check-field cache & flag shape for 12 → doc 08.
- Save-as-variant lineage implications → doc 07.
- Test matrix per endpoint → doc 10.

*Continue to `03-ai-prompt-design.md`.*
