# 02b — Markdown Extraction + Original File Storage (Phase 1c)

**Status:** Shipped  
**Dependencies:** Phase 1b (PDF upload endpoint exists)  
**Effort:** Medium

---

## Why

The current PDF upload extracts plain text and discards the original file. Two problems:

1. **Plain text loses document structure.** A 50-page MAS regulation has headings, numbered sections, tables, and bold emphasis — all of which disappear in plain text. When this text is chunked for RAG (Phase 2), the chunks have no structural context. Markdown preserves this structure, producing better embeddings and more useful LLM context.

2. **Original file is discarded.** The admin can't download what they uploaded. There's no audit trail of the source document, and if the extraction was imperfect, there's no way to re-extract later.

---

## Design Decisions

### Why markdown over HTML?
- Markdown is token-efficient for LLMs (no closing tags, no attributes)
- Markdown renders beautifully in a frontend component with `react-markdown`
- Markdown chunks better than HTML (headings create natural split points)
- The RAG embeddings in Phase 2 work better on markdown than raw HTML

### Why `pymupdf4llm` over `pypdf`?
- `pypdf` extracts flat text — no structure, no headings, no tables
- `pymupdf4llm` is purpose-built for this exact use case: producing LLM-ready markdown from PDFs
- Preserves: headings (→ `#`/`##`/`###`), bold/italic (→ `**`/`*`), tables (→ markdown tables), lists (→ `- `/`1. `)
- Already handles multi-column layouts, headers/footers, page breaks

### Content column strategy
- Keep using the single `content` column — store markdown there (it's the content the system reads)
- The `content_preview` property (first 200 chars) still works on markdown
- For paste mode, the text goes straight into `content` as-is (user may paste plain text or markdown)
- No need for a separate `markdown_content` column — markdown IS the content

---

## Backend

### 1. New dependency: `pymupdf4llm`

Add to `backend/requirements.txt`:
```
pymupdf4llm>=0.0.17
```

This pulls in `pymupdf` (fitz) as a dependency. Can replace `pypdf` entirely since pymupdf handles text extraction too, but keep `pypdf` as fallback.

### 2. Add `file_url` column — migration

New migration: `backend/alembic/versions/<new>_add_document_file_url.py`

```sql
ALTER TABLE compliance_documents ADD COLUMN file_url VARCHAR(500);
ALTER TABLE compliance_documents ADD COLUMN original_filename VARCHAR(500);
ALTER TABLE compliance_documents ADD COLUMN file_size INTEGER;
```

All nullable — existing documents and paste-mode uploads won't have a file.

### 3. Update model: `backend/app/models/compliance_document.py`

Add three columns:
```python
file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
original_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

### 4. Update schemas: `backend/app/schemas/compliance.py`

Add to `ComplianceDocumentResponse`:
```python
file_url: str | None = None
original_filename: str | None = None
file_size: int | None = None
```

Add to `ComplianceDocumentDetailResponse`:
```python
file_url: str | None = None
original_filename: str | None = None
file_size: int | None = None
```

### 5. Rewrite parser: `backend/app/services/document_parser.py`

Replace `_extract_pdf()` with markdown extraction:

```python
def _extract_pdf_markdown(data: bytes) -> str:
    import pymupdf4llm
    import pymupdf
    doc = pymupdf.open(stream=data, filetype="pdf")
    md = pymupdf4llm.to_markdown(doc)
    doc.close()
    return md
```

For DOCX, enhance `_extract_docx()` to produce markdown:

```python
def _extract_docx_markdown(data: bytes) -> str:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document(BytesIO(data))
    lines = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            lines.append("")
            continue
        style = para.style.name.lower()
        if "heading 1" in style:
            lines.append(f"# {text}")
        elif "heading 2" in style:
            lines.append(f"## {text}")
        elif "heading 3" in style:
            lines.append(f"### {text}")
        elif "heading" in style:
            lines.append(f"#### {text}")
        elif "list" in style or "bullet" in style:
            lines.append(f"- {text}")
        else:
            # Preserve bold/italic from runs
            formatted = _format_runs(para.runs)
            lines.append(formatted)
    return "\n\n".join(lines)


def _format_runs(runs) -> str:
    parts = []
    for run in runs:
        text = run.text
        if not text:
            continue
        if run.bold and run.italic:
            text = f"***{text}***"
        elif run.bold:
            text = f"**{text}**"
        elif run.italic:
            text = f"*{text}*"
        parts.append(text)
    return "".join(parts)
```

Rename the main function for clarity:

```python
async def extract_content_from_file(data: bytes, content_type: str) -> str:
    """Extract structured markdown from a file. Falls back to plain text."""
```

Keep `text/plain` as-is (plain text passthrough).

### 6. Update upload endpoint: `backend/app/api/compliance.py`

In `upload_compliance_document_file()`:

1. Extract markdown from file (existing step, now produces markdown)
2. **NEW:** Store original file via `upload_service.upload_file()`
3. Create document with `content=markdown`, `file_url`, `original_filename`, `file_size`

```python
from app.services.upload_service import upload_image_bytes  # reuse bytes upload

@router.post("/documents/upload-file", ...)
async def upload_compliance_document_file(...):
    # ... validation unchanged ...
    data = await file.read()
    content = await extract_content_from_file(data, file.content_type)
    
    # Store original file
    ext = Path(file.filename or "doc").suffix or ".bin"
    file_url = await _store_document_file(data, ext)
    
    doc = await upload_document(
        db,
        UploadDocumentRequest(title=title, content=content, document_type=document_type),
    )
    # Update with file metadata
    doc.file_url = file_url
    doc.original_filename = file.filename
    doc.file_size = len(data)
    await db.flush()
    
    return ComplianceDocumentResponse.model_validate(doc)
```

For file storage, use the existing local/S3 pattern:

```python
async def _store_document_file(data: bytes, ext: str) -> str:
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = Path(__file__).parent.parent.parent / "uploads" / "documents"
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / filename
    await asyncio.to_thread(path.write_bytes, data)
    return f"/uploads/documents/{filename}"
```

### 7. Add download endpoint: `backend/app/api/compliance.py`

```python
from fastapi.responses import FileResponse

@router.get("/documents/{doc_id}/download")
async def download_compliance_document(
    doc_id: uuid.UUID,
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    doc = await get_document(db, doc_id)
    if not doc.file_url:
        raise HTTPException(status_code=404, detail="No file attached to this document")
    file_path = Path(__file__).parent.parent.parent / doc.file_url.lstrip("/")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=str(file_path),
        filename=doc.original_filename or f"document{file_path.suffix}",
        media_type="application/octet-stream",
    )
```

---

## Frontend

### 1. Add `react-markdown`

```bash
cd frontend && npm install react-markdown
```

### 2. Update TypeScript types: `frontend/src/lib/api/compliance.ts`

Add to `ComplianceDocument`:
```typescript
file_url: string | null;
original_filename: string | null;
file_size: number | null;
```

Add to `ComplianceDocumentDetail`:
```typescript
file_url: string | null;
original_filename: string | null;
file_size: number | null;
```

### 3. Update View dialog: render markdown

In `ViewDocumentDialog`, replace the plain text box:

```tsx
import ReactMarkdown from "react-markdown";

// Replace:
//   <Box sx={{ whiteSpace: "pre-wrap" }}>{doc.content}</Box>
// With:
<Box sx={{ "& h1": { fontSize: 18, fontWeight: 700, mt: 2, mb: 1 },
           "& h2": { fontSize: 16, fontWeight: 600, mt: 2, mb: 1 },
           "& h3": { fontSize: 14, fontWeight: 600, mt: 1.5, mb: 0.5 },
           "& p": { fontSize: 13, lineHeight: 1.7, mb: 1 },
           "& ul, & ol": { pl: 2.5, fontSize: 13 },
           "& table": { borderCollapse: "collapse", width: "100%", fontSize: 12 },
           "& th, & td": { border: "1px solid #E8EAED", px: 1, py: 0.5 },
           "& strong": { fontWeight: 600 },
}}>
  <ReactMarkdown>{doc.content}</ReactMarkdown>
</Box>
```

### 4. Add download button on document cards

On each card, if `doc.file_url` is set, show a download icon button:

```tsx
{doc.file_url && (
  <Button
    href={`${API_BASE}/api/compliance/documents/${doc.id}/download`}
    component="a"
    size="small"
    sx={{ ... }}
  >
    Download
  </Button>
)}
```

Or use `window.open()` with the auth token in a query param (since download is a GET with auth).

Better approach: use `apiClient` to fetch as blob and trigger browser download:

```typescript
export async function downloadDocument(id: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const resp = await fetch(`${API_BASE_URL}/api/compliance/documents/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Download failed");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 5. Show file info on cards

If `doc.original_filename` is set, show it on the card metadata line:
```
MAS Regulation · FAA-N16.pdf (2.4 MB) · 17 Apr 2026
```

---

## Files to Modify

| File | Change |
|---|---|
| `backend/requirements.txt` | Add `pymupdf4llm>=0.0.17` |
| `backend/alembic/versions/` | New migration: `file_url`, `original_filename`, `file_size` columns |
| `backend/app/models/compliance_document.py` | Add 3 nullable columns |
| `backend/app/schemas/compliance.py` | Add 3 fields to both response schemas |
| `backend/app/services/document_parser.py` | Replace `_extract_pdf` with `_extract_pdf_markdown`. Enhance `_extract_docx` to produce markdown. Rename main fn. |
| `backend/app/api/compliance.py` | Store original file in upload endpoint. Add `GET /documents/{doc_id}/download`. |
| `frontend/package.json` | Add `react-markdown` |
| `frontend/src/lib/api/compliance.ts` | Add `file_url`, `original_filename`, `file_size` to types. Add `downloadDocument()`. |
| `frontend/src/app/(authenticated)/compliance/documents/page.tsx` | Markdown rendering in View dialog. Download button on cards. File info in metadata. |

---

## Content flow after this change

```
Admin uploads MAS_FAA-N16.pdf (2.4 MB)
         ↓
Backend:
  1. Store original file → /uploads/documents/{uuid}.pdf
  2. pymupdf4llm extracts structured markdown:
       # MAS Notice FAA-N16
       ## 4. Recommendations on Conduct of Business
       ### 4.2 Advertising
       A financial adviser **shall not** make a false or misleading
       statement in any advertisement...
  3. Store in compliance_documents:
       content = markdown text
       file_url = /uploads/documents/{uuid}.pdf
       original_filename = MAS_FAA-N16.pdf
       file_size = 2457600
         ↓
Frontend:
  - Card shows: "MAS Regulation · FAA-N16.pdf (2.4 MB) · 17 Apr 2026"
  - View dialog renders formatted markdown (headings, bold, tables)
  - Download button fetches original PDF
         ↓
Phase 2 (later):
  - Chunking splits on markdown headings (natural section boundaries)
  - Embeddings capture structured passages, not flat text
  - RAG retrieval returns sections with their heading context
```

---

## Verification

1. Upload a PDF → content in DB is markdown with `#` headings and `**bold**`
2. View dialog renders formatted content (headings are large, bold is bold)
3. Download button fetches the original PDF file
4. Upload a DOCX → headings preserved as markdown `#`/`##`
5. Paste text mode still works (plain text stored as-is, rendered with pre-wrap fallback)
6. Card metadata shows original filename + file size when file was uploaded
7. Delete a document → original file is also deleted from disk
8. Existing documents (pre-migration, no file_url) still display correctly
