# 12 — Phase D Implementation Plan

Companion to `07-chat-refinement-design.md`. Where doc 07 is the *what*, this is the *how* — file-by-file wiring for chat refinement, inpainting, structural-change redirect, save-as-variant, and turn-counter enforcement.

---

## Context

Phase D ("Chat Refinement + Inpainting") is the one remaining wizard surface that still calls stub endpoints. Clicking the chat panel's send button currently produces "Something went wrong" because `/api/ai/poster/refine-chat` and `/api/ai/poster/inpaint` both raise `501 PHASE_NOT_IMPLEMENTED` (`backend/app/api/poster_ai.py:494, 514`). `/api/artifacts/{id}/save-as-variant` is the same shape (`backend/app/api/artifacts.py:304`).

The rest of the surface area is already scaffolded:

| Component | State | Reference |
|---|---|---|
| Frontend `ChatPanel` (messages, change-log pills, turn counter, suggestion chips) | ✅ wired | `frontend/src/components/poster-wizard/chat/chat-panel.tsx` (732 lines) |
| Frontend `InpaintOverlay` (mask drag-box, coverage calc, RGBA PNG output) | ✅ wired | `frontend/src/components/poster-wizard/chat/inpaint-overlay.tsx` (315 lines) |
| API client (`refineChat`, `inpaintRegion`, `saveAsVariant`, `classifyStructuralChange`) | ✅ wired | `frontend/src/lib/api/poster-wizard.ts:245, 255, 320, 186` |
| Pydantic request/response schemas | ✅ complete | `backend/app/schemas/poster.py:413-455` |
| `PosterChatTurn` + `PosterReferenceImage` tables | ✅ migrated | `backend/alembic/versions/e1f2a3b4c5d6_add_poster_wizard_tables.py` |
| Structural-change classifier endpoint + heuristic | ✅ done | `backend/app/api/poster_ai.py:261`, service `poster_ai_service.py:381` |
| Inpaint service layer (mask validation, red overlay, Gemini call, PIL composite, upload) | 🟡 ~95% done | `backend/app/services/poster_image_service.py:640-793` |
| `refine-chat` endpoint | ❌ 501 stub | `poster_ai.py:494-511` |
| `inpaint` endpoint | ❌ 501 stub | `poster_ai.py:514-535` |
| `save-as-variant` endpoint | ❌ 501 stub | `artifacts.py:304-324` |
| Refine service (`poster_refine_service.py`) | ❌ missing | — |
| Server-side turn-counter enforcement | ❌ missing | — |

So: **the plumbing exists; what's missing is three endpoint bodies, one new service file, and turn-counter bookkeeping.** Estimate ~350 lines of new backend code, no migrations, no frontend changes beyond a small error-message polish.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ ChatPanel / InpaintOverlay (frontend, unchanged)              │
└───────────────┬───────────────────────────────────────────────┘
                │
        ┌───────┴───────┬──────────────────────┐
        ▼               ▼                      ▼
 POST /refine-chat  POST /inpaint        POST /save-as-variant
        │               │                      │
        ▼               ▼                      ▼
 ┌──────────────┐ ┌──────────────────┐ ┌──────────────────┐
 │ poster_ai.py │ │ poster_ai.py     │ │ artifacts.py     │
 │ refine_chat()│ │ inpaint()        │ │ save_as_variant()│
 └──────┬───────┘ └────────┬─────────┘ └────────┬─────────┘
        │                  │                    │
        ▼                  ▼                    ▼
 ┌───────────────────────────────┐  ┌──────────────────────┐
 │ poster_refine_service  (NEW)  │  │ poster_variant_svc   │
 │  - refine_chat_turn()         │  │  - save_as_variant() │
 │  - _check_turn_limit()        │  │  (can live inline)   │
 │  - _build_refine_prompt()     │  └──────────────────────┘
 │  - _log_turn()                │
 └──────┬────────────────────────┘
        │ calls:
        ├── classify_structural_change()   (existing)
        ├── generate_image_gemini()        (existing, ai_service.py)
        └── poster_image_service           (existing, for inpaint)
```

**Single source of truth for turn count:** rows in `poster_chat_turns` filtered by `(artifact_id, variant_id)`. Mirrored to `artifact.content.generation.turn_count_on_selected` for cheap frontend reads, but the authoritative check before every turn is a `SELECT COUNT(*) FROM poster_chat_turns WHERE artifact_id=… AND variant_id=…`.

---

## Work Breakdown (ship order)

Each slice is independently mergeable and demoable. Recommend this order; the first slice unlocks the most user value.

### D1 — Chat Refinement (text) + Turn Counter

**New file:** `backend/app/services/poster_refine_service.py`

Public function:
```python
async def refine_chat_turn(
    db: AsyncSession,
    artifact_id: UUID,
    variant_id: str,
    user_message: str,
    change_history: list[ChangeLogEntrySchema],
    original_merged_prompt: str,
) -> RefineChatResponse
```

Steps (all within one DB transaction):

1. **Load + lock artifact** — `select(Artifact).where(id=artifact_id).with_for_update()`.
2. **Validate variant exists** in `artifact.content.generation.variants[]`; raise 404 otherwise.
3. **Count existing turns** — `SELECT COUNT(*) FROM poster_chat_turns WHERE artifact_id=? AND variant_id=? AND deleted_at IS NULL`. Call this `current_turn_index` (0-indexed).
4. **Enforce hard cap** — if `current_turn_index >= 6`: raise `HTTPException(429, detail={error_code: "TURN_LIMIT_REACHED"})`. Does not log a turn.
5. **Structural-change pre-check** — call `classify_structural_change(user_message)`. If `is_structural and confidence >= 0.7`:
   - Log a `PosterChatTurn` row with `action_type=REDIRECT`, `structural_change_detected=True`, `resulting_image_url=None`. **Does not count toward the 6-turn cap** per doc 07 §Turn Model — so log but don't include in the count used for cap. Easiest: filter redirect turns out of the count query (`AND action_type != 'REDIRECT'`).
   - Return `RefineChatResponse(action_type="REDIRECT", redirect_target=result.target, new_image_url=None, turn_index=current_turn_index, change_description="")`.
6. **Build the refine prompt** per doc 07 §Prompt Construction:
   ```
   {original_merged_prompt}
   
   ## Changes accepted so far:
   - {entry[0].description} (at {entry[0].accepted_at})
   - {entry[1].description}
   ...
   
   ## New request:
   {user_message}
   
   Return the edited poster image that incorporates the new request while preserving all earlier accepted changes. Keep layout, composition, and brand identity stable.
   ```
7. **Call Gemini image model** — `generate_image_gemini(prompt=above, input_images=[current_variant_image_bytes])`. Fetch current variant bytes via `_fetch_image_bytes()` already in `poster_image_service.py`.
8. **Generate change_description** — small Gemini text call (gemini-2.5-flash) with prompt "Summarise this poster edit in ≤ 5 words: {user_message}". Fall back to `user_message[:30]` on failure.
9. **Upload result** — `upload_image_bytes(data=edited, subfolder=f"posters/{artifact_id}/refine")`.
10. **Log turn** — create `PosterChatTurn(action_type=CHAT_REFINE, turn_index=current_turn_index, resulting_image_url=new_url, …)`.
11. **Update variant in JSONB** — set `variants[i].image_url = new_url`, `generated_at = now`, append change_log entry `{id, description, accepted_at}`.
12. **Update `turn_count_on_selected`** in `artifact.content.generation` to `current_turn_index + 1`.
13. **Determine `action_type` for response** — `TURN_LIMIT_NUDGE` if `current_turn_index == 5` (this is turn 6 / final), else `CHAT_REFINE`.
14. **Commit + return** `RefineChatResponse(turn_id, ai_response=change_description, change_description, new_image_url, action_type, redirect_target=None, turn_index=current_turn_index)`.

**Wire endpoint:** replace `poster_ai.py:499-511` body with a call to `refine_chat_turn(...)`. Also add a rate limit (existing pattern in the same file — `@limiter.limit("10/minute")` on other AI endpoints).

**Frontend polish (optional, ~10 lines):** `chat-panel.tsx` error handler currently shows "Something went wrong" for any failure. Check for `error_code === "TURN_LIMIT_REACHED"` and render "Save as variant to continue refining" instead. Also check for 501 and show "Chat refinement is still in development" — harmless safety net if this endpoint ever goes back offline.

### D2 — Inpaint Endpoint (service already 95% done)

**Wire endpoint:** replace `poster_ai.py:519-535` body with:

```python
@router.post("/inpaint", response_model=InpaintResponse, …)
async def inpaint(
    artifact_id: UUID = Form(...),
    variant_id: UUID = Form(...),
    description: str = Form(...),
    original_merged_prompt: str = Form(...),
    mask_png: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Ownership check
    # Turn limit check (reuse _check_turn_limit from poster_refine_service)
    # Read mask bytes
    # Call poster_image_service.inpaint_variant(...)  — already implemented
    # Wrap result in InpaintResponse
```

**Small fixes to existing `poster_image_service.inpaint_variant()`** (`poster_image_service.py:640-793`):
- Line 759-762: `existing_turns_count = len([v for v in variants if v.get("id") == variant_id])` — this counts *variants*, not *turns*. Replace with `SELECT COUNT(*) FROM poster_chat_turns WHERE artifact_id=? AND variant_id=?` (same helper from D1).
- Line 767: `variant_id=uuid.UUID(variant_id)` — variant IDs in `generation.variants` are strings (uuid4 hex), the PosterChatTurn column type depends on the model. Verify compatibility; if the DB column is UUID, the cast is correct. If it's String, drop the cast.
- After PosterChatTurn insert: bump `artifact.content.generation.turn_count_on_selected` (same as D1 step 12). Service is already inside its own transaction (`db.commit()` at line 787), so add the mirror update before the commit.

**Rate limit:** same as D1.

**Frontend:** no changes. Error handler in `chat-panel.tsx` already shows "Inpainting failed. Please try again."

### D3 — Save-as-Variant

**Wire endpoint:** replace `artifacts.py:304-324` stub body with:

```python
@router.post("/api/artifacts/{artifact_id}/save-as-variant", response_model=SaveAsVariantResponse)
async def save_as_variant(
    artifact_id: UUID,
    data: SaveAsVariantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Load + lock artifact; owner check (artifact.creator_id == current_user.id or BRAND_ADMIN)
    # 2. Find the source variant in content.generation.variants[] by data.variant_id
    # 3. Build the new variant dict:
    #      {
    #        id: str(uuid4()),
    #        image_url: source.image_url,
    #        generated_at: now,
    #        status: "READY",
    #        selected: True,
    #        parent_variant_id: source.id,
    #        change_log: deepcopy(source.change_log),
    #      }
    # 4. Unset selected on all other variants; append the new one.
    # 5. Reset content.generation.turn_count_on_selected to 0.
    # 6. Save; return SaveAsVariantResponse(new_variant_id=new.id)
    #    — or extended payload {new_variant: GeneratedVariant-shaped} if the frontend
    #      expects the fuller shape (it does, per poster-wizard.ts:320-328).
```

**Response shape mismatch to resolve:** `SaveAsVariantResponse` (schemas/poster.py:454) is `{new_variant_id: str}`, but the frontend types `saveAsVariant()` as returning `{new_variant: GeneratedVariant}`. Pick one and align:
- **Recommended:** widen `SaveAsVariantResponse` to return `{new_variant: {id, slot, status, image_url, error_code: null, retry_token: null}}`. Frontend is already consuming that shape at `chat-panel.tsx` ~line 430; no frontend change needed.

No service file needed — the logic is ~30 lines and lives fine inline in the endpoint. If it grows, extract to `poster_variant_service.py`.

### D4 — Shared Turn-Counter Helper

Extract into `poster_refine_service.py`:

```python
async def count_turns(
    db: AsyncSession,
    artifact_id: UUID,
    variant_id: str,
    *,
    exclude_redirects: bool = True,
) -> int: ...

async def enforce_turn_limit(...) -> int:
    """Raises 429 TURN_LIMIT_REACHED if count >= 6. Returns current count."""
```

Used by D1 (refine-chat) and D2 (inpaint endpoint wrapper).

### D5 — Undo-Pill Flow (backend side already covered)

Doc 07 §Change Log says ✕ on a pill re-submits refineChat with that pill removed from history and a synthetic `"undo the change: {description}"` message, **without** counting against the turn limit.

Backend support: already achievable with one extra rule in D1 step 4 — if `user_message.startswith("undo the change: ")`, skip the cap-increment **but still generate a new image** (using the change history minus the removed pill). Frontend handles the pill management; backend just doesn't increment.

Safer alternative: add an explicit boolean `is_undo: bool = False` field on `RefineChatRequest`. The spec doesn't have one, and the frontend currently uses the synthetic message trick. For v1, keep the string-matching rule (low risk, easy to change). Add an explicit flag if the pattern flakes in testing.

### D6 — Tests + Telemetry

**Tests (`backend/tests/test_poster_refine.py`, new file):**
- Happy path: one refine turn returns `action_type=CHAT_REFINE, turn_index=0`.
- 6-turn sequence: 6th response is `TURN_LIMIT_NUDGE`, 7th is `429 TURN_LIMIT_REACHED`.
- Structural-change: "change the headline to XYZ" returns `REDIRECT` with `target=STEP_3_COPY` and does not log a non-redirect turn.
- Save-as-variant: turn counter resets; old variant's change_log is snapshotted on the new one; lineage `parent_variant_id` is set.
- Inpaint: mask > 60% returns 400; ≤ 60% logs an INPAINT turn and decrements the remaining budget.

Mock `generate_image_gemini` (returns a 1-px PNG) and `classify_structural_change` to avoid hitting external services.

**Telemetry (doc 07 §Telemetry):** six events listed in the spec. Minimal wiring — emit structured log lines (`logger.info("poster_refine_turn_succeeded", extra={...})`) from each success path. Don't block on a metrics pipeline; structured logs are sufficient for v1.

---

## Files Touched

**New:**
- `backend/app/services/poster_refine_service.py`
- `backend/tests/test_poster_refine.py`

**Modified:**
- `backend/app/api/poster_ai.py` — replace `refine_chat` (line 494) and `inpaint` (line 514) stub bodies; add rate-limit decorators.
- `backend/app/api/artifacts.py` — replace `save_as_variant` (line 304) stub body.
- `backend/app/services/poster_image_service.py` — small fixes to `inpaint_variant()` (lines 759-787): use real turn-row count; mirror `turn_count_on_selected` update.
- `backend/app/schemas/poster.py` — widen `SaveAsVariantResponse` to return a `GeneratedVariant`-shaped object instead of just an id.
- `frontend/src/components/poster-wizard/chat/chat-panel.tsx` — polish error mapping for `TURN_LIMIT_REACHED` / 501 (~10 lines).

No migration changes (poster_chat_turns table already exists from revision `e1f2a3b4c5d6`).

---

## Open Decisions

1. **Undo-pill detection:** string-match on `"undo the change: "` (spec-compliant, fragile) vs. explicit `is_undo` boolean on the request schema (schema change, safer). Recommend string-match for v1; add flag if it breaks.
2. **Response shape for save-as-variant:** widen `SaveAsVariantResponse` to match frontend's expectation (recommended) vs. update frontend to consume `{new_variant_id}` only and re-fetch the full variant. Widening is 3 lines; re-fetch costs a round trip.
3. **Change-description generation:** dedicated Gemini flash text call (quality, costs one extra call per turn) vs. regex-summarise the user's message (free, sometimes awkward). Recommend Gemini — the spec is strict about ≤5 words and the pill text matters for UX.

These are small enough to resolve during review; no need to block on them.

---

## Verification

Run each of these manually after the merge. All require: backend running (`make backend`), worker (`make worker`), seeded DB (`make seed`), frontend (`make frontend`), logged in as `sarah.lim@example.com`.

1. **Chat refinement happy path**
   - Open an existing poster at `/projects/{id}/artifacts/new-poster/generate?load=…`.
   - In the chat panel, type "warmer background" → Send.
   - Expect: new image appears in canvas within ~10s; change-log pill "Warmer background" (or similar ≤5 words) appears; counter goes `1 / 6`.

2. **Turn limit**
   - From the same variant, submit 5 more refinements.
   - Expect: the 6th response carries `action_type=TURN_LIMIT_NUDGE` and shows the nudge message; the 7th submission is rejected with "Save as variant to continue refining."

3. **Save as variant**
   - Click "Save as variant" in the action toolbar.
   - Expect: a new variant thumbnail appears in the strip, selected by default; counter resets to `0 / 6`; the previous variant is still there with its image intact.

4. **Structural-change redirect**
   - Type "change the headline to Protect What Matters" → Send.
   - Expect: no new image; a blue redirect notice appears with a "Step 3 — Copy" button; clicking it navigates to `/copy` with the wizard's state preserved; turn counter does NOT increment.

5. **Inpaint**
   - Click "Edit region" → draw a box around (say) the background sky → type "add subtle clouds" → Submit.
   - Expect: within ~10s, the canvas updates with clouds *only* in the selected region; a "Region edit: add subtle clouds" change-log pill appears; counter increments.

6. **Inpaint > 60% warning**
   - Click "Edit region" → draw a box covering most of the image.
   - Expect: client-side warning; if the user proceeds, server returns 400 with a clear message.

7. **Undo pill**
   - After several refinements, click ✕ on the middle pill.
   - Expect: image regenerates without that change; pill is removed; turn counter **does not** increment.

8. **DB state checks (optional but recommended):**
   - `SELECT COUNT(*), action_type FROM poster_chat_turns WHERE artifact_id = '…' GROUP BY action_type` — row counts line up with what you did.
   - `SELECT content->'generation'->>'turn_count_on_selected' FROM artifacts WHERE id='…'` — matches the counter displayed in the chat panel.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gemini image-editing latency regressions | Timebox: fail over to "try again" after 30s. Log duration per turn. |
| Gemini returns garbage on chained refinements | The refine prompt re-states prior accepted changes, not the raw prior images — keeps drift bounded. |
| JSONB race when two tabs refine the same variant | `with_for_update()` on the artifact row serializes writes. |
| `turn_count_on_selected` in JSONB drifts from row-count | Row count in `poster_chat_turns` is the source of truth; the JSONB mirror is for frontend convenience and is rebuilt from the row count on every write. |
| Frontend polls old `generation.variants` and misses the new image | Refine/inpaint responses include `new_image_url` directly; frontend already calls `updateVariantImage(variantId, new_image_url)` on success (`chat-panel.tsx` handler). |

---

## Non-Goals

- **Streaming AI responses** — doc 07 §Streaming explicitly defers to v2.
- **Free-form brush mask** — v1 is rectangular only.
- **Cap on the number of variants per artifact** — monitor first; add a cap if needed.
- **Context-aware suggestion chips** — static list only; v2 concern.
- **30-day sweep for poster_chat_turns** — handled by existing `poster_sweep_service` which already sweeps expired reference images; extend it in a separate PR.
