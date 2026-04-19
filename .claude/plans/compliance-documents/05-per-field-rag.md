# 05 — Per-Field Inline RAG (Phase 4)

**Status:** Blocked on Phase 2  
**Dependencies:** Phase 2 (`rag_service.retrieve_relevant()`)  
**Effort:** Small

---

## Why

The per-field inline checker (poster wizard Step 3) has a 3-layer pipeline. Layer 3 calls Gemini to detect "missing product qualifier" issues, but the LLM has no regulatory context — it relies on general knowledge. With RAG, it retrieves relevant MAS paragraphs before calling Gemini, producing more specific and accurate citations.

**Before RAG:** `mas_basis: "FAA-N16"` (generic)  
**After RAG:** `mas_basis: "FAA-N16 §4.2 — prohibits statements that imply guaranteed investment returns for insurance products"` (specific, grounded in actual regulatory text)

---

## Backend

### 1. Modify Layer 3 in `backend/app/services/field_compliance_service.py`

Before calling `_llm_missing_qualifier_check()`, retrieve relevant chunks:

```python
rag_context = ""
try:
    from app.services.rag_service import retrieve_relevant
    chunks = await retrieve_relevant(db, text, top_k=3)
    if chunks:
        rag_context = "\n\n".join(
            f"[{c.title}]: {c.content[:500]}" for c in chunks
        )
except Exception:
    logger.warning("RAG retrieval failed in field check: %s", exc_info=True)

llm_flag = await _llm_missing_qualifier_check(text, tone, rag_context)
```

### 2. Update `_llm_missing_qualifier_check()` signature

Add `rag_context: str = ""` parameter. Inject into prompt:

```python
regulatory_section = ""
if rag_context:
    regulatory_section = f"""

Relevant MAS regulatory context:
{rag_context}

Use the above regulations to inform your assessment. If you cite a specific regulation, include it in the mas_basis field."""

prompt = f"""Classify whether this marketing copy...
{regulatory_section}
Text: "{text}"
Campaign tone: {tone}

Respond with ONLY valid JSON:
{{"missing_qualifier": true|false, "confidence": 0.0-1.0, "suggestion": "...", "mas_basis": "..."}}"""
```

Read `mas_basis` from the LLM response and use it in the returned flag dict (instead of the current hardcoded "MAS FAA-N16 advertising provisions").

### 3. Cache invalidation on document mutations

In `backend/app/api/compliance.py`, add `redis_client: redis.Redis = Depends(get_redis)` to `upload_compliance_document` and `delete_compliance_document` endpoints, then call `await invalidate_field_compliance_cache(redis_client)` on success. (The rule create/update endpoints already do this — same pattern.)

---

## Files to Modify

| File | Change |
|---|---|
| `backend/app/services/field_compliance_service.py` | Retrieve RAG context before Layer 3 LLM call. Update `_llm_missing_qualifier_check()` to accept + inject context. |
| `backend/app/api/compliance.py` | Add `redis_client` dependency + `invalidate_field_compliance_cache()` to document upload/delete endpoints |

---

## Verification

1. Upload a MAS regulation document, then type "guaranteed returns on your investment" in a poster headline → flag cites the specific MAS paragraph from the uploaded document
2. Delete all documents → Layer 3 still works (rag_context is empty string, prompt falls back to generic classification)
3. Upload a new document → Redis cache invalidated → next field check is a cache miss (re-evaluates with new context)
4. Per-field check latency stays under 1.5s on cache miss (retrieval adds ~200ms)
