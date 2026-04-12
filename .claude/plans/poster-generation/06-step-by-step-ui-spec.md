# 06 — Step-by-Step UI Specification

One section per step. Refer to the PRD wireframes (§5–§9) for visual layouts; this doc specifies fields, validation, AI wiring, and state transitions.

## Shared Elements

Present on every step:

- **Wizard header:** breadcrumb `Home / New poster / Poster wizard`, save-draft button, close-wizard button (confirm modal if dirty).
- **Step indicator** (`WizardProgress`): 5 dots with labels Brief / Subject / Copy / Composition / Generate. States ● / ✓ / ○ as in PRD §4.1. Completed steps clickable; locked steps not.
- **Step container:** white card, max-width 960px (except Step 5 which is wider), 32px vertical padding.
- **Footer:** `Step N of 5` on the left, `[← Back]` and `[Continue →]` on the right. Continue disabled until step validation passes.

AI-assist buttons use a consistent `AIAssistChip` component: red outline, sparkle icon, text like "AI Generate Brief" or "+ AI". Disabled while request in flight; spinner shown inline.

---

## Step 1 — Brief

### Fields

| Field | Component | Required | AI | Validation |
|---|---|---|---|---|
| Poster title | MUI `TextField` | Yes | No | `min 1, max 120` chars |
| Campaign objective | MUI `Select` | Yes | No | enum (`CampaignObjective`) |
| Target audience | `TextField` | Yes | Yes | `min 1, max 500` |
| Tone | Chip group (single-select) | Yes | No | enum; defaults `PROFESSIONAL` |
| Call to action | `TextField` | Yes | Yes | `min 1, max 300` |
| Poster brief | `TextField multiline` (6 rows) | No | Yes | `max 1500` |

### AI Generate Brief

- Primary `AIAssistChip` at top right of the step: **`AI Generate Brief`**.
- Click behaviour:
  - If brief is empty: generates and populates.
  - If brief has content: button label flips to **`Regenerate Brief`**, clicking shows a confirm modal ("Overwrite current brief?").
- Disabled while any of the four source fields (objective/audience/tone/CTA) is empty.
- Also a per-field `+ AI` chip on `Target audience` and `Call to action` suggesting values inferred from other filled fields.

### Continue enablement

All required fields filled. No dependence on brief paragraph (optional).

### Transitions

- On Continue: autosave, advance to Step 2.
- On Back from Step 2+: state preserved.

---

## Step 2 — Subject

### Subject Type Picker

Three large cards in a row (PRD §6.2). Each shows icon, title, description, and a mode badge (`Text → Image` or `Image → Image`). Click to select (single-select).

When a card is selected, the sub-form below changes accordingly. Previously entered values for other subject types are preserved in the store (user can switch back and forth without losing progress).

### Type A — Human Model

| Field | Component | Required | AI |
|---|---|---|---|
| Appearance keywords | `TextField` | Yes | No |
| Expression / mood | `TextField` | Yes | No |
| Full appearance description | `TextField multiline` (4 rows) | Yes | Yes — `+ Generate from keywords` |
| Posture / framing | Chip group | Yes | No |

AI button `Generate from keywords` is disabled until `appearance_keywords + expression_mood + posture_framing` are all set. Word-count hint: "40–80 words" (amber when outside).

### Type B — Product / Asset

- File upload area: drop zone or click-to-choose. PNG/JPG/WEBP, ≤ 20 MB, up to 3 images. Each accepted file is posted to `/api/uploads/reference-image-temp`; the returned `id` + `storage_url` are stored in `subject.product_asset.reference_image_ids`.
- Remove button on each uploaded thumbnail → DELETE + state update.
- Product placement: chip group (4 options from PRD §6.4).
- Background treatment: chip group (4 options).
- No AI assist fields (image is the source of truth; text is structural metadata).

### Type C — Scene / Abstract

| Field | Component | Required | AI |
|---|---|---|---|
| Scene description | `TextField multiline` (3 rows) | Yes | Yes |
| Visual style | Chip group (5 options) | Yes | No |

AI button `+ AI` on Scene description calls `generate-scene-description` with `visual_style` + `brief` context.

### Continue enablement

Subject type selected + all required fields for that type filled. Uploads for Type B must be present (≥ 1).

### Subject Lock

After Step 5 first generation, state `subject.locked = true`. When locked:
- Step 2 sub-form fields become read-only.
- A **Subject Locked** banner appears at the top.
- Changing requires a "Clear variants and unlock" action (confirm modal).

---

## Step 3 — Copy

### Fields (PRD §7.3)

Grid layout: headline full-width, subheadline+CTA side-by-side, body full-width, brand tagline + disclaimer side-by-side.

Each field row uses `copy-field.tsx` with:
- Label + required asterisk.
- Input (single-line or multiline per field).
- `+ AI` chip on the right of the label for AI-draftable fields.
- Character/word counter in the bottom-right of the input, turning amber past optimal range (not a hard block).
- Inline compliance warning below the input if flags present.

| Field | Input | Required | AI | Optimal |
|---|---|---|---|---|
| Headline | single-line | Yes | Yes | 5–8 words |
| Subheadline | single-line | No | Yes | 10–15 words |
| Call to action text | single-line | Yes | Yes | 3–6 words |
| Body copy | multiline (3 rows) | No | Yes | 20–35 words |
| Brand tagline | single-line | No | No (auto-populated from brand kit) | — |
| Regulatory disclaimer | multiline (2 rows) | No | **Never AI-generated** | — |

### Draft All Button

Top right: **`Draft all from brief`**. Populates Headline, Subheadline, Body, CTA Text via `copy-draft-all` endpoint. Accept/regenerate/edit per field after. Disabled if brief is empty.

### Tone Rewrite Bar

Below the copy fields, four chips: Sharper/Punchier, Warmer/More human, More urgent, Shorter (PRD §7.5). Click any → rewrite all fields via `tone-rewrite` endpoint. One-level undo chip appears after rewrite for 60 seconds.

### Per-field Inline Compliance

Each editable copy field (headline/subheadline/body/CTA) has a debounced compliance check. Warnings render as:

```
┌────────────────────────────────────────────────────────┐
│ ⚠ "guaranteed" may breach MAS FAA-N16.                │
│ Consider: "protected" / "covered" / "secured".   [×]  │
└────────────────────────────────────────────────────────┘
```

Amber card, dismissible per session (dismissing re-shows if the offending text reappears). Never blocks Continue.

### Continue enablement

Headline + CTA text filled. All other copy optional.

---

## Step 4 — Composition

### Format Picker

Row of 5 cards (Portrait, Square, Landscape, Story, Custom) with icon previews (PRD §8.2). Custom reveals width/height inputs (min 600px, max 4000px).

### Layout Template Picker

Row of 5 cards (Hero dominant, Split, Frame border, Typographic, Full bleed). Each card has a mini diagram. Descriptor line below shows the active card's full description.

### Visual Style Picker

Chip group, 6 options (PRD §8.6). Single-select.

### Colour Palette

Shows brand-kit colours as circles (auto-pulled from `GET /api/brand-kit`). Clicking adds/removes from palette (max 6 colours). `+` chip opens a colour picker for custom hex. Selected colours highlighted with a check ring.

### Merged Composition Prompt Editor

Textarea (8 rows, monospace-friendly). Two modes:
- **Empty state:** Textarea disabled; a prominent **`AI Generate Composition`** button centered, which calls `generate-composition-prompt` (doc 03) and populates the field.
- **Populated state:** Textarea editable. User can tweak. `Regenerate` button (with confirm) overwrites.

If any Step 1–3 field changes after prompt generation, backend flips `merged_prompt_stale = true`. Stale state shown as the banner described in PRD §12.3:

```
⚠ Your copy has changed since this prompt was generated.
Regenerate the composition prompt to reflect your latest copy.
[Regenerate composition]
```

### Continue enablement

Format + layout + style + ≥ 1 palette colour + non-empty merged prompt + NOT stale.

---

## Step 5 — Generate & Refine

### Entry behaviour

On arrival from Step 4, automatically dispatch `generate-variants`. Show skeleton state for all 4 variant slots + a progress indicator (4 dots representing each slot as they complete).

### Layout

Two-column:
- **Left (main area):** metadata pills (subject type / format / layout / mode) → 4-up variant thumbnail strip → main preview → action toolbar.
- **Right (fixed width ~380px):** chat panel (doc 07).

On mobile, the right panel stacks below.

### Variant Grid

- 4 thumbnails, single-select. Selected one is shown at full size in main preview.
- Failed slot: shows a red-tinted tile with "Retry" action.
- Regenerating (during retry or regenerate-all): skeleton + spinner.

### Main Preview

- Full-scale image of selected variant.
- Brand overlay toggle: show/hide logo + tagline + disclaimer composited via `render_service` on the fly (preview endpoint or client-side Pillow-equivalent).
- Click → region-select mode for inpainting (see doc 07).

### Action Toolbar

Below main preview:
- **Edit region** — enters inpainting mode.
- **2× upscale** — calls upscale endpoint.
- **Export PNG** / **Export PDF** — calls `POST /api/artifacts/{id}/export` with format.
- **Regen all** — re-fires `generate-variants` with same prompt (confirm modal).
- **Save as variant** — snapshots current state (doc 07).

### Chat Panel

See doc 07 for full design.

### Continue / Exit

Step 5 has no Continue — the end state is **Export**. Exporting moves the artifact to `status=EXPORTED`. User can continue refining and re-export.

---

## Validation Summary (all steps)

| Step | Continue blocks on |
|---|---|
| 1 | Title, Objective, Audience, Tone, CTA all non-empty |
| 2 | Subject type selected + required sub-form fields (type-specific) |
| 3 | Headline + CTA text non-empty |
| 4 | Format, layout, style, palette (≥1), merged prompt, not stale |
| 5 | — (Export is end state) |

Compliance warnings never block Continue; they surface inline only (PRD §11.1).

---

## Cross-references

- Component tree + state container → doc 05.
- Chat panel deep-dive → doc 07.
- Compliance engine wiring → doc 08.
- Export toolbar endpoints → doc 09.
- E2E test flows per step → doc 10.

*Continue to `07-chat-refinement-design.md`.*
