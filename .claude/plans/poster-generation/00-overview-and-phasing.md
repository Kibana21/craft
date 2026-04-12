# 00 — Overview & Phasing

## Feature Summary

The **Poster Wizard** is a 5-step guided creation flow within CRAFT that lets AIA agents and marketing staff produce print-ready and digital posters without design skills. Each step builds on the previous and culminates in a generated poster image refinable via chat.

```
① Brief ─→ ② Subject ─→ ③ Copy ─→ ④ Composition ─→ ⑤ Generate & Refine
```

The wizard's spine is **space** (not time, like the Video Wizard): every element must land simultaneously in a single frame. See PRD §1.2 for the full Video-vs-Poster comparison.

**Primary outputs:** PNG (digital), PDF (print-ready 300DPI CMYK).
**Entry point:** Project workspace → New artifact → Static Poster.
**Primary users:** FSC agents (field), Marketing managers (HQ), Campaign managers, Compliance reviewers.

See the PRD at `.claude/specs/POSTER_WIZARD_PRD.md` for full requirements.

---

## Document Map

| Doc | What's in it | Read when… |
|---|---|---|
| **00** *(this file)* | Orientation, phasing, standards gates, glossary | Starting here |
| 01 | Data model, JSONB shape, new tables, migrations | Designing persistence |
| 02 | Every new API endpoint with contract sketch | Implementing backend routes |
| 03 | Prompt templates for each AI feature | Implementing prompt builders |
| 04 | Parallel variant generation, region edits, Gemini image API specifics | Implementing image pipeline |
| 05 | Frontend wizard architecture, state container, autosave | Implementing the wizard shell |
| 06 | Per-step UI spec (fields, validation, AI-assist wiring) | Implementing any single step |
| 07 | Chat refinement design, turn model, redirect detection | Implementing Step 5 |
| 08 | Per-field inline compliance engine extension | Extending compliance |
| 09 | CMYK / 300DPI / bleed PDF export pipeline | Extending export |
| 10 | Testing strategy | Writing tests |
| 11 | Open questions awaiting user/stakeholder input | Stuck on a decision |

**Suggested reading order:** 00 → 01 → 02 → 05 → 06, then topic-scoped docs (03, 04, 07, 08, 09) as relevant. 10 and 11 are referenced throughout.

---

## Phasing

Five phases, each individually demoable. No feature flag system exists in this codebase — phases are merged directly. The wizard is wired in by routing the "poster" type selection to the new wizard route. Ship order matters: Phase A unblocks all UI review; Phases B–E can partially overlap once the scaffold exists.

### Phase A — Wizard Scaffold *(no dependencies)*
- New route under `frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/`
- 5-step skeleton reusing `WizardProgress` component (`frontend/src/components/projects/wizard/wizard-progress.tsx`)
- State container (choice in doc 05) with local draft autosave
- Steps 1 (Brief) and 3 (Copy) fully functional with **mocked AI** responses
- Data model migration lands here (doc 01)
- Backend artifact content-schema validation for `type=POSTER`
- **Exit criteria:** user can click through all 5 steps, save/resume a draft, and see static placeholder output on Step 5.

### Phase B — Real Text AI *(depends on A)*
- Endpoints: `generate-brief`, `generate-appearance-paragraph`, `copy-draft-all`, `tone-rewrite`, `generate-scene-description`
- Prompt templates from doc 03
- Per-field regenerate / accept / revert UX
- No image work yet; Step 5 still shows placeholder
- **Exit criteria:** All Step 1–3 AI-assist buttons produce real Gemini output inside PRD latency budgets (doc 10, §Latency).

### Phase C — Image Generation *(depends on B)*
- Step 4 Composition UI + deterministic prompt assembler (doc 03)
- `POST /api/ai/generate-poster-variants` — parallel 4-up via `asyncio.gather`
- Step 5 variant grid + selection + main preview
- Reference-image session-temp upload endpoint and sweep job (docs 01, 04)
- Text→Image vs Image→Image branching driven by Step 2 subject type
- **Exit criteria:** user can reach Step 5 and see 4 generated variants within 45s (PRD §14.1).

### Phase D — Chat Refinement + Inpainting *(depends on C)*
- Chat panel UI with change log, turn counter (max 6), suggestion chips
- `POST /api/ai/refine-chat` endpoint
- Inpainting endpoint + region-select UI
- Structural-change classifier + redirect-to-wizard nudge
- Save-as-variant flow (new artifact record, lineage pointer)
- **Exit criteria:** user can make 6 refinement turns, trigger inpainting, get a redirect nudge when asking for copy changes, and save-as-variant to reset the turn counter.

### Phase E — Compliance Inline + Export Hardening *(depends on B and C; can overlap D)*
- `POST /api/compliance/check-field` per-field inline scorer
- Inline warning surface on Step 3 fields
- CMYK conversion + 300DPI + bleed/trim PDF (doc 09)
- Export gating policy (doc 08, §Export gate)
- Compliance-warning audit trail on poster record
- **Exit criteria:** Step 3 shows real-time flags on MAS pattern violations; exported PDF opens in Acrobat as print-ready.

### Dependency graph

```
A ─► B ─► C ─► D
     │    │
     └────┴──► E
```

E can start once B (text AI) and C (image generation) are merged; it does not block D.

---

## Standards Gates

Every piece of work in every phase must satisfy:

- **`.claude/skills/security.md`** — Auth on every new endpoint (`get_current_user` / `require_brand_admin` dependencies), RBAC check against `artifact.creator_id`, input validation via Pydantic, rate limits on AI endpoints (see doc 02, §Rate limits), no secrets in logs.
- **`.claude/skills/postgres.md`** — UUID PKs generated server-side, every FK indexed, soft deletes via `deleted_at`, async `selectinload()` for relationships, Alembic migrations reversible.
- **`.claude/skills/ui-design.md`** — MUI `sx` only, AIA red #D0103A single accent, white canvas, rounded 16px cards with #E8EAED border, rounded-9999 buttons with no shadow, 150–200ms transitions, minimum 11px text, no Tailwind for new code.

A doc that deviates from any of these must call out the deviation explicitly and justify it.

---

## Glossary

| Term | Meaning |
|---|---|
| **Brief** | Step 1 output: campaign objective + target audience + tone + CTA + narrative summary. Context for all downstream AI calls. |
| **Subject** | Step 2 output: visual hero of the poster. One of three types — Human Model, Product / Asset, Scene / Abstract. Drives text-to-image vs image-to-image mode. |
| **Copy** | Step 3 output: structured text fields (headline, subheadline, body, CTA, tagline, disclaimer). |
| **Composition** | Step 4 output: format + layout + style + palette + **merged composition prompt** (the single artifact sent to the Gemini image model). |
| **Merged composition prompt** | Deterministically assembled natural-language paragraph summarising all prior-step outputs. The only thing passed to the image API. |
| **Variant** | One of 4 parallel generations from the same merged prompt with varied temperature. Referred to as "vCRAFTnt" in the PRD — treated as "variant" in code/docs for clarity. |
| **Turn** | One back-and-forth in the Step 5 chat refinement panel. Capped at 6 per variant state. |
| **Change log** | UI pill-strip of all accepted refinement changes for the current variant. Each pill can be undone; session-only (not persisted). |
| **Structural change** | A chat request that touches prior-step content (e.g., "change the headline") — triggers redirect-to-wizard instead of in-chat processing. |
| **Subject Lock** | Once Step 5 generation has fired, the subject description / reference image is embedded in the merged prompt and cannot be changed without re-running Step 4. |
| **Stale prompt** | State where the user has edited Step 3 copy after the merged prompt was generated; blocks Continue on Step 4 until regenerated. |
| **Save as variant** | User action that snapshots the current refinement state as a new variant and resets the turn counter. |

---

## Success Metrics (from PRD §2.2)

| Metric | Target | Telemetry location |
|---|---|---|
| Median time: wizard open → first export | < 10 min | Client event: `poster_wizard_opened` → `poster_exported` |
| % exported without returning to agency | > 70% | Back-office attribution (out of scope for v1 instrumentation) |
| Compliance flag rate on first draft | < 20% | Server: per-field compliance events (doc 08) |
| User satisfaction (post-export) | > 4.2 / 5 | Post-export survey modal |
| AI-generated brief acceptance (unedited) | > 50% | Client event: `brief_ai_generated` vs `brief_submitted` diff hash |

Instrumentation plan for the above lands in doc 10 (§Telemetry).

---

*Continue to `01-data-model-and-migrations.md`.*
