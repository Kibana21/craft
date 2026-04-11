# Phase 4: Brand Library (Browse, Remix, Publish, Manage)

**Goal:** Brand admins publish artifacts to the library, FSCs browse and remix published items into their own projects.

**User stories:** US-009 (browse + remix), US-010 (publish + manage)

**Dependencies:** Phase 3

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/brand_library.py` (extend) | `POST /api/brand-library` (publish artifact to library), `PATCH /api/brand-library/{id}` (approve/reject/unpublish), `POST /api/brand-library/{id}/remix` (create remix), `GET /api/brand-library/{id}` (detail) |
| `backend/app/schemas/brand_library.py` (extend) | `PublishToLibraryRequest(artifact_id)`, `ReviewLibraryItemRequest(action: approve|reject, reason?)`, `BrandLibraryDetailResponse(id, artifact_detail, published_by, status, remix_count, formats_available)` |
| `backend/app/services/brand_library_service.py` (extend) | `publish_to_library(user, artifact_id)` — validates brand_admin, creates BrandLibraryItem status=pending_review. `review_item(user, item_id, action, reason)` — approve→published, reject→rejected. `remix_item(user, item_id)` — creates new personal project + artifact copy, increments remix_count, marks locked regions. Returns new project_id. `unpublish_item(user, item_id)`. |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/brand-library/page.tsx` | Full browse page: search bar, filters (product, format, sort), grid of items. Role-aware: admin sees management; FSC sees remix. |
| `frontend/src/app/(authenticated)/brand-library/[id]/page.tsx` | Detail view: full preview, format variants, brief. Admin: approve/reject if pending. FSC: "Remix into my project" CTA. |
| `frontend/src/components/brand-library/library-grid.tsx` | Filterable, searchable grid of library items |
| `frontend/src/components/brand-library/library-item-detail.tsx` | Full detail with preview |
| `frontend/src/components/brand-library/publish-dialog.tsx` | Dialog for publishing artifact: shows compliance score, confirms intent |
| `frontend/src/components/brand-library/review-dialog.tsx` | Admin review: approve with confirmation, or reject with reason textarea |
| `frontend/src/components/brand-library/remix-button.tsx` | Calls remix API, redirects to newly created project |
| `frontend/src/components/brand-library/library-filters.tsx` | Product dropdown, format checkboxes (1:1, 4:5, WA, 9:16), sort (newest, most remixed) |
| `frontend/src/lib/api/brand-library.ts` (extend) | `publishToLibrary(artifactId)`, `reviewLibraryItem(id, action, reason)`, `remixLibraryItem(id)`, `fetchLibraryItemDetail(id)` |
| `frontend/src/types/brand-library.ts` | `BrandLibraryItem`, `LibraryItemStatus`, `PublishRequest`, `ReviewRequest` types |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/brand-library` | brand_admin | Publish artifact to library |
| GET | `/api/brand-library/{id}` | Any | Library item detail |
| PATCH | `/api/brand-library/{id}` | brand_admin | Approve, reject, or unpublish |
| POST | `/api/brand-library/{id}/remix` | Any | Remix into personal project |

## Remix flow (critical path)

When an FSC clicks "Remix", the backend:
1. Creates a new `Project` with type=personal, name auto-generated (e.g., "PAA Young Parents — Remix"), owner_id=current user
2. Copies the original artifact's content JSON and brief into a new `Artifact` record in the new project
3. Increments the library item's `remix_count`
4. Marks locked regions in the copied content JSON:
   - **Locked (read-only):** `logo_position`, `disclaimer_block`, `brand_colors`
   - **Editable:** `photo`, `name`, `tone`, `tagline`
5. Returns the new `project_id`

The frontend then redirects to `/projects/{new_id}/artifacts/{new_artifact_id}` (the artifact editor).

## Content JSON `locks` field

The artifact content JSON has a `locks` array listing which properties the FSC cannot change in a remix:

```json
{
  "headline": "Secure your family's future",
  "product": "PAA",
  "tone": "professional",
  "image_url": "s3://...",
  "locks": ["brand_colors", "logo_position", "disclaimer"]
}
```

The artifact editor (Phase 5) reads this to disable certain fields for remixed content.

## Publishing flow

```
Artifact in project → POST /api/brand-library (brand_admin) → status: pending_review
→ Admin reviews → PATCH approve → status: published (visible to all FSCs)
                → PATCH reject → status: rejected (reason stored)
```

Only `published` items appear in the FSC browse view. Brand admins see all statuses.

## Key implementation details

- The browse page for FSCs defaults to newest first, with prominent "Remix →" CTAs on every card.
- The library grid should show format availability chips (1:1, 4:5, WA, 9:16) on each card.
- Items show "Official + Compliant" badge in purple (`#534AB7` accents), matching wireframes.
- Remix creates a deep copy — changes to the remix never affect the original.

## Verification

- Brand admin creates an artifact, publishes to library → appears with status "pending_review"
- Brand admin approves → status changes to "published"
- FSC sees published item in Brand Library browse
- FSC clicks "Remix →" → new personal project created with artifact copy
- Remix has `locks` field set correctly
- Original library item's remix_count incremented
- FSC cannot see publish/manage/delete controls
- Non-admin cannot access publish endpoint (403)
- `npm run typecheck` passes
- `pytest` passes
