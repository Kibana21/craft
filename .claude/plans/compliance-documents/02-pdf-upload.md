# 02 — PDF/DOCX File Upload (Phase 1b)

**Status:** Shipped  
**Dependencies:** None  
**Effort:** Small–Medium

---

## Why

Compliance admins have MAS regulation PDFs on their desktops. Requiring them to copy-paste text from a PDF into a textarea is friction that reduces library coverage. A file upload with automatic text extraction removes this barrier.

---

## Backend

### New dependencies

Add to `backend/requirements.txt`:
```
pypdf>=4.0.0
python-docx>=0.8.11
```

Then `pip install pypdf python-docx`.

### New service: `backend/app/services/document_parser.py`

Single function:

```python
async def extract_text_from_file(data: bytes, content_type: str) -> str
```

| MIME type | Library | Extraction |
|---|---|---|
| `application/pdf` | `pypdf.PdfReader(BytesIO(data))` | `page.extract_text()` for all pages, joined with `\n`. Via `asyncio.to_thread()`. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `docx.Document(BytesIO(data))` | `paragraph.text` for all paragraphs, joined with `\n`. Via `asyncio.to_thread()`. |
| `text/plain` | Built-in | `data.decode("utf-8")` |
| Anything else | — | `HTTPException(400, detail="Unsupported file type. Upload a PDF, DOCX, or plain text file.")` |

If extracted text is empty or whitespace-only: `HTTPException(400, detail="Could not extract text from file. The document may be scanned or image-only.")`.

### New endpoint: `backend/app/api/compliance.py`

`POST /api/compliance/documents/upload-file` — multipart form data.

```python
ALLOWED_DOC_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
MAX_DOC_SIZE = 50 * 1024 * 1024  # 50 MB

@router.post("/documents/upload-file", response_model=ComplianceDocumentResponse, status_code=201)
async def upload_compliance_document_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    document_type: DocumentType = Form(...),
    _current_user: User = Depends(require_brand_admin),
    db: AsyncSession = Depends(get_db),
) -> ComplianceDocumentResponse:
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type...")
    data = await file.read()
    if len(data) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50 MB.")
    content = await extract_text_from_file(data, file.content_type)
    if len(content.strip()) < 10:
        raise HTTPException(status_code=400, detail="Could not extract enough text...")
    doc = await upload_document(db, UploadDocumentRequest(
        title=title, content=content, document_type=document_type,
    ))
    return ComplianceDocumentResponse.model_validate(doc)
```

**Route ordering:** This endpoint MUST be registered BEFORE `GET /documents/{doc_id}`, otherwise FastAPI parses `"upload-file"` as a UUID path parameter. Place it right after the existing `POST /documents` endpoint.

### Existing endpoint unchanged

`POST /api/compliance/documents` (JSON body with pasted text) continues to work. Two upload paths coexist.

---

## Frontend

### New API function: `frontend/src/lib/api/compliance.ts`

```typescript
export async function uploadDocumentFile(
  file: File,
  title: string,
  document_type: string,
): Promise<ComplianceDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("document_type", document_type);
  return apiClient.upload<ComplianceDocument>(
    "/api/compliance/documents/upload-file",
    formData,
  );
}
```

Uses existing `apiClient.upload()` (handles FormData + JWT + 401 retry).

### Upload form enhancement: `frontend/src/app/(authenticated)/compliance/documents/page.tsx`

Add a toggle at the top of the upload form card:

```
[Upload file]  [Paste text]
```

Two pill buttons (same `pillSx` style as filter bar). State: `uploadMode: "file" | "paste"`.

**File upload mode:**
- Drop zone: dashed border box, drag-and-drop + click-to-browse
- Hidden `<input type="file" accept=".pdf,.docx,.txt">` triggered by drop zone click
- On drop/select: show file name + size + remove (x) button
- Title field: pre-filled from filename (strip extension)
- Document type select
- Upload button → `useMutation` calling `uploadDocumentFile()`
- On drag over: highlight border colour (#D0103A)

**Paste text mode (existing — unchanged):**
- Title field, document type select, textarea with character count
- Upload button → `useMutation` calling `uploadDocument()`

Both modes share `onSuccess` → invalidate `complianceDocuments`, reset form, close form.

### Drop zone wireframe

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                                                     │
│     [doc icon]  Drop a PDF or Word document here                   │
│                 or click to browse                                  │
│                 Supported: .pdf, .docx, .txt · Max 50 MB          │
│                                                                     │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

After file selected:
┌─────────────────────────────────────────────────────────────────────┐
│  [doc icon]  MAS_Notice_FAA-N16.pdf  (2.4 MB)                [×]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Change |
|---|---|
| `backend/requirements.txt` | Add `pypdf>=4.0.0`, `python-docx>=0.8.11` |
| `backend/app/services/document_parser.py` | **New file.** `extract_text_from_file()` |
| `backend/app/api/compliance.py` | Add `POST /documents/upload-file` multipart endpoint (before GET /{doc_id}) |
| `frontend/src/lib/api/compliance.ts` | Add `uploadDocumentFile()` |
| `frontend/src/app/(authenticated)/compliance/documents/page.tsx` | Add upload mode toggle + drop zone + file mutation |

---

## Verification

1. Upload a PDF → text extracted → document appears in list with content preview
2. Upload a DOCX → same flow
3. Upload a .txt → same flow
4. Upload a .jpg → 400 "Unsupported file type"
5. Upload a 60 MB file → 400 "File too large"
6. Upload a scanned PDF (no extractable text) → 400 "Could not extract text"
7. Paste text mode still works unchanged
8. Title pre-fills from filename (without extension)
9. Drag-and-drop works (border highlights on drag over)
10. File can be removed (×) before uploading
