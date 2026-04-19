# 03 — Chunking & Embedding Pipeline (Phase 2)

**Status:** Ready  
**Dependencies:** Phase 1 backend (shipped)  
**Effort:** Medium  
**Prerequisite:** pgvector extension installed in PostgreSQL

---

## Why

Documents need to be chunked and embedded for semantic retrieval. A 50-page MAS regulation is too large for a single LLM prompt — chunking creates focused passages that can be matched against specific marketing claims via cosine similarity.

---

## Infrastructure Prerequisite

pgvector must be installed in the PostgreSQL server. Check with:
```sql
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

If not available, install via `apt-get install postgresql-16-pgvector` (Linux) or `brew install pgvector` (macOS). The extension is already in `requirements.txt` as the Python client (`pgvector==0.3.6`).

---

## Backend

### 1. Migration: `backend/alembic/versions/<new>_add_pgvector_embeddings.py`

```python
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "<generated>"
down_revision = "e1f2a3b4c5d6"  # current HEAD

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column("compliance_documents", sa.Column("embedding", Vector(768), nullable=True))
    op.create_index(
        "idx_compliance_documents_embedding",
        "compliance_documents",
        ["embedding"],
        postgresql_using="ivfflat",
        postgresql_with={"lists": 100},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

def downgrade():
    op.drop_index("idx_compliance_documents_embedding")
    op.drop_column("compliance_documents", "embedding")
    op.execute("DROP EXTENSION IF EXISTS vector")
```

### 2. Model: `backend/app/models/compliance_document.py`

Replace the commented-out embedding line:
```python
from pgvector.sqlalchemy import Vector

embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
```

### 3. New service: `backend/app/services/rag_service.py`

```python
import asyncio
import logging
from io import BytesIO

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance_document import ComplianceDocument

logger = logging.getLogger(__name__)
```

#### `embed_text(text: str) -> list[float]`
- Uses `_get_vertex_client()` from `ai_service.py` (cached singleton)
- Calls `client.models.embed_content(model="text-embedding-004", contents=text)`
- Wraps in `asyncio.to_thread()` (the embed call is synchronous)
- Returns 768-dim float list
- ~50–100ms per call

#### `chunk_document(text: str, chunk_size=2000, overlap=200) -> list[str]`
- Uses `RecursiveCharacterTextSplitter` from `langchain-text-splitters` (already in requirements)
- `separators=["\n\n", "\n", ". ", " ", ""]`
- chunk_size in characters (~512 tokens at 4 chars/token)
- Returns list of chunk strings
- Synchronous, fast

#### `retrieve_relevant(db: AsyncSession, query_text: str, top_k: int = 5) -> list[ComplianceDocument]`
- Embeds `query_text` via `embed_text()`
- pgvector cosine similarity: `ComplianceDocument.embedding.cosine_distance(query_embedding)`
- Filters `WHERE embedding IS NOT NULL`
- Returns top-k most similar chunks

### 4. Modify `upload_document()` in `backend/app/services/compliance_service.py`

After storing the source doc (chunk_index=0):
1. Embed the source doc (first 2000 chars) — for short-doc retrieval
2. `chunks = chunk_document(content)`
3. If `len(chunks) > 1`: for each chunk, `embed_text()` → store as child row with `source_document_id = source_doc.id`, `chunk_index = 1, 2, 3...`
4. Embedding failures logged but non-fatal (document still saved without embeddings)

### 5. Modify `delete_document()` in `backend/app/services/compliance_service.py`

Before deleting the source doc, cascade delete all child chunks:
```python
chunks = (await db.execute(
    select(ComplianceDocument).where(ComplianceDocument.source_document_id == doc_id)
)).scalars().all()
for chunk in chunks:
    await db.delete(chunk)
```

### 6. Modify `list_documents()` return type

Return `(doc, chunk_count)` tuples using a subquery:
```python
from sqlalchemy import func

chunk_counts = (
    select(
        ComplianceDocument.source_document_id,
        func.count().label("chunk_count"),
    )
    .where(ComplianceDocument.source_document_id.isnot(None))
    .group_by(ComplianceDocument.source_document_id)
    .subquery()
)
```

### 7. Schema: `backend/app/schemas/compliance.py`

Add `chunk_count: int = 0` to `ComplianceDocumentResponse`.

### 8. API: `backend/app/api/compliance.py`

Update list handler to construct response with chunk count from the `(doc, count)` tuples.

---

## Frontend

### `frontend/src/lib/api/compliance.ts`
Add `chunk_count: number` to `ComplianceDocument` interface.

### `frontend/src/app/(authenticated)/compliance/documents/page.tsx`
Show on card metadata line: `{doc.content_preview.length.toLocaleString()} chars` + `{doc.chunk_count > 0 ? ` · ${doc.chunk_count} chunks` : ""}`.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/alembic/versions/` | New migration: `CREATE EXTENSION vector` + embedding column + ivfflat index |
| `backend/app/models/compliance_document.py` | Uncomment embedding column (Vector 768) |
| `backend/app/services/rag_service.py` | **New file** — `embed_text()`, `chunk_document()`, `retrieve_relevant()` |
| `backend/app/services/compliance_service.py` | Modify `upload_document()` for chunking + embedding. Modify `delete_document()` for cascade. Modify `list_documents()` for chunk count. |
| `backend/app/schemas/compliance.py` | Add `chunk_count: int = 0` to response |
| `backend/app/api/compliance.py` | Update list handler for chunk count |
| `frontend/src/lib/api/compliance.ts` | Add `chunk_count` to interface |
| `frontend/src/app/(authenticated)/compliance/documents/page.tsx` | Show chunk count on card |

---

## Verification

1. `make migrate` succeeds (pgvector extension + column created)
2. Upload a short doc (< 2000 chars) → chunk_count = 0, source doc has embedding
3. Upload a long doc (> 4000 chars) → chunk_count > 1, each chunk has embedding
4. `psql`: `SELECT id, chunk_index, source_document_id, embedding IS NOT NULL FROM compliance_documents`
5. Delete a doc → all child chunks cascade-deleted
6. List endpoint returns only source docs with chunk counts
7. Frontend card shows "9 chunks" label
