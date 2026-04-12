# Phase 2: Presenter Management

**Goal:** Presenter library CRUD, AI-generated appearance descriptions via Gemini, presenter form + library picker UI, and endpoint to assign a presenter to a `VideoSession`.

**AI enhancements (added post-Phase 7):** Two-step AI assist on the presenter form:
1. "Suggest with AI" button on the appearance keywords field — generates keyword suggestions from name + age range + speaking style (`POST /api/presenters/suggest-keywords`).
2. Existing "Generate description with AI" button — expands keywords into a full paragraph (`POST /api/presenters/generate-appearance`).
This eliminates the blank-page problem for users unfamiliar with appearance description writing.

**User stories:** US-005 (Presenter library CRUD API), US-006 (AI appearance generation), US-007 (Presenter form + library picker UI), US-008 (Assign presenter to video session)

**Dependencies:** Phase 1 (models must exist).

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/presenters.py` | New router. `GET /api/presenters` (list visible), `POST /api/presenters` (create), `GET /api/presenters/{id}` (detail), `PATCH /api/presenters/{id}` (update, own only), `DELETE /api/presenters/{id}` (soft-delete, own only), `POST /api/presenters/suggest-keywords` (AI keyword suggestions), `POST /api/presenters/generate-appearance` (AI description) |
| `backend/app/api/video_sessions.py` | New router. `PATCH /api/video-sessions/{id}/presenter` — assign or inline-create presenter |
| `backend/app/schemas/presenter.py` | `PresenterCreate` (name, age_range, appearance_keywords, full_appearance_description, speaking_style, is_library=True), `PresenterUpdate` (all optional), `PresenterResponse`, `GenerateAppearanceRequest` (appearance_keywords, speaking_style), `GenerateAppearanceResponse` (full_appearance_description), `SuggestKeywordsRequest` (name, age_range, speaking_style), `SuggestKeywordsResponse` (appearance_keywords) |
| `backend/app/schemas/video_session.py` (extend) | `AssignPresenterRequest` — either `{presenter_id}` for library reuse OR full presenter fields + `save_to_library: bool` for inline creation |
| `backend/app/services/presenter_service.py` | `list_for_user(user_id)` — returns own presenters + shared library (`is_library=True`). `create(user_id, data)`. `update(user_id, presenter_id, data)` — enforces creator-only. `soft_delete(user_id, presenter_id)`. `generate_appearance(keywords, speaking_style)` — delegates to ai_service. |
| `backend/app/services/video_session_service.py` (extend) | `assign_presenter(session_id, payload)` — branches on `presenter_id` vs inline; for inline, creates a `Presenter` (with `is_library` from `save_to_library`), assigns to session, updates `current_step = SCRIPT` |
| `backend/app/services/ai_service.py` (extend) | `generate_presenter_appearance(keywords, speaking_style) -> str` — calls Gemini with dedicated prompt. `suggest_appearance_keywords(name, age_range, speaking_style) -> str` — returns comma-separated keyword suggestions. |
| `backend/app/services/prompt_builder.py` (extend) | `build_presenter_appearance_prompt(keywords, speaking_style) -> str` — returns a prompt instructing Gemini to write a 2–4 sentence paragraph covering physical appearance, clothing, setting, and manner. `build_keyword_suggestion_prompt(name, age_range, speaking_style) -> str` — prompts for 6–10 comma-separated appearance keywords. |
| `backend/app/core/rbac.py` (reuse) | All endpoints use the existing `require_authenticated` dependency. Creator-ownership is enforced in the service layer. |
| `backend/app/main.py` (extend) | Register `presenters` and `video_sessions` routers |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/presenter/page.tsx` | Presenter step page: renders `PresenterForm` and `PresenterLibraryPicker` button, "Continue" saves and navigates to `/script` |
| `frontend/src/components/video/presenter-form.tsx` | Fields: Name, Age Range dropdown, Appearance Keywords input, Full Appearance Description textarea, Speaking Style dropdown. "Suggest with AI" button on keywords field (fills keywords from name+age+style). "Generate description with AI →" button (fills full description from keywords). "Save to library" checkbox. |
| `frontend/src/components/video/presenter-library-picker.tsx` | Modal listing user's + shared presenters; selecting one pre-fills the form without mutating the library entry |
| `frontend/src/lib/api/presenters.ts` | `listPresenters()`, `createPresenter(data)`, `updatePresenter(id, data)`, `deletePresenter(id)`, `generateAppearance(keywords, speaking_style)` |
| `frontend/src/lib/api/video-sessions.ts` | `assignPresenter(sessionId, payload)` (other methods stubbed for later phases) |
| `frontend/src/types/presenter.ts` | `Presenter`, `SpeakingStyle`, `AgeRange` types matching backend enums |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/presenters` | Authenticated | List user's own + shared library presenters |
| POST | `/api/presenters` | Authenticated | Create a presenter (`is_library` defaults true) |
| GET | `/api/presenters/{id}` | Authenticated | Fetch one (must be own or `is_library=true`) |
| PATCH | `/api/presenters/{id}` | Creator only | Update fields |
| DELETE | `/api/presenters/{id}` | Creator only | Soft-delete (sets `deleted_at`) |
| POST | `/api/presenters/generate-appearance` | Authenticated | Gemini writes a description from keywords + speaking_style |
| PATCH | `/api/video-sessions/{id}/presenter` | Project member | Assign existing presenter OR inline-create one; advances session step |

## Key implementation details

- **Visibility rule:** A user sees their own presenters (regardless of `is_library`) plus any `is_library=True` presenter from other users. Filter query: `(created_by_id == user_id) OR (is_library == True)` and `deleted_at IS NULL`.
- **Ownership on update/delete:** Only `created_by_id == user_id` can mutate. Enforce in service layer (raise `HTTPException(403)` otherwise).
- **Inline vs library save:** The `assign_presenter` endpoint handles both paths in one call to keep the UI flow simple. If `save_to_library=false`, the inline-created `Presenter` still goes into the table (needed for the FK from `VideoSession`) but with `is_library=False`, so it doesn't pollute the library picker.
- **Gemini prompt guardrails:** The appearance-generation prompt instructs the model to produce 2–4 sentences covering physical appearance, clothing/attire, setting/background, and manner — in prose, not bullet points. See PRD §5.2 and source spec §2.4 for the target format.
- **AI error handling:** If the Gemini call fails, the endpoint returns 502 with a user-friendly message; the frontend preserves existing textarea content (PRD FR: AI-call-preserves-content-on-error rule).
- **Button disabled state (frontend):** "Generate from keywords" button disables from click until response arrives. Prevents duplicate submissions per source spec §9.5.
- **Library picker pre-fill behaviour:** Selecting a library entry copies its field values into the form but does NOT bind the form to that entry. Editing the form does not mutate the library row. Saving creates a new row (inline path) unless `save_to_library=true` re-uses the existing id via explicit user action (v1: always create new; revisit if users complain).
- **Age range options:** Use a fixed dropdown: "Under 20", "20s", "30s", "40s", "50s", "60s", "70+" — stored as free-text in the DB for flexibility.

## Verification

- `POST /api/presenters` — creates a library presenter; appears in `GET /api/presenters`
- `POST /api/presenters/generate-appearance` with keywords `"South Asian, 30s, navy suit, confident"` — returns a 2–4 sentence paragraph
- Another user sees the library presenter but cannot `PATCH` or `DELETE` it (403)
- `PATCH /api/video-sessions/{id}/presenter` with `{presenter_id}` — links session to existing presenter, advances `current_step` to SCRIPT
- `PATCH /api/video-sessions/{id}/presenter` with inline fields + `save_to_library=true` — creates library presenter, links, advances step
- Frontend presenter page: fill form, click "Generate from keywords" → textarea fills; click "Continue" → navigates to script step
- Frontend library picker: select a saved presenter → form pre-fills; edit a field → saved library row unchanged
- `cd backend && pytest tests/test_presenters.py` — RBAC, inline path, library path, Gemini error path all covered
- `cd backend && mypy app/` passes
- `cd frontend && npm run typecheck` passes
- Verify in browser using dev-browser skill
