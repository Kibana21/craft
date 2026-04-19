# 04 — RAG-Powered Whole-Artifact Scoring (Phase 3)

**Status:** Blocked on Phase 2  
**Dependencies:** Phase 2 (rag_service.py must exist with `retrieve_relevant()`)  
**Effort:** Medium

---

## Why

The compliance scorer (`compliance_scorer.py`) currently uses keyword matching against `ComplianceRule` rows — it catches "guaranteed" but cannot reason about whether content violates a regulation it hasn't been told about. With RAG, it retrieves the most relevant regulatory passages and asks Gemini: "Does this marketing content violate these specific regulations?"

---

## Backend

### 1. Add `fact_check_claims()` to `backend/app/services/rag_service.py`

```python
async def fact_check_claims(
    content_text: str,
    retrieved_chunks: list[ComplianceDocument],
) -> list[dict]:
```

- Builds Gemini prompt with retrieved regulatory passages as context
- Asks Gemini to identify claims that contradict, misrepresent, or omit mandatory qualifications
- Returns list of findings, each with:
  - `claim: str` — the specific text from the marketing content
  - `regulation_excerpt: str` — the relevant passage from the source
  - `source_document_id: str` — UUID of the source document
  - `source_title: str` — title of the source document
  - `verdict: "VIOLATION" | "NEEDS_REVIEW" | "PASS"`
  - `confidence: float` — 0.0 to 1.0
  - `explanation: str` — brief explanation of the issue
- Temperature: 0.2 (deterministic)
- Response format: JSON array
- Wrapped in try/except — returns `[]` on any failure (fail-open pattern)

### 2. Add `RAGFinding` schema to `backend/app/schemas/compliance.py`

```python
class RAGFinding(BaseModel):
    claim: str
    regulation_excerpt: str
    source_document_id: str
    source_title: str
    verdict: Literal["PASS", "VIOLATION", "NEEDS_REVIEW"]
    confidence: float
    explanation: str
```

Extend `ComplianceScoreResponse`:
```python
class ComplianceScoreResponse(BaseModel):
    score: float
    breakdown: dict
    suggestions: list[str]
    rag_findings: list[RAGFinding] = []  # backward compat default
```

### 3. Modify `compliance_scorer.py`

After Layer 2 (disclaimer check) and before score computation, add Layer 3:

```python
# Layer 3: RAG fact-checking
rag_findings = []
try:
    from app.services.rag_service import retrieve_relevant, fact_check_claims
    chunks = await retrieve_relevant(db, text, top_k=5)
    if chunks:
        rag_findings = await fact_check_claims(text, chunks)
except Exception:
    logger.warning("RAG layer failed in score_artifact", exc_info=True)
```

Score deduction:
- VIOLATION: -10 points per finding
- NEEDS_REVIEW: -3 points per finding

Add `rag_findings` to the breakdown dict and top-level return.

### 4. Update API response in `compliance.py`

The `score_artifact()` return dict already gets passed through `ComplianceScoreResponse(**result)`. Adding `rag_findings` to the return dict + schema is sufficient.

---

## Frontend

### Update types: `frontend/src/lib/api/compliance.ts`

```typescript
export interface RAGFinding {
  claim: string;
  regulation_excerpt: string;
  source_document_id: string;
  source_title: string;
  verdict: "PASS" | "VIOLATION" | "NEEDS_REVIEW";
  confidence: number;
  explanation: string;
}

// Extend ComplianceScore
export interface ComplianceScore {
  score: number;
  breakdown: {
    rules: Array<{...}>;
    disclaimers: Array<{...}>;
    suggestions: string[];
    rag_findings?: RAGFinding[];
  };
  suggestions: string[];
  rag_findings?: RAGFinding[];
}
```

### Update score breakdown: `frontend/src/components/compliance/score-breakdown.tsx`

Add "Regulatory Findings" section between "Required disclaimers" and "Suggestions":

- Only shown when `rag_findings` array is non-empty
- Each finding is a card with:
  - Claim text (bold)
  - Source title (blue, italic — will become clickable in Phase 6)
  - Explanation text
  - Verdict badge: red (`#FCE8E6` / `#C5221F`) for VIOLATION, amber (`#FEF7E0` / `#B45309`) for NEEDS_REVIEW
- Card background colour matches verdict

---

## Files to Modify

| File | Change |
|---|---|
| `backend/app/services/rag_service.py` | Add `fact_check_claims()` |
| `backend/app/services/compliance_scorer.py` | Add RAG layer after disclaimers |
| `backend/app/schemas/compliance.py` | Add `RAGFinding`. Add `rag_findings` to `ComplianceScoreResponse`. |
| `frontend/src/lib/api/compliance.ts` | Add `RAGFinding` type, extend `ComplianceScore` |
| `frontend/src/components/compliance/score-breakdown.tsx` | Add "Regulatory Findings" section |

---

## Verification

1. Score an artifact with no documents uploaded → no RAG findings, score unchanged
2. Upload a MAS regulation, then score an artifact with contradictory claims → RAG findings appear, score reduced by -10 per VIOLATION
3. Gemini failure → scoring still works, just no RAG findings (fail-open)
4. Score breakdown modal shows the new "Regulatory Findings" section with colour-coded cards
5. Score with NEEDS_REVIEW findings → score reduced by -3 per finding
6. `ComplianceCheck` audit row in DB includes `rag_findings` in `breakdown` JSONB
