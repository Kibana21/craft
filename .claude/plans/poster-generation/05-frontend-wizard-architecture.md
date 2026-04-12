# 05 — Frontend Wizard Architecture

## Route & Folder Layout

New route:

```
frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/
  page.tsx                  # wizard shell
  layout.tsx                # (optional) side-effects like autosave hook
  _hooks/
    use-poster-draft.ts     # draft state + autosave
    use-variant-generation.ts
    use-chat-refinement.ts
    use-field-compliance.ts
  _state/
    poster-wizard-store.ts  # Zustand store (see §State Container)
    schema.ts               # TS types mirroring backend PosterContent
```

Components live under:

```
frontend/src/components/poster-wizard/
  wizard-shell.tsx          # progress + step router
  step-1-brief/
    index.tsx
    ai-generate-brief-button.tsx
  step-2-subject/
    index.tsx
    subject-type-picker.tsx
    human-model-fields.tsx
    product-asset-fields.tsx
    scene-abstract-fields.tsx
  step-3-copy/
    index.tsx
    copy-field.tsx          # reusable single-field row with AI chip + compliance inline
    tone-rewrite-bar.tsx
    draft-all-button.tsx
  step-4-composition/
    index.tsx
    format-picker.tsx
    layout-picker.tsx
    style-picker.tsx
    palette-picker.tsx
    merged-prompt-editor.tsx
  step-5-generate/
    index.tsx
    variant-grid.tsx
    main-preview.tsx
    chat-panel.tsx
    change-log.tsx
    export-toolbar.tsx
    inpaint-overlay.tsx
  shared/
    ai-assist-chip.tsx      # consistent AI button treatment
    field-compliance-warning.tsx
    locked-field-badge.tsx
```

**Reuse from existing code:**
- `frontend/src/components/projects/wizard/wizard-progress.tsx` — identical step indicator. Wrap or parameterise if current component hardcodes project-wizard copy; otherwise pass step labels as props.
- Theme tokens from `frontend/src/lib/theme.ts`.
- Existing `ToneSelector`, `FormatSelector` if suitable — if they need modifications, copy and adapt rather than forcing awkward extensions.
- `apiClient` and existing `api/` modules for project/brand-kit/artifact fetching.

---

## Replace vs Coexist with Existing `poster-creator.tsx`

The existing single-form creator at `frontend/src/components/artifacts/create/poster-creator.tsx` stays **coexisting behind a feature flag** (`poster_wizard_v2`) during rollout.

Flag check on `projects/[id]/artifacts/new/page.tsx`:
```tsx
if (featureFlags.posterWizardV2 && type === "POSTER") {
  return redirect(`/projects/${id}/artifacts/new-poster?mode=...`);
}
```

This gives us:
- A kill switch if the new wizard destabilises the create path.
- A direct comparison point during beta.
- No immediate deletion of working code during Phase A.

Deprecation plan: once Phase E ships and usage of the old creator drops below 5%, delete `poster-creator.tsx` and the flag.

---

## State Container — Decision: Zustand

Three options were considered:

| Option | Pros | Cons |
|---|---|---|
| React Context + useReducer | No dep, native | Verbose for 5-step forms, no devtools, re-render control is manual |
| URL search params | Shareable links, cheap | Can't hold JSONB-scale state (reference images, variants, chat turns) |
| **Zustand** | Tiny, no provider, good devtools, partial subscriptions | New dep (verify not already in repo) |

Zustand keeps the wizard state flat, supports fine-grained subscriptions (the chat panel shouldn't re-render when the user types in the brief), and is mature. Verify during implementation whether Zustand is already a dep; if not, add it — it's ~1KB gzipped and warranted here.

### Store shape

```ts
interface PosterWizardState {
  // Identity
  projectId: string;
  artifactId: string | null;        // null until first autosave
  step: 1 | 2 | 3 | 4 | 5;

  // Content (mirrors backend PosterContent JSONB)
  brief: BriefContent;
  subject: SubjectContent;
  copy: CopyContent;
  composition: CompositionContent;
  generation: GenerationState;

  // UI
  dirtyFields: Set<string>;
  compliance: Record<FieldName, ComplianceFlag[]>;
  pendingAI: Record<string, boolean>;   // keyed by feature, for button-disable
  lastAutosaveAt: number | null;

  // Actions
  setField: (path: string, value: unknown) => void;
  acceptAIResult: (feature: string, result: unknown) => void;
  setStep: (step: 1|2|3|4|5) => void;
  addChangeLogEntry: (entry: ChangeLogEntry) => void;
  removeChangeLogEntry: (id: string) => void;
  // ...
}
```

One store per wizard session. Reset on wizard open / project change.

---

## Draft Persistence

Two layers:

1. **Local:** `localStorage` key `poster-wizard:draft:{projectId}:{userId}` mirrors the full state. Written debounced 500ms.
2. **Server:** Autosave creates/updates the artifact with `status=DRAFT`. Cadence:
   - On step change (every time the user clicks Continue / Back).
   - After each AI accept.
   - Debounced 2s on free-text edits.
   - Manual "Save draft" button in the wizard shell header.

Server autosave uses the existing artifact PATCH endpoint (`PATCH /api/artifacts/{id}`). Content is the full `PosterContent` JSONB. On first save the endpoint creates the artifact (requires POST + subsequent PATCH); wizard handles this distinction internally.

**Resume:** When the user returns to a project with a poster draft, the project detail page surfaces it; clicking it routes to `/projects/[id]/artifacts/new-poster?artifactId=...&step=...`, which hydrates the store from the artifact content.

---

## Backward Navigation Semantics

- Step indicator allows click-back to any completed step.
- Forward only via Continue button.
- Backward from Step 4/5 to Step 3 is allowed; it triggers the **stale prompt** state (PRD §12.3) if the merged prompt exists — the user sees the banner in Step 4 when returning.
- Backward from Step 5 to Step 2 is allowed but shows a warning modal: "Changing the subject will clear your generated variants. Continue?" If confirmed, variants are discarded (soft-deleted, recoverable for 24h for support, not in UI).

Navigation state lives in the Zustand store; URL also reflects current step via `?step=N` for link sharing and resume continuity.

---

## AI Request Handling Pattern

Every AI-assist interaction follows the same pattern:

```ts
const { requestBrief, status } = useGenerateBrief();  // hook wraps api client
// status: 'idle' | 'loading' | 'success' | 'error'

<AIAssistChip onClick={requestBrief} disabled={status === 'loading'}>
  AI Generate Brief
</AIAssistChip>
```

The hook:
1. Disables the triggering button.
2. On success, populates the target field via `store.acceptAIResult(...)`.
3. On error, shows a toast and keeps the field unchanged (PRD §10.2).
4. Emits telemetry events (`ai_request_started`, `ai_request_succeeded`, `ai_accepted`).

All AI hooks live in `_hooks/` and wrap functions in `frontend/src/lib/api/poster-wizard.ts` (new module).

---

## Compliance Inline — Integration Point

Each copy field (doc 06) uses `use-field-compliance.ts`:

```ts
const flags = useFieldCompliance({
  field: 'headline',
  text: copy.headline,
  tone: brief.tone,
  debounceMs: 600,
});
```

The hook debounces, hashes the text, checks the local cache, and only calls `POST /api/compliance/check-field` on cache miss. Returns flags → rendered below the field as an amber warning card (doc 08).

---

## Chat Panel Architecture

The Step 5 chat panel is the most complex component. Break it down:

- `ChatPanel` — container; owns scroll & layout.
  - `ChatMessageList` — virtualised list of turns (`system | user | ai | redirect | turn_limit_nudge`).
  - `ChangeLogStrip` — pill row with ✕ undo on each.
  - `SuggestionChips` — 4 static suggestions per variant state (regenerate on selection change).
  - `ChatInput` — textarea + submit; disabled when `turnCount >= 6`.
  - `TurnCounter` — `{current} / 6` badge.

State comes from the Zustand store's `generation.variants[selected].change_log` plus a local chat-turn log. Each submit calls `POST /api/ai/poster/refine-chat` via a hook.

Structural-change detection happens server-side; the client only reacts to the response's `action_type`. For better UX, the client may additionally call the cheap `classify-structural-change` endpoint on input blur to show a pre-submission hint — optional.

---

## Feature Flag Wiring

Use an existing mechanism if present (check `frontend/src/lib/` during implementation). If none exists, introduce a tiny `useFeatureFlag('poster_wizard_v2')` hook backed by user-level settings or a hardcoded allowlist fetched from `/api/users/me`. Do **not** over-engineer — a server-side field like `user.settings.beta_flags` suffices.

---

## Accessibility

PRD §14.4 requirements:
- Step indicator: wrap `WizardProgress` in `<nav aria-label="Wizard steps">`; each step has `aria-current="step"` when active.
- Chat input: `<textarea aria-label="Refine poster via chat">`.
- Variant thumbnails: each has `aria-label` naming the variant number and status.
- Colour + icon for state (never colour alone).
- Full keyboard navigation: Tab through fields, Enter to submit chat, Escape to cancel inpaint selection.

---

## Mobile Behaviour (PRD §14.5)

- Desktop-first; primary target is staff desktops.
- `< 768px`: wizard steps become single-column, step indicator becomes a scrollable strip with active step centred.
- Step 5 chat panel stacks below preview (MUI `Stack` with `direction={{xs: 'column', md: 'row'}}`).
- Variant thumbnails become a horizontal scroll strip.

Do not build a separate mobile-only component tree; use responsive MUI breakpoints.

---

## TypeScript Types

`frontend/src/types/poster-wizard.ts` (new file) mirrors the backend JSONB schema (doc 01) 1:1. Generated by hand for v1; if the team has a backend-to-frontend type generator (verify), use it. These types are imported by the store, hooks, API client, and components.

---

## Cross-references

- Per-step UI detail → doc 06.
- Chat panel deep-dive → doc 07.
- Compliance inline surface → doc 08.
- Variant grid + export toolbar wiring to backend → docs 04, 09.
- Component test approach → doc 10.

*Continue to `06-step-by-step-ui-spec.md`.*
