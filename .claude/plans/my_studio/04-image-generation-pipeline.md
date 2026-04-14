# 04 — Image Generation Pipeline

Covers both **single-image enhancement** and **batch workflow**. Same Celery task (`studio.generate`), same service-layer primitives; the batch flag drives the fan-out.

---

## Dispatch

```
POST /api/studio/workflows/generate
      │
      ▼
studio_generation_service.enqueue_run(user_id, inputs)
      │
      ├── quota check (Redis: studio_daily:{user_id}:{yyyy-mm-dd})
      ├── INSERT INTO studio_workflow_runs (status=QUEUED, progress_percent=0)
      ├── Celery: studio.generate_run.delay(run_id)
      └── return run_id
```

Client then polls `GET /api/studio/workflows/{run_id}/status` every 2 s (same 2s cadence as the Phase C poster generation polling).

---

## Celery task — `studio.generate_run`

```python
# backend/app/services/studio_generation_worker.py
# queue: "studio"

@celery_app.task(bind=True, name="studio.generate_run", acks_late=True)
def generate_run_task(self, run_id_str: str):
    run_id = uuid.UUID(run_id_str)
    asyncio.run(_execute_run(run_id))
```

`_execute_run(run_id)` is async:

1. Load run row, mark status=RUNNING, `started_at=now()`.
2. Fetch each `source_image_id` from `studio_images` (bytes via `_fetch_image_bytes` reusing the helper in `poster_image_service`). `None` if Text→Image.
3. For each `(source, slot)` pair, generate one variation.
4. Write `studio_images` row for each successful output (`type=ENHANCED` if had source, else `AI_GENERATED`).
5. Update `progress_percent` after each variation.
6. Set final status: DONE (all slots READY), PARTIAL (some failed), FAILED (none succeeded).
7. If DONE or PARTIAL, `award_points_once(user_id, MY_STUDIO_ENHANCE if not is_batch else MY_STUDIO_BATCH, related=run_id)`.
8. Send in-app notification when `is_batch=True` (reuse `notification_service`).

### Fan-out shape

| Case | Concurrency | Total Gemini calls |
|---|---|---|
| Single, 1 variation | 1 | 1 |
| Single, 4 variations | `asyncio.gather` × 4 | 4 |
| Single, 8 variations | `asyncio.Semaphore(4)`, 2 waves | 8 |
| Batch 4 images × 1 var | `Semaphore(4)` over 4 pairs | 4 |
| Batch 4 images × 4 var | `Semaphore(4)` over 16 pairs | 16 |
| Batch 20 images × 2 var | `Semaphore(4)` over 40 pairs | 40 (max per PRD §11.5) |

**Concurrency rule**: never more than 4 live Gemini image calls in flight per run. Prevents rate-limit cascades while keeping latency reasonable.

---

## Single-variation generator

Reuses the existing retry/backoff machinery from `poster_image_service._single_variant()`. Extract it to a shared helper during Phase B so both features share:

```python
# backend/app/services/gemini_image_utils.py   (NEW in Phase B)

SEED_PHRASES = [ ... ]  # move from poster_image_service
BACKOFF_DELAYS = (2.0, 5.0, 10.0)

async def generate_one_variation(
    *,
    prompt: str,
    input_images: list[bytes] | None,
    slot: int,
    timeout_seconds: int = 45,
) -> bytes:
    """Single Gemini image call with seed diversity + exponential backoff.
    Raises GeminiImageError on exhausted retries.
    """
```

Imported by both `poster_image_service._single_variant` (refactor) and `studio_generation_worker._single_variation`.

---

## Per-variation flow

```
_single_variation(run, source, slot)
    ├── prompt = run.merged_prompt + SEED_PHRASES[slot % 4]  (diversity)
    ├── bytes = await generate_one_variation(prompt, input_images=[source.bytes] if source else None)
    ├── url = await upload_image_bytes(bytes, subfolder=f"studio/{user_id}/outputs/{run_id}")
    ├── create StudioImage(
    │       type = ENHANCED if source else AI_GENERATED,
    │       source_image_id = source.id if source else None,
    │       workflow_run_id = run.id,
    │       prompt_used = run.merged_prompt,
    │       storage_url = url,
    │       name = f"{source.name} — enhanced {slot+1}" if source else f"Generated {slot+1}",
    │       ... (dims from Pillow on returned bytes)
    │   )
    ├── run.progress_percent += ceil(100 / total_slots)
    └── await db.commit()
```

---

## Batch-specific considerations

- `source_image_ids` is a list (≤ 20).
- Each image is independent — one failure doesn't cancel others.
- **Failed-slot retry**: the user can click Retry on an individual failed output. Endpoint `POST /workflows/{run_id}/retry-slot` re-runs just that `(source_image_id, slot)` pair and updates its row. Does not reset `progress_percent` (already DONE/PARTIAL).
- **Intermediate results appear live**: because outputs are committed as they complete, the client's polling call returns a growing `outputs` list and the UI can render each thumbnail as it arrives (same UX as Poster Wizard's variant strip).

---

## Quotas and caps

Redis keys (same pattern as `poster_image_service.DAILY_VARIANT_CAP` in `poster_image_service.py:41`):

- `studio_daily:{user_id}:{yyyy-mm-dd}` → int counter, incremented by `variation_count × len(source_image_ids)` at dispatch.
- Cap: **100 variations/user/day** (same as posters; review after v1).
- Exceeded → 429 `STUDIO_QUOTA_EXCEEDED`.

---

## Timeouts

- Single Gemini image call: 45 s (same as poster `VARIANT_TIMEOUT_SECONDS`).
- Celery soft limit per task: 30 minutes (generous — covers worst-case batch 20×4 even with retries and 4-way concurrency).
- Celery hard limit: 45 minutes.
- If the task crashes: the run row stays RUNNING until a separate sweep job flips orphans to FAILED. (Sweep job is already a pattern for video; extend it in Phase B.)

---

## Save vs. Discard

Per PRD §15.2:
- On the **Generate** step, outputs are already in `studio_images`. "Save to library" is a UX label for "keep these" — no DB action; the outputs are already stored.
- "Discard" sets `deleted_at` on all output rows and any poster refs. Reusable as a single POST `/workflows/{run_id}/discard-outputs` endpoint.

---

## Graceful degradation

If `generate_image_gemini` fails with `AI_CONTENT_POLICY`:
- Output row is NOT created.
- Per-slot status surfaced as a failed "slot" in the status response; user can tweak the prompt and retry.
- The run isn't globally failed — other slots continue.

If Redis is unreachable:
- Fall through without quota enforcement (log a warning). Don't block usage on infra.

If storage upload fails:
- Retry once (already handled inside `upload_image_bytes`); on second failure, that slot is marked failed but the Gemini bytes are discarded — no partial writes.

---

## Observability

Structured log lines at key events, matching the Phase D poster pattern:
- `studio_run_dispatched` {run_id, user_id, is_batch, variation_count, source_count}
- `studio_slot_succeeded` {run_id, slot, duration_ms}
- `studio_slot_failed` {run_id, slot, error_code, attempt}
- `studio_run_completed` {run_id, status, duration_ms, outputs_count}

No metrics infra required beyond these structured logs for v1.
