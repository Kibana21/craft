# 10 — Testing Strategy

This doc defines the test surface for the Poster Wizard across unit, contract, component, E2E, and load tiers. It is phase-aware — each phase ships with its own test deliverables.

## Goals

- Catch schema/contract drift at the API layer before it reaches the client.
- Ensure prompt templates produce well-formed outputs (structured JSON where required).
- Protect latency budgets (PRD §14.1).
- Verify compliance flagging is precise (low false positives, zero false negatives on known MAS patterns).
- Provide a repeatable E2E happy-path that gates merges.

Non-goals:
- 100% coverage. Focus effort on the surfaces with real failure modes (AI orchestration, compliance patterns, export pipeline).

---

## Unit Tests

### Backend

Location: `backend/tests/poster_wizard/`.

**`test_prompt_builders.py`**
- Brief prompt inserts all input fields without duplication.
- Composition assembler produces stable output given stable inputs (snapshot test).
- Copy-draft-all prompt enforces JSON schema.
- Structural-change keyword patterns match and do not false-match common visual-refinement phrases ("darker background", "warmer tone").

**`test_compliance_patterns.py`**
- Each regex in `compliance_patterns.py` has ≥ 3 positive examples and ≥ 3 negatives.
- Cache hit returns identical flags to miss.
- LLM layer is short-circuited when text < 3 chars.

**`test_poster_content_schema.py`**
- Pydantic `PosterContent` validates minimal valid JSONB.
- Rejects missing required fields.
- Rejects invalid enums.
- Schema-version field is enforced.

**`test_poster_image_service.py`**
- `asyncio.gather` orchestration returns all 4 slots even when one raises.
- Timeout per slot is enforced (use a monkeypatched `gemini-2.5-flash-image` client that sleeps).
- Text-vs-image-to-image branching: correct mode chosen per subject type.
- Inpaint mask size validation rejects mismatched dimensions.
- Reference-image TTL is respected — expired images are rejected at generation time.

**`test_export_service.py`**
- PDF export produces a file with correct DPI metadata.
- CMYK conversion preserves perceptual colour within ΔE < 5 on AIA red (#D0103A).
- Bleed boxes present in output.
- Score < 70 blocks export.

**`test_sweep_jobs.py`**
- Expired reference images are deleted (row + object).
- Chat turns older than 30 days are soft-deleted.
- Sweep is idempotent.

---

### Frontend

Location: `frontend/src/components/poster-wizard/**/*.test.tsx` (colocated with components).

**Component tests (Vitest + React Testing Library):**
- Each step component renders with valid default state.
- Validation blocks Continue when required fields missing.
- AI-assist chip: disabled while loading, re-enabled on success, field populated.
- Tone rewrite chip updates all 4 copy fields.
- Chat panel: submitting increments turn counter (mocked response).
- Change log pill ✕ removes pill and triggers reversal request.
- Structural-change redirect message renders with step button.
- Inpaint overlay: bounding box selection produces a mask of expected dimensions.

**Zustand store tests (plain Vitest):**
- `setField` writes at nested paths.
- `acceptAIResult` clears pending state.
- `addChangeLogEntry` / `removeChangeLogEntry` mutate the selected variant's change log only.
- Reset on wizard close.

---

## Contract Tests

Location: `backend/tests/poster_wizard/contracts/`.
Tool: `pytest` + `httpx.AsyncClient` against a test FastAPI app.

Scope: every endpoint in doc 02 gets a contract test covering:
- Happy path returns the expected response shape.
- Auth required; unauthenticated requests get 401.
- RBAC denied for cross-user artifact access.
- Validation errors return 422 with `error_code = VALIDATION_ERROR`.
- Rate limit triggers after N+1 calls.

AI-touching contracts mock the Gemini text and image clients via dependency override so tests don't depend on network or cost.

---

## AI Mocking Strategy

Three modes, selectable via env var `AI_TEST_MODE`:

| Mode | Behaviour | Use case |
|---|---|---|
| `fixtures` (default for CI) | Return canned responses from `backend/tests/fixtures/ai/` keyed by prompt hash | Deterministic, fast, offline |
| `record` | Real API calls, cache responses to fixtures | Updating fixtures when prompt templates change |
| `live` | Real API calls, no caching | Local manual verification only |

Fixtures are JSON files per prompt template, with a small set of canonical input → output pairs. When a prompt template changes, the fixture name bumps (`copy-draft-all.v2.json`) and old tests update.

**Never commit real API keys into fixtures.** Fixture responses must be manually reviewed to ensure no PII or client-specific data leaks.

---

## E2E Happy Path

Location: `frontend/e2e/poster-wizard.spec.ts` (Playwright, assuming Playwright is the existing E2E runner; verify during implementation).

### Scenario: "Brief to export in under 10 minutes"

1. Log in as FSC agent.
2. Open a project; click New Artifact → Static Poster.
3. Step 1: fill brief fields; click AI Generate Brief; accept result; Continue.
4. Step 2: select Human Model; fill keywords + mood + posture; click Generate from keywords; accept; Continue.
5. Step 3: click Draft all from brief; edit headline slightly; verify compliance warning does not appear; Continue.
6. Step 4: pick Portrait, Hero dominant, Clean & corporate, default palette; click AI Generate Composition; Continue.
7. Step 5: wait for 4 variants (mocked to complete in < 5s in test); select variant 2.
8. Chat: submit "make the background warmer"; wait for refined image; verify change-log pill appears.
9. Click Export PNG; verify download URL returned.
10. Assert total elapsed < 10 min (slack-timed, not wall-clock in CI).

### Scenario: "Structural-change redirect"

1. Reach Step 5 as above.
2. Chat: submit "change the headline to something else".
3. Verify redirect notice renders with Step 3 button.
4. Click button → user lands on Step 3 with chat history preserved in store.

### Scenario: "Turn limit nudge"

1. Reach Step 5.
2. Submit 5 refinement messages.
3. Submit a 6th; verify the AI response contains the turn-limit nudge block.
4. Submit a 7th; verify the input is disabled.
5. Click Save as variant; verify counter resets and input is re-enabled.

### Scenario: "Compliance flag surfaces on Step 3"

1. Reach Step 3.
2. Type "guaranteed returns for life" in the headline.
3. Wait for debounced compliance check.
4. Verify inline warning card renders.
5. Dismiss; verify it disappears but re-appears if the text is re-entered.

---

## Load & Latency Tests

Location: `backend/tests/load/poster_wizard_load.py`. Tool: `locust` or `k6`.

Scenarios:
- **Steady-state variants:** 5 concurrent users, each generating variants every 2 minutes for 10 minutes. Target: p95 `generate-variants` under 45s.
- **Compliance burst:** 20 users each issuing one `check-field` call per second for 30s. Target: p95 < 200 ms on cache-warm, < 1.5s cache-cold.
- **Export spike:** 10 concurrent PDF exports. Target: p95 < 20s.

Not run in CI — nightly or pre-release only.

---

## Compliance Engine Regression Suite

A golden-set of 100 AIA-derived copy examples (provided by the compliance team; tracked in doc 11 as an ingest dependency). Each example is labelled with expected flags. The compliance engine must:
- Flag every labelled example correctly (no false negatives).
- Not flag the 50 "clean" control examples (few false positives).
- Re-run on every change to `compliance_patterns.py` or any ComplianceRule fixture.

---

## Migration & Data Tests

For every new Alembic migration:
- `pytest` fixture spins up a fresh DB and runs `alembic upgrade head` then `alembic downgrade -1` then upgrade again. Confirms reversibility.
- Verify indexes exist via `information_schema.indexes` query.

---

## CI Integration

Recommended test stages in CI:

1. **Fast path (< 2 min):** lint, unit, Pydantic schema tests. Blocks every PR.
2. **Medium path (< 10 min):** contract tests, frontend component tests, Alembic round-trip. Blocks merge to `main`.
3. **Slow path (overnight):** E2E Playwright suite, load tests, compliance regression. Non-blocking but reviewed.

`make test` continues to work as today for local dev (runs fast path + medium).

---

## Telemetry Verification

A small nightly script compares:
- Number of `generate-brief` backend logs vs `ai_request_started` client telemetry events.
- Expected ratios (e.g., brief generated vs brief accepted within 2 min) within sane bounds.

Surfaces broken telemetry wiring quickly.

---

## Test Data

Fixtures under `backend/tests/fixtures/poster_wizard/`:
- Sample `PosterContent` JSONB blobs for each subject type.
- Sample merged prompts (short, long, with & without brand tagline).
- Sample ComplianceRule rows (MAS patterns + custom).
- Sample reference images (small PNGs, PNGs > 20 MB for limit testing).
- Sample masks (rectangular, non-rectangular, full-coverage).

---

## Cross-references

- Endpoints under test → doc 02.
- Prompt templates under test → doc 03.
- Image pipeline under test → doc 04.
- Compliance engine under test → doc 08.
- Export pipeline under test → doc 09.

*Continue to `11-open-questions.md`.*
