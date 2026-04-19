# PRD: Compliance Document Library & RAG-Powered Scoring

**Product:** CRAFT — Compliance Engine  
**Author:** Auto-generated from codebase analysis  
**Date:** 2026-04-17  
**Status:** Draft  
**Dependencies:** Phase 6 (compliance engine), Phase E (per-field inline compliance)

---

## 1. Problem Statement

AIA Singapore's content creators produce marketing copy that must comply with MAS (Monetary Authority of Singapore) regulations — FAA-N16, the Insurance Act (Cap 142), and various MAS Notices. Today, compliance checking in CRAFT is:

- **Rule-based only.** The scorer runs active `ComplianceRule` rows against extracted text using keyword/regex matching. It cannot reason about whether content violates a regulation it hasn't been explicitly told about.
- **Blind to the actual regulatory text.** Although admins can upload MAS documents into the `compliance_documents` table, those documents are never read during scoring. They are stored but unused.
- **Disclaimer checking is hardcoded.** The `disclaimer_service.py` contains a static mapping of product → required disclaimer text. Adding a new product or updating disclaimer wording requires a code change.
- **No context for the AI.** When the per-field inline checker (`check-field`) or the whole-artifact scorer calls Gemini, it has no regulatory context beyond what's baked into the prompt. It cannot ground its judgment in specific MAS paragraphs.

The result is a compliance engine that catches surface-level issues (the word "guaranteed", competitor brand names) but cannot detect nuanced regulatory violations — exactly the kind of thing a content creator needs help with.

---

## 2. Vision

The compliance document library becomes the **regulatory brain** of the platform. Admins upload actual MAS regulatory text, product fact sheets, and disclaimer templates. The system chunks, embeds, and indexes these documents. Every compliance check — whether whole-artifact or per-field inline — can then retrieve the most relevant regulatory passages and ask Gemini: *"Does this marketing copy comply with these specific regulations?"*

This transforms the compliance engine from a pattern matcher into a **regulation-aware AI reviewer**.

---

## 3. User Stories

### 3.1 Document Management (Admin)

| ID | Story | Priority |
|---|---|---|
| DOC-01 | As a brand admin, I want to upload MAS regulatory text so the AI compliance checker can reference the actual regulations. | P0 |
| DOC-02 | As a brand admin, I want to upload product fact sheets so the AI can verify claims against actual product details. | P0 |
| DOC-03 | As a brand admin, I want to upload disclaimer templates so the system knows exactly what disclaimer text is required for each product. | P0 |
| DOC-04 | As a brand admin, I want to see a preview of each document's content so I can verify what was uploaded. | P1 |
| DOC-05 | As a brand admin, I want to see document stats (count by type, total chunks) to understand the knowledge base size. | P1 |
| DOC-06 | As a brand admin, I want to replace/update a document without losing the reference to the original (version lineage). | P2 |
| DOC-07 | As a brand admin, I want to search within uploaded documents to verify whether a specific regulation has been included. | P2 |

### 3.2 RAG-Powered Scoring

| ID | Story | Priority |
|---|---|---|
| RAG-01 | As the system, when scoring an artifact, I retrieve the top-K relevant regulatory chunks and include them as grounding context for the Gemini fact-check call. | P0 |
| RAG-02 | As a content creator, when I view a compliance score breakdown, I want to see which specific regulation was violated (with a quote from the source document), not just "may violate: [rule text]". | P1 |
| RAG-03 | As the system, when checking a per-field inline flag, I retrieve relevant chunks to improve the accuracy of the LLM semantic layer (Layer 3). | P1 |
| RAG-04 | As a content creator, I want compliance suggestions to reference the actual regulation so I can understand *why* something is flagged. | P1 |

### 3.3 Dynamic Disclaimer Management

| ID | Story | Priority |
|---|---|---|
| DIS-01 | As a brand admin, I want to define which disclaimers are required for each product type via uploaded disclaimer templates, instead of relying on hardcoded logic. | P1 |
| DIS-02 | As the system, when scoring disclaimers, I match against the disclaimer documents in the library rather than a hardcoded dictionary. | P1 |
| DIS-03 | As a brand admin, I want to add disclaimers for new products without requiring a code deployment. | P1 |

### 3.4 Cross-Feature Integration

| ID | Story | Priority |
|---|---|---|
| INT-01 | As the system, when the AI drafts a compliance rule (`POST /rules/suggest`), I retrieve relevant regulatory chunks to ground the suggestion in actual MAS text. | P1 |
| INT-02 | As the system, when generating poster copy (Step 3 tone rewrite / copy draft), I include active compliance context so the AI avoids generating non-compliant text in the first place. | P2 |
| INT-03 | As a content creator viewing the score breakdown modal, I can click on a cited regulation to see the full document context. | P2 |
| INT-04 | As the system, when an artifact's compliance score is below 70, I generate fix suggestions that reference specific regulatory passages. | P1 |

---

## 4. Architecture

### 4.1 Document Ingestion Pipeline

```
Admin uploads document (title, content, document_type)
         ↓
Backend receives full text
         ↓
1. Store original document row (source_document_id = NULL, chunk_index = 0)
         ↓
2. Chunk text (~512 tokens per chunk, 50-token overlap)
         ↓
3. For each chunk:
   a. Generate embedding via Google text-embedding-004 (768 dims)
   b. Store as ComplianceDocument row:
      - source_document_id = original row's ID
      - chunk_index = sequential
      - content = chunk text
      - embedding = vector(768)
         ↓
4. Invalidate compliance caches (Redis compliance:check-field:*)
```

### 4.2 Retrieval at Scoring Time

```
score_artifact(artifact_id) or check_field(text)
         ↓
Extract query text (artifact content or field text)
         ↓
Generate query embedding via text-embedding-004
         ↓
pgvector cosine similarity search:
  SELECT content, title, document_type, similarity
  FROM compliance_documents
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT 5
         ↓
Inject top-K chunks into Gemini prompt as regulatory context
         ↓
Gemini evaluates content against retrieved regulations
         ↓
Return structured findings with source citations
```

### 4.3 Enhanced Scoring Pipeline

The current `compliance_scorer.py` runs two layers:
1. Rule-based pattern matching (ComplianceRule rows)
2. Disclaimer presence checking (hardcoded)

The enhanced pipeline adds:
3. **RAG fact-checking** — retrieve relevant regulatory chunks, ask Gemini to evaluate claims against them
4. **Document-sourced disclaimers** — match required disclaimers from uploaded disclaimer templates instead of the hardcoded `PRODUCT_DISCLAIMERS` dictionary

```
score_artifact(artifact_id):
  1. Extract text from artifact content JSON
  2. Layer 1: Run active ComplianceRules (existing — unchanged)
  3. Layer 2: Check disclaimers from document library (replaces hardcoded dict)
  4. Layer 3 (NEW): RAG fact-check
     a. Embed artifact text
     b. Retrieve top-5 relevant regulatory chunks via pgvector
     c. Gemini prompt: "Given these MAS regulations, evaluate whether
        this marketing content makes any claims that violate them."
     d. Each finding becomes a RAGFinding in the breakdown
  5. Compute score: existing formula + RAG deductions (-10 per false claim)
  6. Store ComplianceCheck with enhanced breakdown
  7. Return result with source citations
```

### 4.4 Enhanced Per-Field Pipeline

The per-field checker (`field_compliance_service.py`) currently has three layers:
1. Static pattern library (regex)
2. Active custom DB rules
3. LLM semantic check (Gemini classifier)

Enhancement to Layer 3:
- Before calling Gemini, retrieve top-3 relevant regulatory chunks for the field text
- Include them in the Gemini prompt so the LLM can reference actual regulations
- If a flag is generated, include the `mas_basis` as a specific paragraph reference rather than a generic "FAA-N16"

---

## 5. Document Types & Their Roles

| Document Type | What Gets Uploaded | How It's Used |
|---|---|---|
| `MAS_REGULATION` | Full or partial text of MAS notices (FAA-N16, Notice on Prevention of Money Laundering, Insurance Act advertising provisions) | RAG retrieval during scoring — the AI reads these to judge whether content is compliant. Source citations in the score breakdown. Grounding context for the AI rule suggestion endpoint. |
| `PRODUCT_FACT_SHEET` | Product-specific details — features, limitations, exclusions, pricing, target audience (e.g., AIA HealthShield Gold Max fact sheet) | RAG retrieval when scoring product-specific claims. The AI can verify "covers 100% of hospital bills" against the actual product limitations. Also used to improve AI-generated copy — the copy draft endpoint can reference the fact sheet to avoid inventing features. |
| `DISCLAIMER` | Required disclaimer text per product line, with metadata about when each is mandatory | Replaces the hardcoded `PRODUCT_DISCLAIMERS` dict. The disclaimer checker reads from the document library instead of code. Admins can add/update/remove disclaimers without deployments. |

### 5.1 Example Documents

**MAS Regulation — FAA-N16 (Advertising):**
> *Title:* MAS Notice FAA-N16 — Recommendations on Conduct of Business  
> *Content:* (excerpt) "A financial adviser shall not make a false or misleading statement in any advertisement... All advertisements for investment products must state that the investment is subject to investment risks, including the possible loss of the principal amount invested..."

**Product Fact Sheet — AIA HealthShield Gold Max:**
> *Title:* AIA HealthShield Gold Max Product Summary  
> *Content:* "Covers Medisave-approved Integrated Shield Plan benefits. Annual limit: $1,000,000. Pre-existing conditions: 12-month waiting period. Riders: Deductible rider available (not Medisave-claimable)..."

**Disclaimer — PAA Products:**
> *Title:* PAA Standard Disclaimers  
> *Content:* "Required for all PAA advertisements: (1) 'This is not a contract of insurance. The precise terms and conditions are specified in the policy contract.' (2) 'Benefits are subject to the terms and conditions of the policy.'"

---

## 6. Use Cases Across the Application

### 6.1 Whole-Artifact Scoring (Existing — Enhanced)

**Where:** Any artifact detail page → compliance badge → score breakdown modal.

**Current:** Score breakdown shows rule pass/fail and disclaimer presence/absence. No regulatory citations.

**Enhanced:** Score breakdown adds a "Regulatory Findings" section. Each finding shows:
- The claim found in the content (e.g., "guaranteed returns of 5%")
- The relevant regulation (e.g., "MAS FAA-N16 §4.2: Financial advisers shall not make false or misleading statements...")
- The verdict (VIOLATION / CAUTION / CLEAR)
- A fix suggestion grounded in the regulation

### 6.2 Per-Field Inline Compliance (Poster Wizard Step 3)

**Where:** `copy/page.tsx` — headline, subheadline, body, CTA fields.

**Current:** Flags like "guaranteed" → ABSOLUTE_CLAIM, severity ERROR, mas_basis "FAA-N16" (generic).

**Enhanced:** When the LLM layer runs, it retrieves 2–3 relevant chunks and produces more specific flags:
- `mas_basis`: "FAA-N16 §4.2 — prohibits statements that imply guaranteed investment returns for insurance products"
- `suggestion`: "Use 'projected return of up to 5% (non-guaranteed)' per FAA-N16 §4.2" (grounded in the actual regulatory text)

### 6.3 AI Rule Suggestion (Compliance Rules Page)

**Where:** `POST /api/compliance/rules/suggest` — the "AI draft" button.

**Current:** Gemini generates a rule using only the category context in the prompt and the admin's hint text.

**Enhanced:** Before generating, retrieve top-3 regulatory chunks relevant to the category. The Gemini prompt becomes: "Given these MAS regulations, draft a single compliance rule for the category [X]." The resulting rule is grounded in actual regulatory language and can reference specific MAS paragraphs.

### 6.4 AI Copy Generation (Poster Wizard Step 3)

**Where:** `POST /api/ai/poster/copy-draft-all`, `copy-draft-field`, `tone-rewrite`.

**Current:** Copy generation prompts include a compliance footer telling the AI to avoid "guaranteed", superlatives, etc. (from `compliance_patterns.py` context). But no actual regulatory text.

**Enhanced:** Before generating copy, retrieve the top-3 regulatory chunks most relevant to the product type and campaign context. Inject them into the copy generation prompt as a "compliance context" section. Result: the AI is less likely to generate non-compliant copy in the first place, reducing the number of inline flags the creator has to deal with.

### 6.5 Disclaimer Auto-Suggestion

**Where:** Artifact detail page or export flow.

**Current:** `disclaimer_service.py` has a hardcoded `PRODUCT_DISCLAIMERS` dictionary. Adding a new product line requires a code change.

**Enhanced:** The disclaimer checker reads from `DISCLAIMER`-type documents in the library. An admin uploads "PAA Standard Disclaimers" → the system parses the required text → disclaimer checking uses this. No code deployment needed for new products.

### 6.6 Export Gate (Future — Spec'd but Not Implemented)

**Where:** Export flow (`POST /api/artifacts/{id}/export`).

**Current:** Export proceeds regardless of compliance score.

**Enhanced:** Score < 70 blocks export with a modal that shows:
- Which rules failed (with regulatory citations from RAG)
- Which disclaimers are missing
- A "Fix in Step 3" button for poster artifacts
- BRAND_ADMIN override option

### 6.7 Score Breakdown — Source Document Drill-Down

**Where:** Score breakdown modal → click on a regulatory citation.

**Current:** Not available.

**Enhanced:** Each RAG finding includes a `source_document_id` and `chunk_index`. Clicking the citation opens an inline panel showing the full context (surrounding chunks from the same document, highlighted). The admin can verify the AI's interpretation against the source.

---

## 7. Frontend — Document Library Page Redesign

### 7.1 Current State

The page uses the legacy `useEffect` + `.then(setDocs)` pattern. It shows a flat list of cards with title, type, and chunk index. No content preview, no stats, no confirmation on delete, errors silently produce empty lists.

### 7.2 Redesigned Page

#### Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ Compliance Documents                                                 │
│ Regulatory library that powers AI compliance checking                │
│                                                                      │
│ 5 documents · 3 MAS Regulations · 1 Fact Sheet · 1 Disclaimer       │
│                                                           [+ Upload] │
└──────────────────────────────────────────────────────────────────────┘
```

#### Filter Bar
```
[All] [MAS Regulation] [Product Fact Sheet] [Disclaimer]     🔍 Search...
```

#### Document Card (Expanded)
```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋  MAS Notice FAA-N16 — Recommendations on Conduct         [···]  │
│     MAS Regulation · Uploaded 12 Apr 2026                           │
│                                                                      │
│     "A financial adviser shall not make a false or misleading        │
│      statement in any advertisement. All advertisements for          │
│      investment products must state that the investment is..."       │
│                                                                      │
│     4,200 characters · 9 chunks                      [View] [Delete]│
└──────────────────────────────────────────────────────────────────────┘
```

#### Upload Form
```
┌──────────────────────────────────────────────────────────────────────┐
│ Upload document                                                      │
│                                                                      │
│ Title    [MAS Notice FAA-N16                                      ]  │
│                                                                      │
│ Type     [MAS Regulation ▼]                                          │
│                                                                      │
│ Content  [                                                        ]  │
│          [  Paste the regulatory text here...                     ]  │
│          [  Tip: paste the full text — the system will             ]  │
│          [  automatically chunk it for the AI.                     ]  │
│          [                                                        ]  │
│                                                                      │
│ 0 characters                                    [Cancel]  [Upload]   │
└──────────────────────────────────────────────────────────────────────┘
```

#### View Dialog (Full Content)
```
┌──────────────────────────────────────────────────────────────────────┐
│ MAS Notice FAA-N16 — Recommendations on Conduct              [×]    │
│ MAS Regulation · 4,200 characters · 9 chunks                        │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│ A financial adviser shall not make a false or misleading             │
│ statement in any advertisement...                                    │
│                                                                      │
│ All advertisements for investment products must state that the       │
│ investment is subject to investment risks, including the possible    │
│ loss of the principal amount invested...                             │
│                                                                      │
│ [Full scrollable content]                                            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Empty State
```
┌──────────────────────────────────────────────────────────────────────┐
│                           📋                                         │
│                                                                      │
│            No documents in the compliance library                    │
│                                                                      │
│    Upload MAS regulations, product fact sheets, and disclaimer       │
│    templates. The AI uses these documents to check whether           │
│    marketing content complies with regulatory requirements.          │
│                                                                      │
│                    [+ Upload your first document]                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.3 Technical Details

- **Migrate to TanStack Query** — `useQuery` for the document list, `useMutation` for upload and delete. Fixes the unhandled-rejection bug present on the rules page before its migration.
- **Query keys:** `queryKeys.complianceDocuments()` (already defined in `query-keys.ts`).
- **Delete confirmation:** MUI Dialog — "Delete [title]? This document will be removed from the compliance library and will no longer be used in compliance checks."
- **Content preview:** First 200 characters of `content`, truncated with "..."
- **Character count:** Show in the upload form as the admin pastes content.
- **Stats strip:** Computed client-side from fetched documents (same pattern as rules page).
- **Filter pills:** By `document_type` — applied client-side.
- **Search:** Client-side filter on `title` (case-insensitive substring match).

---

## 8. Backend Changes

### 8.1 Phase 1 — Document Library UX (No RAG)

No backend changes required. The existing CRUD endpoints (`POST`, `GET`, `DELETE /api/compliance/documents`) work as-is. Frontend-only improvements.

### 8.2 Phase 2 — Chunking & Embedding Pipeline

| File | Change |
|---|---|
| `models/compliance_document.py` | Uncomment `embedding` column (Vector 768). Add migration. |
| `services/compliance_service.py` | `upload_document()` — after storing the source row, chunk at ~512 tokens with 50-token overlap. For each chunk, call `embed_text()` and store as a child row with `source_document_id` pointing to the original. |
| `services/rag_service.py` | **New file.** `embed_text(text) → list[float]` (Google text-embedding-004). `retrieve_relevant(query_text, top_k=5) → list[RetrievedChunk]`. `fact_check_claims(content_text, retrieved_chunks) → list[RAGFinding]`. |
| `schemas/compliance.py` | Add `RAGFinding(claim, regulation_excerpt, source_document_id, chunk_index, verdict, confidence)`. Extend `ComplianceScoreResponse.breakdown` to include `rag_findings`. |

### 8.3 Phase 3 — RAG Integration into Scoring

| File | Change |
|---|---|
| `services/compliance_scorer.py` | After Layer 2 (disclaimers), add Layer 3: call `rag_service.retrieve_relevant(text)` → `fact_check_claims(text, chunks)`. Add RAG findings to breakdown. Deduct -10 per RAG-identified violation. |
| `services/field_compliance_service.py` | In the LLM layer (Layer 3), before calling Gemini, retrieve top-3 chunks via `rag_service.retrieve_relevant(text, top_k=3)`. Include chunk content in the Gemini prompt for grounded evaluation. |
| `services/compliance_service.py` | In `suggest_compliance_rule()`, retrieve top-3 chunks relevant to the category. Include in the Gemini prompt so the suggested rule references actual MAS language. |

### 8.4 Phase 4 — Dynamic Disclaimers

| File | Change |
|---|---|
| `services/disclaimer_service.py` | `get_required_disclaimers(product)` — first check `DISCLAIMER`-type documents in the DB for product-matching entries. Fall back to the hardcoded `PRODUCT_DISCLAIMERS` dict if no documents match (backwards compatible). |

---

## 9. Scoring Formula (Updated)

| Violation | Deduction | Source |
|---|---|---|
| Error rule failed | -15 per rule | ComplianceRule (existing) |
| Warning rule failed | -5 per rule | ComplianceRule (existing) |
| Missing required disclaimer | -20 per disclaimer | Disclaimer docs or hardcoded (existing) |
| RAG-identified false claim | -10 per claim | **New** — RAG fact-check |
| Floor | 0 (never negative) | |

---

## 10. Data Model Changes

### ComplianceDocument (enhanced)

```sql
ALTER TABLE compliance_documents
  ADD COLUMN embedding vector(768);  -- pgvector

CREATE INDEX idx_compliance_documents_embedding
  ON compliance_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

The `source_document_id` FK (already exists) points child chunks back to the parent document row. The parent row has `chunk_index = 0` and the full content. Child chunks have `chunk_index = 1, 2, 3, ...` and partial content.

### ComplianceCheck.breakdown (enhanced JSONB)

```json
{
  "rules": [...],
  "disclaimers": [...],
  "rag_findings": [
    {
      "claim": "guaranteed returns of 5%",
      "regulation_excerpt": "A financial adviser shall not make a false or misleading statement...",
      "source_document_id": "uuid",
      "source_document_title": "MAS FAA-N16",
      "chunk_index": 3,
      "verdict": "VIOLATION",
      "confidence": 0.92
    }
  ],
  "suggestions": [...]
}
```

---

## 11. Phasing & Priorities

| Phase | Scope | Backend | Frontend | Effort |
|---|---|---|---|---|
| **1 — Document Library UX** | TanStack Query migration, content preview, stats strip, filter pills, search, delete confirmation, view dialog, empty state | None | `compliance/documents/page.tsx` | Small |
| **2 — Chunking & Embeddings** | Upload triggers chunking + embedding. Show chunk count in UI. | `compliance_service.py`, `rag_service.py` (new), migration | Update card to show chunk count | Medium |
| **3 — RAG Scoring** | Whole-artifact scorer uses retrieved chunks. Score breakdown shows regulatory citations. | `compliance_scorer.py`, `rag_service.py` | `score-breakdown.tsx` (add RAG findings section) | Medium |
| **4 — RAG in Per-Field** | Inline field checker retrieves chunks for LLM layer. Better `mas_basis` citations. | `field_compliance_service.py` | `field-compliance-warning.tsx` (richer citations) | Small |
| **5 — Dynamic Disclaimers** | Disclaimer checker reads from DB instead of hardcoded dict. | `disclaimer_service.py` | None (transparent) | Small |
| **6 — Cross-Feature RAG** | Rule suggestion, copy generation, and export gate use retrieved context. | Multiple services | Score breakdown drill-down | Medium |

**Recommendation:** Phase 1 can ship immediately (frontend-only). Phase 2–3 require pgvector extension activation and the embedding model. Phase 4–6 build incrementally on the RAG foundation.

---

## 12. Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Document library has regulatory coverage | ≥ 3 MAS regulations, ≥ 2 product fact sheets, ≥ 1 disclaimer template uploaded | Count by `document_type` |
| RAG improves scoring accuracy | False positive rate < 15% (vs. current ~25% from keyword matching) | Manual audit of 50 scored artifacts before/after RAG |
| Per-field flag specificity | ≥ 60% of flags include a specific MAS paragraph reference (vs. generic "FAA-N16" today) | Sample flags, check `mas_basis` specificity |
| Compliance flag rate on first draft | < 20% of generated copy triggers flags | Telemetry: `compliance_flag_surfaced` / `compliance_check_field_called` |
| Admin effort to add new product disclaimers | 0 code deployments (all via document upload) | Operational tracking |

---

## 13. Open Questions

| # | Question | Context |
|---|---|---|
| 1 | Should we support PDF/Word file upload in addition to pasted text? | Current upload is paste-only. File upload would need server-side text extraction (PyPDF2, python-docx). Adds complexity but improves admin workflow for long regulatory documents. |
| 2 | Should RAG retrieval be synchronous (blocking the score response) or async (score first with rules only, update later with RAG findings)? | Synchronous is simpler but adds 1–2s latency. Async gives faster initial scores but the breakdown updates after a delay. |
| 3 | Should the export gate (score < 70 blocks export) be shipped with Phase 3 or deferred? | Currently spec'd in Phase E (doc 08) but not implemented. Blocking exports is high-stakes — needs careful rollout. |
| 4 | How do we handle document versioning when a regulation is updated? | Option A: delete old, upload new (simple but loses history). Option B: version chain via `source_document_id` (complex but auditable). |
| 5 | Should we expose the document library to non-admin roles (read-only) so creators can look up regulations themselves? | Currently `BRAND_ADMIN` only. Opening read access to leaders and creators could help with self-service compliance understanding. |
| 6 | What embedding model should we use? | Spec says Google `text-embedding-004` (768 dims). Alternatives: OpenAI `text-embedding-3-small` (1536 dims, higher quality but external dependency). Google stays within the existing Gemini/Vertex AI footprint. |
