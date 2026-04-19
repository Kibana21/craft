# 06 — Dynamic Disclaimers from DB (Phase 5)

**Status:** Ready  
**Dependencies:** None (standalone — can ship in parallel with any phase)  
**Effort:** Small

---

## Why

The disclaimer checker (`disclaimer_service.py`) hardcodes 6 product lines in a `PRODUCT_DISCLAIMERS` dictionary. Adding a new product (e.g., AIA Pro Lifetime Protector) or updating disclaimer wording requires a code deployment. With DISCLAIMER-type documents in the compliance library, admins can manage disclaimers themselves.

---

## Current State

`backend/app/services/disclaimer_service.py`:
- `PRODUCT_DISCLAIMERS: dict[str, list[str]]` — 6 products (PAA, HealthShield, AIA Vitality, PRUWealth, AIA Family Protect, SG60 Special)
- `DEFAULT_DISCLAIMER` — MAS review statement (always required)
- `get_required_disclaimers(product: str) -> list[str]` — case-insensitive partial match against product name
- `check_disclaimers(artifact_content: dict, product: str) -> list[dict]` — checks if required disclaimers are present in artifact text

Both functions are **synchronous** (no DB access). The scorer calls them directly.

---

## Backend

### 1. Add async DB-aware functions to `backend/app/services/disclaimer_service.py`

```python
async def get_required_disclaimers_db(db: AsyncSession, product: str) -> list[str]:
    """DB-first disclaimer lookup. Falls back to hardcoded dict."""
```

Logic:
1. Query `ComplianceDocument` rows where `document_type = DISCLAIMER` and `source_document_id IS NULL` (source docs only)
2. Match by product name in title (case-insensitive partial match — same logic as existing)
3. Parse content as disclaimer lines: `[l.strip() for l in doc.content.split("\n") if l.strip() and len(l.strip()) > 10]`
4. Always prepend `DEFAULT_DISCLAIMER`
5. If no DISCLAIMER documents exist in DB → fall back to `get_required_disclaimers(product)` (hardcoded dict)
6. Backwards compatible — zero disclaimer docs = existing behavior

```python
async def check_disclaimers_db(
    db: AsyncSession, artifact_content: dict, product: str
) -> list[dict]:
    """DB-aware version of check_disclaimers."""
```

Same logic as `check_disclaimers()` but calls `get_required_disclaimers_db()` instead of `get_required_disclaimers()`.

### 2. Modify `backend/app/services/compliance_scorer.py`

Change line ~50 from:
```python
disclaimer_results = check_disclaimers(content, product)
```
To:
```python
from app.services.disclaimer_service import check_disclaimers_db
disclaimer_results = await check_disclaimers_db(db, content, product)
```

The `score_artifact()` function already has `db: AsyncSession` as a parameter.

### 3. Keep sync functions

The existing `get_required_disclaimers()` and `check_disclaimers()` remain unchanged — they serve as the fallback and can be used by any code path that doesn't have a DB session.

---

## Admin Workflow

To add disclaimers for a new product:
1. Go to Compliance Documents page
2. Click "Upload document"
3. Title: "AIA Pro Lifetime Protector Disclaimers"
4. Type: Disclaimer
5. Content:
   ```
   This is not a contract of insurance. The precise terms and conditions are specified in the policy contract.
   Benefits are subject to the terms and conditions of the policy.
   Past performance is not indicative of future results.
   ```
6. Upload

The system now knows that any artifact mentioning "AIA Pro Lifetime Protector" requires these three disclaimers. No code deployment needed.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/app/services/disclaimer_service.py` | Add `get_required_disclaimers_db()`, `check_disclaimers_db()` |
| `backend/app/services/compliance_scorer.py` | Use `check_disclaimers_db()` instead of `check_disclaimers()` |

---

## Verification

1. Score an artifact with no DISCLAIMER documents in library → uses hardcoded dict, same behavior as today
2. Upload a DISCLAIMER document titled "PAA Disclaimers" with custom text → score that artifact → disclaimers come from DB content
3. Delete the DISCLAIMER document → scoring falls back to hardcoded dict
4. Upload a DISCLAIMER for a new product not in the hardcoded dict → scoring picks it up
5. Existing sync `check_disclaimers()` function still works (no breaking change)
