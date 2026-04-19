# Compliance Document Library & RAG-Powered Scoring

Planning package for transforming the compliance engine from a pattern matcher into a regulation-aware AI reviewer.

**PRD:** `.claude/specs/COMPLIANCE_DOCUMENTS_PRD.md`

## Phases

| Doc | Phase | Status |
|---|---|---|
| `01-document-library-ux.md` | Phase 1 — Document Library UX (TanStack Query migration) | Shipped |
| `02-pdf-upload.md` | Phase 1b — PDF/DOCX File Upload (plain text extraction) | Shipped |
| `02b-markdown-file-storage.md` | Phase 1c — Markdown Extraction + Original File Storage | Shipped |
| `03-chunking-embeddings.md` | Phase 2 — Chunking & Embedding Pipeline (pgvector) | Ready |
| `04-rag-scoring.md` | Phase 3 — RAG-Powered Whole-Artifact Scoring | Blocked on Phase 2 |
| `05-per-field-rag.md` | Phase 4 — Per-Field Inline RAG | Blocked on Phase 2 |
| `06-dynamic-disclaimers.md` | Phase 5 — Dynamic Disclaimers from DB | Ready |
| `07-cross-feature-rag.md` | Phase 6 — Cross-Feature RAG Integration | Blocked on Phase 3 |

## Dependency Graph

```
Phase 1 (shipped) ──→ Phase 1b (shipped) ──→ Phase 1c (Markdown + file storage)
Phase 1c ──→ Phase 2 (Chunking) ──┬──→ Phase 3 (RAG Scoring) ──→ Phase 6 (Cross-Feature)
                                   └──→ Phase 4 (Per-Field RAG)
Phase 5 (Dynamic Disclaimers) ── standalone, can parallel with any phase
```

## Infrastructure Prerequisites

- **pgvector extension** in PostgreSQL (Phase 2+)
- **Google text-embedding-004** via existing Vertex AI client (Phase 2+)
- **pypdf + python-docx** Python packages (Phase 1b, shipped)
- **pymupdf4llm** for structured PDF→Markdown extraction (Phase 1c)
- **react-markdown** for frontend markdown rendering (Phase 1c)
- **langchain-text-splitters** already in requirements.txt (Phase 2)
