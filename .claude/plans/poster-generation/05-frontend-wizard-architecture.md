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
    poster-wizard-context.tsx  # PosterWizardContext provider + useReducer (see §State Container)
    schema.ts                  # TS types mirroring backend PosterContent
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

The existing single-form creator at `frontend/src/components/artifacts/create/poster-creator.tsx` stays **coexisting** during rollout. No feature-flag system exists in this repo, so the routing is done directly in `projects/[id]/artifacts/new/page.tsx`:

```tsx
// poster type immediately routes to the new wizard
if (type === "poster") {
  router.push(`/projects/${id}/artifacts/new-poster/brief`);
  return;
}
```

This keeps things simple:
- No feature flag plumbing to maintain.
- The wizard is the only poster creation path from Phase A onwards.
- The old `poster-creator.tsx` component is left intact (not deleted) until Phase E is verified stable, then removed in a clean-up commit.

Deprecation plan: once Phase E ships and the wizard is verified, delete `poster-creator.tsx`.

---

## State Container — Decision: React Context + useState

This codebase uses **React Context for global state** (see `VideoWizardContext`, `AuthProvider`). The poster wizard follows the same pattern — no new state-management library is introduced.

Three options were considered:

| Option | Pros | Cons |
|---|---|---|
| **React Context + useState** | No new dep, matches existing VideoWizardContext pattern, simple | Re-renders on every context update (mitigated by splitting contexts if needed) |
| URL search params | Shareable links, cheap | Can't hold JSONB-scale state (reference images, variants, chat turns) |
| Zustand | Tiny, partial subscriptions | Not in repo; violates CLAUDE.md "No Redux / Zustand" convention |

### Context shape

```tsx
// _state/poster-wizard-context.tsx
interface PosterWizardContextValue {
  // Identity
  projectId: string;
  artifactId: string | null;        // null until first autosave
  isSaving: boolean;

  // Content (mirrors backend PosterContent JSONB)
  brief: BriefContent;
  subject: SubjectContent;
  copy: CopyContent;
  composition: CompositionContent;
  generation: GenerationState;

  // Actions
  setBrief: (value: Partial<BriefContent>) => void;
  setSubject: (value: Partial<SubjectContent>) => void;
  setCopy: (value: Partial<CopyContent>) => void;
  setComposition: (value: Partial<CompositionContent>) => void;
  setGeneration: (value: Partial<GenerationState>) => void;
  setArtifactId: (id: string) => void;
  setIsSaving: (v: boolean) => void;
  getContentPayload: () => PosterContent;
}

export const PosterWizardContext = createContext<PosterWizardContextValue | null>(null);
export function usePosterWizard() {
  const ctx = useContext(PosterWizardContext);
  if (!ctx) throw new Error("usePosterWizard must be used inside PosterWizardProvider");
  return ctx;
}
```

The provider lives in the wizard `layout.tsx` (same as `VideoWizardContext`). Each step calls `usePosterWizard()` to read and write state.

One context instance per wizard session. Unmounts when the user leaves the wizard route.

---

## Draft Persistence

Two layers:

1. **Local:** `localStorage` key `poster-wizard-draft:{projectId}` mirrors the full context state. Written via a `useEffect` with a 500ms debounce whenever brief/subject/copy/composition changes. Read on mount to hydrate the context before the first server fetch.
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

Navigation state is derived from the URL pathname (same as the video wizard — each step is a separate Next.js route). The layout derives `currentStep` from `usePathname()`, matching the route segment to a step number. No step number is stored in the context.

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

State comes from `PosterWizardContext`'s `generation.variants[selected].change_log` plus a local `useState` chat-turn log (session-only, not persisted). Each submit calls `POST /api/ai/poster/refine-chat` via a hook.

Structural-change detection happens server-side; the client only reacts to the response's `action_type`. For better UX, the client may additionally call the cheap `classify-structural-change` endpoint on input blur to show a pre-submission hint — optional.

---

## Feature Flag Wiring

No feature flag system exists in this codebase. The poster wizard is wired in directly: selecting "poster" on the artifact type page routes to `/projects/[id]/artifacts/new-poster/brief`. No kill-switch is needed for an internal demo platform. If a flag mechanism is introduced in future, it can be added as a thin wrapper at that routing call site without changing the wizard itself.

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
