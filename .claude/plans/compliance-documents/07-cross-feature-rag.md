# 07 — Cross-Feature RAG Integration (Phase 6)

**Status:** Blocked on Phase 3  
**Dependencies:** Phase 3 (RAG scoring must be working)  
**Effort:** Medium

---

## Why

RAG context should flow into every AI-powered compliance feature — not just scoring. When the AI drafts a compliance rule, it should reference actual MAS text. When the AI generates poster copy, it should avoid violations documented in the regulatory library. When a creator views a score breakdown, they should be able to click through to the source regulation.

---

## Three Sub-Features

### A. RAG in AI Rule Suggestion

**Where:** `POST /api/compliance/rules/suggest` — the "AI draft" button on the compliance rules page.

**Current:** `suggest_compliance_rule()` in `compliance_service.py` builds a Gemini prompt using only `_CATEGORY_CONTEXT` (a hardcoded dict of category descriptions) + the admin's hint text.

**Enhanced:** Before building the prompt, retrieve top-3 regulatory chunks relevant to `"{category} {hint}"`. Inject them into the Gemini prompt so the suggested rule references actual MAS language.

**Changes:**
- `backend/app/services/compliance_service.py`: Add `db: AsyncSession | None = None` parameter to `suggest_compliance_rule()`. If `db` provided, retrieve chunks and append to prompt.
- `backend/app/api/compliance.py`: Pass `db` to `suggest_compliance_rule()` in the `suggest_rule` endpoint handler.

### B. RAG in Poster Copy Generation

**Where:** `POST /api/ai/poster/copy-draft-all`, `copy-draft-field`, `tone-rewrite` — Step 3 of the poster wizard.

**Current:** Copy generation prompts include a compliance footer from `compliance_patterns.py` context (avoid "guaranteed", superlatives, etc.). No actual regulatory text.

**Enhanced:** Before generating copy, retrieve top-3 regulatory chunks most relevant to the product type and key message. Inject them into the Gemini prompt as a "Compliance context" section.

**Changes:**
- `backend/app/services/poster_ai_service.py`: Add `db: AsyncSession | None = None` parameter to `copy_draft_all()`, `copy_draft_field()`, `tone_rewrite()`. If `db` provided, retrieve chunks and append compliance context to prompt.
- `backend/app/api/poster_ai.py`: Pass `db` to the above functions.

### C. Clickable Citations in Score Breakdown

**Where:** Score breakdown modal → "Regulatory Findings" section (added in Phase 3).

**Current (Phase 3):** Each RAG finding shows `Source: {title}` as static text.

**Enhanced:** Make the source title a clickable link. Clicking opens a document view dialog showing the full content, same as the "View" button on the documents page.

**Changes:**
- Extract `ViewDocumentDialog` from `compliance/documents/page.tsx` into a shared component at `frontend/src/components/compliance/document-view-dialog.tsx`.
- In `score-breakdown.tsx`, import the shared dialog. Add `viewingDocId` state. Make source title clickable → `setViewingDocId(f.source_document_id)`.
- Update `documents/page.tsx` to import from the shared component.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/app/services/compliance_service.py` | Add `db` param to `suggest_compliance_rule()`, retrieve RAG context before prompt |
| `backend/app/api/compliance.py` | Pass `db` to `suggest_compliance_rule()` |
| `backend/app/services/poster_ai_service.py` | Add `db` param to copy generation functions, inject compliance context |
| `backend/app/api/poster_ai.py` | Pass `db` to copy generation functions |
| `frontend/src/components/compliance/document-view-dialog.tsx` | **New file** — extracted `ViewDocumentDialog` for reuse |
| `frontend/src/app/(authenticated)/compliance/documents/page.tsx` | Import `ViewDocumentDialog` from shared component |
| `frontend/src/components/compliance/score-breakdown.tsx` | Clickable source citations → open document view dialog |

---

## Verification

### A. Rule Suggestion
1. Upload a MAS regulation document
2. Go to Compliance Rules page → click "AI draft" for a "disclaimer_required" rule
3. The generated rule should reference specific MAS paragraphs from the uploaded document
4. Without any documents → rule suggestion still works (falls back to category context only)

### B. Copy Generation
1. Upload a MAS regulation that prohibits "guaranteed returns"
2. Create a poster artifact → Step 3 → generate copy
3. The generated copy should NOT contain "guaranteed returns" (AI has regulatory context)
4. Without documents → copy generation works as before (generic compliance footer)

### C. Clickable Citations
1. Score an artifact that has RAG findings (Phase 3)
2. Open score breakdown modal
3. Click "Source: MAS FAA-N16" on a finding → document view dialog opens with full regulation text
4. Close dialog → back to score breakdown
