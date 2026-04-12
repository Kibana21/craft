# 08 — Compliance Engine Extension

PRD §11 requires per-field inline compliance warnings on Step 3 copy fields. The existing engine checks whole artifacts; it does not support per-field scoring or inline UI. This doc specifies the extension.

## Current State

`backend/app/services/compliance_scorer.py`:
- `score_artifact(artifact_id)` — loads artifact, extracts all text, runs each `ComplianceRule` against the concatenated content, returns `ComplianceCheck` with `score` (0–100) and `violations[]`.
- Rules are `ComplianceRule` rows with `rule_text`, `category`, `severity` (ERROR / WARNING), `is_active`.
- Called at export time to gate (score ≥ 70 required, per `export_service.py`).

**Gap:** No way to check a single field (e.g., headline) in isolation with a bounded latency budget suitable for live typing feedback.

---

## New Capability: `check-field`

### Endpoint contract (doc 02, §12)

`POST /api/compliance/check-field` accepts a single field's text + tone context and returns applicable flags. No scoring — flags only. Scoring stays at the whole-artifact level on export.

### Flag shape

```python
class ComplianceFlag(BaseModel):
    pattern_type: Literal[
        "ABSOLUTE_CLAIM",
        "UNQUALIFIED_SUPERLATIVE",
        "MISLEADING_CERTAINTY",
        "MISSING_PRODUCT_QUALIFIER",
        "CUSTOM_RULE",
    ]
    matched_phrase: str              # the exact substring that tripped the flag
    severity: Literal["ERROR", "WARNING"]
    mas_basis: str                   # e.g. "FAA-N16"
    suggestion: str | None = None    # optional alternative wording
    rule_id: UUID | None = None      # references ComplianceRule if custom
```

---

## Scoring Flow (per-field)

```
text + tone_context → normalize → hash → cache lookup ↓ hit  → return cached flags
                                                    ↓ miss → run pattern checks
                                                              + (optional) LLM semantic check
                                                              → store in cache → return
```

### Normalisation

- Lowercase.
- Strip punctuation.
- Collapse whitespace.
- Preserve word boundaries for regex.

### Pattern layers

**Layer 1 — static pattern library** (regex / keyword):

Defined in `backend/app/services/compliance_patterns.py` (new file), keyed by `pattern_type`:

```python
PATTERNS = {
    "ABSOLUTE_CLAIM": [
        (r"\bguaranteed? (returns?|payout|outcome)\b", "FAA-N16"),
        (r"\bno risk\b", "FAA-N16"),
        (r"\bzero risk\b", "FAA-N16"),
    ],
    "UNQUALIFIED_SUPERLATIVE": [
        (r"\bthe cheapest\b", "FAA-N16"),
        (r"\bthe only\b", "FAA-N16"),
        (r"\bnumber one\b", "FAA-N16"),
    ],
    "MISLEADING_CERTAINTY": [
        (r"\byou will receive\b", "Insurance Act advertising provisions"),
        (r"\bdefinitely pays?\b", "Insurance Act advertising provisions"),
    ],
}
```

**Layer 2 — active custom rules from DB** (`ComplianceRule` rows):
Applied after static layer. Each active rule's `rule_text` is matched against the field (case-insensitive substring by default; optionally regex if the rule's `category` is marked as such).

**Layer 3 — LLM semantic check** (optional, async, non-blocking for UI):
For nuanced patterns like "missing product qualifier" (headline implies investment when it's insurance), call a cheap Gemini classifier. This layer is:
- Skipped for < 3-word fields (not enough context).
- Skipped on cache hits.
- Can be disabled via feature flag for cost control.

Prompt:
```
Classify whether this marketing copy for an AIA Singapore insurance product has a "missing product qualifier" problem. The text must not imply investment, deposit, or savings account when the underlying product is insurance.

Text: "{text}"
Campaign tone: {tone}

Output JSON: { "missing_qualifier": bool, "confidence": float, "suggestion": "..." }
```

If `missing_qualifier` is true and `confidence ≥ 0.7`, add a `MISSING_PRODUCT_QUALIFIER` flag.

---

## Caching

### Goal

Keep per-keystroke responsiveness cheap. A user typing "guaranteed returns" then editing to "guaranteed return" shouldn't cause two LLM calls.

### Strategy

Cache key: `sha256(normalized_text + ':' + tone)`.
Cache layer: **Redis** (already in the stack). TTL: 24h.
Cache shape: `flags: list[ComplianceFlag]`.

Client also keeps a **session-local cache** (Map keyed by the same hash) so rapid same-text queries don't even round-trip. Server is the authoritative source.

Cache invalidation:
- Automatic on `ComplianceRule` insert/update/delete — bust the whole `compliance:check-field:*` namespace.
- Manual via an internal admin endpoint if needed.

### Hit rate target

> 50% on a typical session. Measure via `compliance_check_cache_hit` telemetry.

---

## Debounce (client-side)

`useFieldCompliance` hook (doc 05):
- Debounce 600 ms after last keystroke.
- Skip if field is empty.
- Skip if text length < 3 characters.
- Hash locally, check local session cache first, then call API.

The combination of debounce + hash-keyed cache keeps the per-field request rate low (< 1/sec even for a fast typer) and stays well within the endpoint rate limit (60/min/user, doc 02).

---

## UI Surface

### Inline warning (per field, Step 3)

```
┌─────────────────────────────────────────────────────────┐
│ ⚠ "guaranteed" may breach MAS FAA-N16.                 │
│ Consider: "protected" / "covered" / "secured".   [×]   │
└─────────────────────────────────────────────────────────┘
```

- Amber background (`rgba(245, 159, 0, 0.08)`), amber border (#F59F00), AIA-compliant.
- Dismissible via `×` (session-scoped — re-appears if the offending text reappears).
- Multiple flags per field render as stacked cards.
- Component: `FieldComplianceWarning` in `frontend/src/components/poster-wizard/shared/`.

### Badge summary (top of Step 3)

A small badge in the Step 3 header shows "{N} compliance flags". Clicking scrolls to the first flagged field.

### Advisory, never blocking

Per PRD §11.1. Continue is always enabled regardless of flags. The flag state is recorded (see §Audit Trail).

---

## Export Gate Policy

The whole-artifact compliance scorer still runs at export time (existing behaviour in `export_service.py`). Gating decision for v1:

- **Score < 70:** export is blocked with a modal listing violations and a "Fix in Step 3" button.
- **Score ≥ 70 with unresolved field flags:** export proceeds, but the flags are persisted to the artifact's audit metadata (§Audit Trail). The modal shows a non-blocking warning.

Senior-role override (e.g., allow BRAND_ADMIN to force-export) is a doc 11 open question.

---

## Audit Trail

All compliance flags ever surfaced on the artifact are persisted in `artifacts.content.copy.compliance_flags[]` (doc 01). Each entry records:
- Field, pattern type, matched phrase, severity, timestamp, action taken (dismissed / edited away / exported-with-flag).

On export, if the exported artifact had any unresolved flags, the `export_logs` row includes the flag snapshot. This is the compliance officer's audit trail (US-04).

Retention: persistent (part of artifact; never purged unless artifact is hard-deleted).

---

## Rule Management

Existing `/api/compliance/rules` (CRUD) continues to serve. When a BRAND_ADMIN adds / edits / deactivates a rule:
- Cache invalidation fires.
- Existing drafts are **not retroactively re-checked** — that would surprise users mid-session. Retroactive re-check is a potential v2 batch job.

---

## Telemetry

- `compliance_check_field_called` (field, cached, layer_used, duration_ms, flag_count)
- `compliance_flag_surfaced` (pattern_type, severity)
- `compliance_flag_dismissed` (pattern_type)
- `compliance_flag_edited_away` (pattern_type)  — detected when flag no longer matches updated text
- `compliance_export_gated` (score)

Used to compute PRD §2.2 "Compliance flag rate on first draft < 20%".

---

## Load & Latency

| Target | Value |
|---|---|
| p50 endpoint latency (cache hit) | < 50 ms |
| p50 endpoint latency (cache miss, regex only) | < 150 ms |
| p50 endpoint latency (cache miss, with LLM layer) | < 1.2 s |
| Max concurrent checks per user | 4 (debounce makes this rare) |

---

## Testing

Unit tests must cover:
- Each pattern in `compliance_patterns.py` against positive and negative examples.
- Cache hit path returns identical flags to cache miss path.
- LLM layer is skipped for short fields.
- Rule invalidation busts cache.
- Audit trail accumulates without duplicating entries on the same text.

Fixtures live under `backend/tests/compliance/fixtures/`.

---

## Cross-references

- Endpoint contract → doc 02.
- Compliance patterns align with prompt footer in → doc 03.
- UI integration pattern → docs 05, 06.
- Full artifact scoring at export time → doc 09.
- Compliance flags in Pydantic `PosterContent` → doc 01.

*Continue to `09-export-pipeline-extension.md`.*
