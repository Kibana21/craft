# 05 — Frontend Architecture

Next.js 16 App Router. All under `frontend/src/app/(authenticated)/my-studio/**` so the group auth guard and CreatorNav/AgentNav handling kicks in automatically.

---

## Route tree

```
src/app/(authenticated)/my-studio/
├── layout.tsx                       # Optional: shared header/breadcrumb; usually not needed
├── page.tsx                         # /my-studio — library (grid/list + filters + upload dropzone + multi-select)
├── image/
│   └── [imageId]/
│       └── page.tsx                 # /my-studio/image/{id} — Detail view (Before/After slider)
└── workflow/
    ├── layout.tsx                   # StudioWorkflowContext provider + WizardProgress
    ├── new/
    │   └── page.tsx                 # /my-studio/workflow/new?source={imageId} — single 4-step wizard
    └── batch/
        └── page.tsx                 # /my-studio/workflow/batch?sources={id1,id2,...} — batch workflow
```

The single-image and batch workflows share the same component building blocks (Intent picker, Style inputs, Prompt review, Generate); they differ only in shell (source strip, var-count caps, concurrency messaging).

---

## Context

```tsx
// src/app/(authenticated)/my-studio/workflow/layout.tsx

interface StudioWorkflowContextValue {
  mode: "single" | "batch";
  sourceImageIds: string[];             // 1 entry for single, 2–20 for batch
  intent: StudioIntent | null;
  styleInputs: Record<string, unknown>; // intent-scoped
  mergedPrompt: string;
  aiEnrichments: string[];
  variationCount: 1 | 2 | 4 | 8;
  runId: string | null;
  regenerationHistory: string[];        // for undo — PRD §10.6

  setIntent: (i: StudioIntent) => void;
  setStyleInputs: (v: Record<string, unknown>) => void;
  setMergedPrompt: (p: string, enrichments?: string[]) => void;
  setVariationCount: (n) => void;
  setRunId: (id: string) => void;
  resetAfterStep: (step: number) => void;
}
```

Provider is the `workflow/layout.tsx`. Pattern mirrors `PosterWizardContext`. State is session-only — nothing persisted client-side except via the API.

---

## API client module

`frontend/src/lib/api/studio.ts` — one file, ~15 functions:

```typescript
// ── Library
uploadImages(files: File[]) → StudioImage[]
listImages(params?: {type?, q?, page?, per_page?}) → StudioImageListResponse
getImage(id: string) → StudioImageDetailResponse
renameImage(id: string, name: string) → StudioImage
deleteImage(id: string) → void

// ── Prompt builder
buildPrompt({intent, style_inputs, source_image_id?, variation_count}) → {merged_prompt, ai_enrichments}

// ── Workflow runs
generateRun({intent, style_inputs, source_image_ids, merged_prompt, variation_count, is_batch}) → {run_id}
getRunStatus(run_id: string) → WorkflowRunStatusResponse
retrySlot(run_id, source_image_id, slot) → {output: StudioImage}
discardOutputs(run_id) → void
listRecentRuns() → WorkflowRunSummary[]
```

Uses the existing `apiClient` singleton (`lib/api-client.ts`). Upload is multi-part via `apiClient.upload` — adapt the current signature if it only takes one file today; batch upload can loop for v1 and be optimised later.

---

## Types

`frontend/src/types/studio.ts` — mirrors backend enums + response shapes:

```typescript
export type StudioImageType = "PHOTO" | "AI_GENERATED" | "ENHANCED" | "POSTER_EXPORT";
export type StudioIntent = "MAKE_PROFESSIONAL" | "CHANGE_BACKGROUND" | "ENHANCE_QUALITY" | "VARIATION" | "CUSTOM";
export type WorkflowStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "PARTIAL";

export interface StudioImage { id, name, type, storage_url, thumbnail_url, mime_type,
  size_bytes, width_px, height_px, source_image_id, workflow_run_id, created_at }
// etc.
```

---

## Components

All under `frontend/src/components/studio/`:

### Library
- `StudioPageHeader` — title + subtitle + the toolbar (Upload, New-from-prompt, Batch-workflow button, Search, Grid/List toggle).
- `StudioFilterChips` — type filter ("All", "Photos", "AI Generated", "Enhanced", "Poster exports").
- `StudioImageGrid` + `StudioImageList` — identical data, two layouts. Select the one in state.
- `StudioImageCard` — thumbnail, type pill, hover actions (⚡ Enhance, 🪄 Variation, ⋯), checkbox overlay for multi-select, overflow menu. **Reuses the hover+delete pattern we built for artifact cards in `projects/[id]/page.tsx`.**
- `StudioSelectionBar` — appears on multi-select: "N images selected" + Batch-workflow + Delete.
- `StudioUploadDropzone` — covers the whole grid area in drag-over state. Uses HTML5 drag events + File API; no lib needed.
- `StudioEmptyState` — shown when the library is empty, with an inline upload CTA.

### Workflow
- `WorkflowProgress` — reuses `WizardProgress` (now with `onStepClick` since Phase D — clickable only for completed steps).
- `IntentPicker` — Step 1. Grid of 5 cards.
- `StyleInputs_MakeProfessional`, `StyleInputs_ChangeBackground`, `StyleInputs_EnhanceQuality`, `StyleInputs_Variation`, `StyleInputs_Custom` — one per intent; dynamically rendered based on `intent`.
- `PromptReviewPanel` — source thumb on left; editable `<textarea>` on right with the merged_prompt; "What the AI added" pill list below; "Regenerate prompt" button (capped at 3 uses via local state); variation-count chip selector.
- `GenerationResultsStrip` — 4 thumbnail tiles with per-slot status (loading / ready / failed + retry); full-size preview of selected; "Save all to library" / "Discard" buttons (wired to `discardOutputs`).
- `BeforeAfterSlider` — draggable divider for Detail view. Reuses `onMouseMove`-on-window pattern; keyboard accessible with ← → (PRD §16.3).

### Batch
- `BatchSourceStrip` — small thumbs of the selected source images at the top.
- `BatchProgressPanel` — per-image row with progress bar + status + per-row retry on failure.

### Detail view
- `StudioImageDetailSidebar` — metadata, source link, prompt used (collapsible), action buttons (Download, Use in Poster Wizard, Enhance further, Generate variation, Delete).

---

## Polling pattern

Reuse the hook contract we already have for video + poster generation:

```tsx
// src/hooks/useStudioRunPolling.ts
export function useStudioRunPolling(runId: string | null) {
  const [status, setStatus] = useState<WorkflowRunStatusResponse | null>(null);
  // 2s interval while status in ("QUEUED","RUNNING"); stop when DONE/FAILED/PARTIAL.
  // Pause when tab is hidden (same as useVideoPolling at src/hooks/useVideoPolling.ts).
}
```

Matches the pattern in `use-variant-generation.ts` but wrapped as a standalone polling hook (the workflow doesn't need the dispatch complexity).

---

## Navigation

Add to `frontend/src/components/nav/creator-nav.tsx` `NAV_LINKS` (line 13–19):

```typescript
const NAV_LINKS = [
  { href: "/home",            label: "Home" },
  { href: "/brand-library",   label: "Library" },
  { href: "/my-studio",       label: "My Studio" },  // NEW
  { href: "/brand-kit",       label: "Brand Kit" },
  { href: "/compliance/rules", label: "Rules" },
  { href: "/compliance/documents", label: "Documents" },
];
```

Also add to `agent-nav.tsx` (FSC) — PRD §4.1 says "always visible regardless of active project context" and doesn't restrict by role.

Active-state logic in `creator-nav.tsx:86-115` already uses `pathname.startsWith(link.href)` — nothing more to wire.

---

## Styling

Full adherence to `.claude/skills/ui-design.md`:
- AIA primary red `#D0103A` for active chips / buttons; hover `#A00D2E`.
- Surface `#F7F7F7` for pill backgrounds.
- Card: `border: "1px solid #E8EAED"`, `borderRadius: "16px"`, white background.
- Button: fully rounded (`borderRadius: 9999`), `textTransform: "none"`, `disableElevation`.
- Geist Sans; 14px body; 600 weight for headings.
- Type pills: small rounded capsules; colour depends on `type`:
  - `PHOTO` — grey (`#EEEEEE` / `#5F6368`)
  - `AI_GENERATED` — blue (`#E8F0FE` / `#1967D2`)
  - `ENHANCED` — purple (`#EDE7F6` / `#6A3FB5`)
  - `POSTER_EXPORT` — red (`#FFE4EA` / `#D0103A`)

---

## Pagination strategy

Server-side. Default page 1, 24 per page. Grid re-fetches on page change; filter + search are query params that reset page to 1. No infinite scroll for v1 — explicit pagination keeps the implementation simple and matches existing CRAFT patterns (projects list).

---

## Error handling

Uniform `apiClient` error shape `{detail, status}`. Each call-site maps:
- 401 → redirect to login (handled in `apiClient` already)
- 413 `STUDIO_UPLOAD_TOO_LARGE` → "File too large — max 25 MB"
- 415 `STUDIO_UPLOAD_BAD_MIME` → "Unsupported format — use PNG/JPG/WEBP/HEIC"
- 429 `STUDIO_QUOTA_EXCEEDED` → "Daily generation cap reached. Try again tomorrow."
- 502 `AI_CONTENT_POLICY` → "The model declined this request. Try tweaking the prompt."
- 502 `AI_UPSTREAM_ERROR` → generic "Image generation failed. Try again."

Same pattern as chat-panel error mapping added in Phase D.

---

## Accessibility

- All interactive components with keyboard `tabindex` and visible focus ring (AIA red 2px outline).
- Image cards: `alt={name + " — " + type label}`.
- Before/After slider: `role="slider"` + `aria-valuenow` + ← → key handlers.
- Batch progress uses `aria-live="polite"` so status is read out.
