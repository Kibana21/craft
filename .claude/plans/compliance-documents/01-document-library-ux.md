# 01 — Document Library UX (Phase 1)

**Status:** Shipped

## What Was Built

Migrated the compliance documents page from the legacy `useEffect` + `setState` pattern to TanStack Query, matching the rules page quality bar.

### Backend Changes
- `backend/app/models/compliance_document.py` — Added `content_preview` property (first 200 chars of content)
- `backend/app/schemas/compliance.py` — Added `content_preview: str` and `source_document_id: uuid.UUID | None` to `ComplianceDocumentResponse`. Added `ComplianceDocumentDetailResponse` with full `content` field.
- `backend/app/services/compliance_service.py` — Added `get_document(db, doc_id)` for detail fetch. Modified `list_documents()` to filter `source_document_id IS NULL` (exclude chunks).
- `backend/app/api/compliance.py` — Added `GET /api/compliance/documents/{doc_id}` detail endpoint returning `ComplianceDocumentDetailResponse`.

### Frontend Changes
- `frontend/src/lib/api/compliance.ts` — Updated `ComplianceDocument` interface with `content_preview`, `source_document_id`. Added `ComplianceDocumentDetail` type. Added `fetchDocumentDetail()`.
- `frontend/src/lib/query-keys.ts` — Added `complianceDocumentDetail(docId)` key.
- `frontend/src/app/(authenticated)/compliance/documents/page.tsx` — Full rewrite:
  - TanStack Query (`useQuery` + `useMutation`)
  - Stats strip: X documents · Y MAS Regulations · Z Fact Sheets
  - Filter pills by `document_type` (client-side)
  - Search by title (client-side)
  - Content preview on each card (2-line clamp)
  - View full content dialog (fetches detail endpoint)
  - Delete confirmation dialog
  - Character count in upload form
  - Colour-coded doc type badges (blue/green/amber)
  - Meaningful empty state
  - ErrorBanner pattern for stale-while-revalidate
