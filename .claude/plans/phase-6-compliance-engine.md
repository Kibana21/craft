# Phase 6: Compliance Engine (Rules, Scoring, RAG, Review Queue)

**Goal:** MAS compliance rules management, RAG pipeline for document retrieval, automatic scoring of every artifact, and brand admin review queue.

**User stories:** US-016 (rules engine), US-017 (scoring), US-018 (review queue)

**Dependencies:** Phase 5 (artifacts with content to score), Phase 4 (library items for review queue)

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/compliance.py` | `POST /api/compliance/rules` (create), `GET /api/compliance/rules` (list), `PATCH /api/compliance/rules/{id}` (update/deactivate), `POST /api/compliance/documents` (upload for RAG), `GET /api/compliance/documents` (list), `DELETE /api/compliance/documents/{id}`, `POST /api/compliance/score/{artifact_id}` (manual re-score), `GET /api/compliance/score/{artifact_id}` (get breakdown) |
| `backend/app/api/review_queue.py` | `GET /api/compliance/review-queue` (pending library items + low-score artifacts), `POST /api/compliance/review-queue/{id}/action` (approve/reject/request-changes) |
| `backend/app/api/notifications.py` | `GET /api/notifications` (list for user), `PATCH /api/notifications/{id}/read` (mark read) |
| `backend/app/schemas/compliance.py` | `CreateRuleRequest(rule_text, category, severity)`, `ComplianceRuleResponse`, `UploadDocumentRequest(title, document_type, content)`, `ComplianceScoreResponse(score, breakdown: list[RuleResult], rag_findings: list[RAGFinding], suggestions: list[str])`, `RuleResult(rule_id, rule_text, passed, severity, details)`, `RAGFinding(claim, relevant_chunks, verdict, confidence)` |
| `backend/app/schemas/review_queue.py` | `ReviewQueueItemResponse(id, type, artifact, creator, compliance_score, flagged_rules, submitted_at)`, `ReviewActionRequest(action, reason?)` |
| `backend/app/models/compliance_check.py` | ComplianceCheck: id, artifact_id (FK), score, breakdown (JSON), checked_at — audit trail |
| `backend/app/models/export_log.py` | ExportLog: id, artifact_id (FK), user_id (FK), format, compliance_score, exported_at — audit trail |
| `backend/app/models/notification.py` | Notification: id, user_id (FK), type, title, message, data (JSON), read (bool), created_at |
| `backend/app/services/compliance_service.py` | `create_rule(user, data)`, `list_rules(active_only)`, `update_rule(user, rule_id, data)`, `upload_document(user, file_or_text, metadata)` — chunks at ~512 tokens, generates embeddings, stores with pgvector. |
| `backend/app/services/compliance_scorer.py` | **Main scoring pipeline** (see below) |
| `backend/app/services/rag_service.py` | `embed_text(text)` — text-embedding-004 from Google (768 dims). `chunk_document(text, chunk_size=512)` — split with 50-token overlap. `retrieve_relevant(query, top_k=5)` — pgvector cosine similarity (`<=>`). `fact_check_claims(claims, retrieved_chunks)` — Gemini compares claims against MAS regulations. |
| `backend/app/services/disclaimer_service.py` | `get_required_disclaimers(product_type)` — returns list per product. `check_disclaimers(artifact_content, product_type)` — verifies presence. `auto_insert_disclaimers(artifact_content, product_type)` — inserts missing. |
| `backend/app/services/review_queue_service.py` | `get_review_queue(user)` — pending library items + artifacts score < 70% in team projects. `process_review_action(user, item_id, action, reason)`. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/compliance/rules/page.tsx` | Admin: list rules with create/edit/deactivate |
| `frontend/src/app/(authenticated)/compliance/documents/page.tsx` | Admin: upload MAS documents, list, delete |
| `frontend/src/app/(authenticated)/compliance/review/page.tsx` | Admin: review queue with approve/reject/request-changes |
| `frontend/src/components/compliance/rule-form.tsx` | Create/edit: rule text, category dropdown, severity radio |
| `frontend/src/components/compliance/document-upload.tsx` | Upload: file or paste text, title, document type selector |
| `frontend/src/components/compliance/score-breakdown.tsx` | Detailed: overall score, rules passed/failed, RAG findings, fix suggestions. Shown on clicking compliance badge. |
| `frontend/src/components/compliance/review-queue-item.tsx` | Single queue item: artifact preview, creator, score, flagged rules, action buttons |
| `frontend/src/components/compliance/disclaimer-notice.tsx` | Notice in artifact editor when disclaimers auto-inserted |
| `frontend/src/components/notifications/notification-bell.tsx` | Bell icon in nav, unread count, dropdown of recent notifications |
| `frontend/src/lib/api/compliance.ts` | `createRule(data)`, `fetchRules()`, `updateRule(id, data)`, `uploadDocument(data)`, `fetchDocuments()`, `scoreArtifact(artifactId)`, `fetchScoreBreakdown(artifactId)` |
| `frontend/src/lib/api/review-queue.ts` | `fetchReviewQueue()`, `submitReviewAction(id, action, reason)` |
| `frontend/src/lib/api/notifications.ts` | `fetchNotifications()`, `markNotificationRead(id)` |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/compliance/rules` | brand_admin | Create rule |
| GET | `/api/compliance/rules` | brand_admin | List rules |
| PATCH | `/api/compliance/rules/{id}` | brand_admin | Update/deactivate |
| POST | `/api/compliance/documents` | brand_admin | Upload document for RAG |
| GET | `/api/compliance/documents` | brand_admin | List documents |
| DELETE | `/api/compliance/documents/{id}` | brand_admin | Delete document |
| POST | `/api/compliance/score/{artifact_id}` | Any | Trigger re-score |
| GET | `/api/compliance/score/{artifact_id}` | Member | Get score breakdown |
| GET | `/api/compliance/review-queue` | brand_admin | List review queue |
| POST | `/api/compliance/review-queue/{id}/action` | brand_admin | Approve/reject/request changes |
| GET | `/api/notifications` | Any | List notifications |
| PATCH | `/api/notifications/{id}/read` | Any | Mark read |

## Scoring pipeline (`compliance_scorer.py`)

```
score_artifact(artifact_id):
  1. Extract all text from artifact content JSON (headline, message, tagline)
  2. Run each active compliance rule against extracted text
     - Pattern matching for simple rules
     - Gemini-assisted for complex rules (e.g., "does this imply guaranteed returns?")
  3. RAG query:
     a. Embed the artifact text
     b. Retrieve top-5 relevant chunks from compliance_documents via pgvector
     c. Use Gemini to fact-check claims against retrieved MAS regulations
  4. Check required disclaimers based on product type
  5. Compute score: 100 minus deductions
  6. Store score + breakdown on artifact record + compliance_check audit table
  7. Return full breakdown
```

## Scoring formula

| Violation | Deduction |
|---|---|
| Error rule failed | -15 per rule |
| Warning rule failed | -5 per rule |
| Missing required disclaimer | -20 per disclaimer |
| RAG-identified false claim | -10 per claim |
| Floor | 0 (never negative) |

## Disclaimer mapping (seeded)

| Product | Required disclaimers |
|---|---|
| PAA | "This is not a contract of insurance...", "Benefits are subject to policy terms..." |
| HealthShield | "Pre-existing conditions may apply...", "Subject to policy terms and conditions..." |
| AIA Vitality | "Rewards are subject to availability and partner terms..." |
| PRUWealth | "Past performance is not indicative of future results...", "Investment risks apply..." |
| General | "This advertisement has not been reviewed by MAS..." |

## Key implementation details

- Scoring is async: `create_artifact` / `update_artifact` triggers via `BackgroundTasks`. Artifact initially `compliance_score=None` ("Scoring..." UI), updated on completion.
- RAG pipeline: Google `text-embedding-004` model (768 dimensions). Retrieval via pgvector `<=>` cosine distance operator. Top 5 chunks passed to Gemini with artifact text for fact-checking.
- Latency target: under 3 seconds per score (most time in embedding + Gemini calls).
- Rules and documents are versioned — changes don't retroactively affect published artifacts.
- Export blocking: artifact detail response includes score. Frontend disables export when score < 70. Backend validates at export time (Phase 7).
- FSCs see score + fix suggestions but NOT the raw rules engine (no access to compliance admin pages).
- Review queue shows two types: pending library items (need approval before publishing) and low-score artifacts in team projects (flagged for leader/admin attention).

## Verification

- Brand admin creates compliance rule → rule appears in list
- Brand admin uploads MAS document → chunked, embedded, stored
- Create artifact → compliance score computed asynchronously → score appears on artifact card
- Click score badge → breakdown shows: rules passed/failed, RAG findings, suggestions
- Score < 70% → export button disabled with "Resolve compliance errors" message
- Brand admin sees review queue with pending items
- Admin approves/rejects → status updates, creator gets notification
- `pytest` passes
- `mypy app/` passes
