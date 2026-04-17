# Brand Kit Redesign — Detailed PRD

**Feature:** Brand Kit management page — from flat settings to a 6-tab brand governance hub
**Wireframe:** `.claude/specs/craft_brand_kit_page.html`
**Owner:** Brand Admin (BRAND_ADMIN role)
**Status:** Not started — spec complete, current MVP implementation live

---

## 1. Problem

The current Brand Kit page is a flat settings screen: three colour pickers, two logo upload slots, three font upload rows, and a small sidebar preview. It does the minimum — stores brand assets so the poster/video wizards can reference them — but it doesn't help Brand Admins *govern* the brand:

- **No template system.** The poster wizard generates imagery into a blank canvas; there's no concept of pre-defined layout zones (logo here, headline there, disclaimer at the bottom). Every poster reinvents placement.
- **No version history.** Changing a colour or font overwrites the previous state. There's no way to see what changed, who changed it, or roll back to a previous kit version after a bad update.
- **No compliance guidance.** Brand Admins have tribal knowledge about how colours, fonts, and logos should be applied — but none of that is visible in the product. New admins or leaders have to guess.
- **No compositing rules.** The system doesn't explain (or enforce) the separation between AI-generated imagery and brand-exact assets (logos, hex colours, disclaimer text).
- **The live preview is a decoration**, not a validation tool. It doesn't explain *what* it's checking or help the admin confirm that the kit will produce correct output.

The redesign turns the Brand Kit from a settings drawer into a **brand governance hub** — the single surface where Brand Admins define, preview, template, and version-control every visual rule that flows into CRAFT's AI generation and compositing pipeline.

---

## 2. Solution overview

Replace the current flat Brand Kit page with a **6-tab interface**:

| Tab | Purpose |
|---|---|
| **Colours** | Define primary / secondary / accent hex values, view derived tints, see compliance guidance on how colours flow through AI vs compositing |
| **Typography** | Manage heading / body / disclaimer font files, see size-scale reference per format, enforce MAS disclaimer minimum |
| **Logo Vault** | Upload primary (full lockup) and secondary (icon mark) logos with specs, see compositing rules, toggle light/dark preview |
| **Poster Templates** | Define reusable layout templates with named zones (creative, logo, headline, body, disclaimer) and pixel coordinates |
| **Live Preview** | See a composite poster mockup rendered from the active kit, with a 4-point validation checklist |
| **Version History** | Browse past kit versions, see who activated each, read changelogs, restore a previous version |

The page header gains an **Active** status badge and **Edit kit / Save changes** button pair. Subtitle shows `{org} · v{version} · Last updated by {user}, {date}`.

---

## 3. Target users

| Who | What they do here |
|---|---|
| **Brand Admin** | Full read/write — edits colours, uploads fonts/logos, creates templates, saves versions, restores past kits |
| **District / Agency Leader** | Read-only view — sees the active kit for reference when reviewing team content. Cannot edit. |
| **FSC (Agent)** | No access — Brand Kit is not in the Agent nav. Agents consume the kit indirectly through generated posters/videos. |

---

## 4. Detailed feature spec

### 4.1 Page header

| Element | Detail |
|---|---|
| Title | "Brand Kit" |
| Status badge | Green "Active" pill beside the title |
| Subtitle | `"{org name} · v{version} · Last updated by {name}, {date}"` |
| Edit kit button | Outlined, top-right. Toggles fields into edit mode. |
| Save changes button | Filled/dark, top-right. Commits all pending edits, increments version, writes a version-history entry. Disabled when no edits pending. |

**Behaviour:**
- On page load, all fields are in read-only display mode.
- "Edit kit" switches to edit mode (colour pickers enabled, upload zones active, template editor unlocked).
- "Save changes" persists all changes as a single transaction, bumps version, records the changelog, and returns to read-only mode.
- If the user navigates away with unsaved edits, show a browser `beforeunload` confirmation.

---

### 4.2 Tab 1 — Colours

**Layout:** Two-column. Left: three colour cards. Right: compliance guidance.

#### Left column — Brand colours

Three cards, one per colour role:

| Colour | Default | Name | Usage line |
|---|---|---|---|
| Primary | `#E2000F` | AIA Red | Poster backgrounds, CTA buttons, title cards |
| Secondary | `#1A1A2E` | Deep Navy | Body copy, overlay backgrounds, dark sections |
| Accent | `#F5A623` | Warm Gold | Callout badges, icon highlights, video end-cards |

Each card shows:
- **Colour swatch** (large, ~80px square)
- **Name** (editable text field in edit mode)
- **Hex value** (editable, validated `#RRGGBB`)
- **Usage line** (editable text describing where this colour is applied)

**Primary colour only:** a **tint row** below the card showing 5 derived opacity stops (10%, 25%, 50%, 75%, 100%) with the label "Derived tints for compositing". Tints are calculated client-side from the hex — not stored. They visualise how the compositing layer will use washes over AI-generated scenes.

#### Right column — Compliance guidance

**Card 1: "How these colours are applied"**
Four static bullet points:
- AI generation receives mood direction only — not hex codes
- Exact hex values applied by the compositing layer after generation
- Derived tints used as overlay washes on AI-generated scenes
- Primary colour feeds poster background; accent feeds CTA button fill

**Card 2: "Text on brand colours"**
Three contrast-safe pairing rows, each with a visual preview swatch:

| Background | Text colour | Use |
|---|---|---|
| Primary (`#E2000F`) | White | Headlines, CTAs |
| Secondary (`#1A1A2E`) | White | Body copy |
| Accent (`#F5A623`) | Dark text | Badges only |

---

### 4.3 Tab 2 — Typography

**Layout:** Three font-slot cards in a row, followed by a size-scale reference table.

#### Font slots

| Slot | Label | Sub-label | Preview text | Tags |
|---|---|---|---|---|
| Heading | Heading font | Poster titles, video title cards, WhatsApp card headers | "Protect what matters" (26px, bold) | `{font name}` · `{sizes}` · `{file status}` |
| Body | Body font | Supporting copy, sublines, bullet points on posters | "Your future. Your family. Secured with AIA." (15px, regular) | `{font name}` · `{sizes}` · `{file status}` |
| Disclaimer | Disclaimer font | MAS-required disclaimers at bottom of every asset | "This advertisement has not been reviewed by MAS. Protected up to specified limits by SDIC." (10px, muted) | `{font name}` · `8px fixed` · `Inherited from Body` |

Each card has:
- **Preview text** rendered in the uploaded font (or system fallback if no font uploaded)
- **Tag row** showing font name, size range, upload status
- **Upload zone** (edit mode only): drag-drop or file picker. Accepts `.woff2`, `.ttf`. Max 2 MB.

**Disclaimer slot special rules:**
- Font size is fixed at **8px minimum** per MAS legibility requirements.
- Cannot be overridden by project settings.
- Info box (always visible): "Disclaimer font size is fixed at 8px minimum to satisfy MAS legibility requirements. Cannot be overridden by project settings."
- Font file is inherited from Body by default; upload zone allows override.

#### Size-scale reference table

| Zone | 1080 x 1080 | 1080 x 1920 | WhatsApp card |
|---|---|---|---|
| Headline | 72px | 80px | 40px |
| Body | 28px | 32px | 18px |
| Disclaimer | 18px | 18px | 14px |

This table is **read-only reference** — values are baked into the compositing/export pipeline, not editable here. Helps admins understand how font sizes scale across output formats.

**Migration note:** The current `fonts` JSONB stores `heading`, `body`, `accent` + their `_url` counterparts. The redesign renames `accent` → `disclaimer` and adds disclaimer-specific metadata (fixed size flag, inherited-from-body flag).

---

### 4.4 Tab 3 — Logo Vault

**Layout:** Three cards in a row — Primary logo, Secondary logo, Compositing rules.

#### Primary logo card

| Field | Detail |
|---|---|
| Label | "Primary logo" |
| Sub-label | "Full lockup — used on posters, video title cards" |
| Preview | SVG/PNG render on a light background |
| Background toggle | Button to switch preview between light and dark backgrounds |
| Specs | Min width 120px · Clear space 16px · Format: SVG |
| Upload zone | "Replace logo" · SVG preferred, PNG fallback · Max 500 KB |

#### Secondary logo card

| Field | Detail |
|---|---|
| Label | "Secondary logo" |
| Sub-label | "Icon mark only — used on WhatsApp cards, small formats" |
| Preview | Icon render with light/dark background toggle |
| Specs | Min width 40px · Clear space 8px · Format: SVG |
| Upload zone | "Replace icon mark" |

#### Compositing rules card (static, secondary background)

Five rules displayed as a reference list:
1. Logo is never generated by AI — always composited from this vault
2. Clear space is enforced programmatically — no text/imagery enters padding ring
3. Primary logo used when poster has ≥180px width in logo zone
4. Secondary icon mark used for WhatsApp cards and narrow zones
5. SVG format ensures pixel-perfect rendering at any export resolution

---

### 4.5 Tab 4 — Poster Templates

**Layout:** Header row with title + "+ New template" button, then a card grid of templates, then a zone-coordinate reference table for the selected template.

#### Template grid

Five template cards. Each shows:
- **Template name** (e.g. "Hero — Subject left")
- **Canvas diagram** showing named zone overlays (colour-coded rectangles with labels: SCENE, LOGO, HEAD, BODY, DISC)
- **Zone pills** listing the zones present
- **Selected indicator** (highlighted border on the active/selected template)

**Pre-built templates:**

| # | Name | Zone layout (conceptual) |
|---|---|---|
| 1 | Hero — Subject left | Scene 55% left; logo top-right; headline mid-right; body lower-right; disclaimer full-width bottom |
| 2 | Full bleed top | Scene top 55%; logo left-mid; headline center-mid; body lower; disclaimer bottom |
| 3 | Hero — Subject right | Scene 40% right; logo top-left; headline mid-left; body lower-left; disclaimer bottom |
| 4 | Editorial top title | Headline top; scene middle; body + logo bottom row; disclaimer bottom |
| 5 | Custom template (placeholder) | Grey card with "+ New layout" icon |

#### Zone-coordinate reference table (contextual — shows for selected template)

Example for "Hero — Subject left":

| Zone | x | y | width | height |
|---|---|---|---|---|
| creative | 0 | 0 | 594 | 1080 |
| logo | 650 | 54 | 380 | 120 |
| headline | 620 | 240 | 420 | 320 |
| disclaimer | 0 | 1006 | 1080 | 74 |

Coordinates assume a **1080 x 1080** base canvas. The compositing layer scales proportionally for other formats.

**"+ New template" button:** Opens an AI-assisted template builder (or, in v1, a link/prompt: "Help me design a new poster template layout for CRAFT with zone coordinates"). Future phases may provide a visual zone editor.

#### How templates flow into the poster wizard

- When a poster is composed (Poster Wizard Step 4 — Compose), the user selects a template.
- The `generate-composition-prompt` endpoint receives the template's zone definitions.
- AI generates imagery sized to the `creative` zone; the compositing layer places logo, headline, body, and disclaimer into their respective zones at the exact pixel coordinates.
- This ensures brand-consistent layout without relying on AI to position elements.

---

### 4.6 Tab 5 — Live Preview

**Layout:** Two-column. Left: composite poster preview canvas. Right: validation checklist.

#### Left — Composite preview

A **4:5 aspect ratio poster mockup** (max-width ~260px) rendered using the active kit values:
- **Background:** linear gradient from Primary to a darker shade of Primary
- **AI scene zone:** semi-transparent dark placeholder (top-right area) showing where Gemini-generated imagery will be placed
- **Logo:** Primary logo composited at template zone coordinates (top-left)
- **Headline:** "Protect what matters most" in Heading font, white, at template headline zone
- **Body:** "Life coverage starting from $8/month. MAS-regulated." in Body font, white
- **CTA button:** "Learn more" — white text on Primary background, rounded pill
- **Disclaimer:** MAS disclaimer text in Disclaimer font, very small, bottom-center

Footer text: "Live render using active kit. AI scene zone shows where Gemini-generated imagery will be placed. All other elements are composited from Brand Kit values."

#### Right — "What this preview validates"

Four validation cards, each with a status icon (green checkmark or amber warning):

| # | Check | What it confirms |
|---|---|---|
| 1 | **Colour accuracy** | Background is exact Primary hex, not AI approximation. CTA uses Primary. Disclaimer uses Secondary. |
| 2 | **Logo placement** | Composited at template zone coordinates. Clear space enforced. AI scene doesn't bleed into logo area. |
| 3 | **Typography rendering** | Headline uses the uploaded Heading font at the correct size. Body uses Body font. Disclaimer capped at the MAS minimum. |
| 4 | **AI scene zone** | Placeholder shown — actual Gemini output fills this region at generation time. Verify zone dimensions match template. |

The first three checks are green (deterministic from kit data). The fourth is amber (AI output is runtime-dependent; dimensions can be verified but content cannot be previewed until generation).

---

### 4.7 Tab 6 — Version History

**Layout:** A vertical timeline of version cards, plus an explanatory sidebar card.

#### Version cards

Each card shows:

| Field | Detail |
|---|---|
| Version label | `v{n} — {title}` (e.g. "v3 — Q2 2026 refresh") |
| Status indicator | Green dot = active; grey dot = archived |
| Metadata line | "Activated by {name} · {date} · {changelog summary}" |
| Badge | "Active" (green) on the current version |
| Action | "Restore" button on inactive versions |

**Example rows from spec:**

| Version | Title | Activated by | Date | Changelog | Status |
|---|---|---|---|---|---|
| v3 | Q2 2026 refresh | Sarah Tan | 12 Apr 2026 | Headline font updated, accent colour changed to Warm Gold | Active |
| v2 | 2025 annual rebrand | Sarah Tan | 3 Jan 2025 | Logo vault updated, secondary colour revised | Archived — Restore |
| v1 | Initial kit | Admin | 15 Jun 2024 | Platform launch kit | Archived — Restore |

#### "How versioning works" card (static, secondary background)

Four rules:
1. **One kit active at a time** across the entire organisation.
2. **Restoring a past version** immediately applies it to all new projects and artifact generations.
3. **Existing published artifacts retain the kit version** they were generated under — no retroactive changes.
4. **Brand Admins are notified** (in-app notification) when a kit version is activated or restored.

#### Restore flow

1. Brand Admin clicks "Restore" on an inactive version.
2. Confirmation dialog: "Restore to v{n}? This will apply to all new content generation. Existing published artifacts won't change."
3. On confirm: system creates a new version entry (v{n+1}), snapshots the restored kit state, marks it active, marks the previously active version as archived.
4. Notification sent to all Brand Admins.

---

## 5. Data model changes

### 5.1 Modified: `brand_kit` table

| Column | Change | Detail |
|---|---|---|
| `fonts` (JSONB) | Rename key | `accent` → `disclaimer`; add `disclaimer_url`, `disclaimer_inherited` (bool) |
| `is_active` | New column | `boolean NOT NULL DEFAULT true`. Only one row should have `is_active = true` at any time. |
| `changelog` | New column | `text NULL`. Human-readable summary of what changed in this version. |
| `activated_by` | New column | `UUID FK users NULL`. Who activated this version. |
| `activated_at` | New column | `timestamptz NULL`. When this version was activated. |

**Versioning approach:** Each "Save changes" creates a **new `brand_kit` row** (snapshot) with an incremented `version` and `is_active = true`, while setting `is_active = false` on the previously active row. This gives a full history with zero data loss. The existing `get_brand_kit()` query changes from "first by created_at" to `WHERE is_active = true`.

### 5.2 New table: `brand_kit_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Server-generated |
| `brand_kit_id` | UUID FK `brand_kit` | Indexed. Which kit version this template belongs to. |
| `name` | VARCHAR | e.g. "Hero — Subject left" |
| `layout_key` | VARCHAR UNIQUE | Machine-readable key: `hero_subject_left`, `full_bleed_top`, etc. |
| `zones` | JSONB | Array of `{name, x, y, width, height}` objects |
| `is_default` | BOOLEAN | Pre-built templates are defaults; user-created are not |
| `created_by` | UUID FK `users` NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seed data:** 4 pre-built templates with zone coordinates from the spec.

### 5.3 Modified: `fonts` JSONB schema

**Before:**
```json
{
  "heading": "Inter",
  "body": "Inter",
  "accent": "Inter",
  "heading_url": "/uploads/fonts/...",
  "body_url": "/uploads/fonts/...",
  "accent_url": "/uploads/fonts/..."
}
```

**After:**
```json
{
  "heading": "AIA Headline Bold",
  "body": "AIA Body Regular",
  "disclaimer": "AIA Body Regular",
  "heading_url": "/uploads/fonts/...",
  "body_url": "/uploads/fonts/...",
  "disclaimer_url": null,
  "disclaimer_inherited": true,
  "size_scale": {
    "1080x1080": { "headline": 72, "body": 28, "disclaimer": 18 },
    "1080x1920": { "headline": 80, "body": 32, "disclaimer": 18 },
    "whatsapp":  { "headline": 40, "body": 18, "disclaimer": 14 }
  }
}
```

---

## 6. API changes

### 6.1 Modified endpoints

| Method | Path | Change |
|---|---|---|
| `GET /api/brand-kit` | Now returns only the active kit (`is_active = true`) | Add `templates` array and `version_history` summary to response |
| `PATCH /api/brand-kit` | Now creates a new version row instead of mutating in place | Accepts optional `changelog` field. Returns the new active kit. |
| `POST /api/brand-kit/font` | `slot` param accepts `disclaimer` instead of `accent` | Backward compat: accept `accent` as alias during migration |

### 6.2 New endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET /api/brand-kit/versions` | BRAND_ADMIN | List all kit versions (id, version, changelog, activated_by name, activated_at, is_active). Ordered by version DESC. |
| `POST /api/brand-kit/versions/{version}/restore` | BRAND_ADMIN | Restore a past version. Creates a new row (v{n+1}) with the restored kit's values, marks it active. Returns the new active kit. |
| `GET /api/brand-kit/templates` | Any authenticated | List templates for the active kit. Returns array of `{id, name, layout_key, zones, is_default}`. |
| `POST /api/brand-kit/templates` | BRAND_ADMIN | Create a custom template. Body: `{name, layout_key, zones: [{name, x, y, width, height}]}`. Returns the new template. |
| `PATCH /api/brand-kit/templates/{id}` | BRAND_ADMIN | Update template zones or name. |
| `DELETE /api/brand-kit/templates/{id}` | BRAND_ADMIN | Delete a custom template. Cannot delete default templates. |

### 6.3 Response schema additions

**BrandKitResponse** gains:
```
templates: BrandKitTemplate[]
version_history: BrandKitVersionSummary[]  (last 10 versions)
is_active: boolean
changelog: string | null
activated_by: { id, name } | null
activated_at: string | null
```

**BrandKitTemplate:**
```
id: string
name: string
layout_key: string
zones: { name: string, x: number, y: number, width: number, height: number }[]
is_default: boolean
```

**BrandKitVersionSummary:**
```
version: number
changelog: string | null
activated_by: { id: string, name: string } | null
activated_at: string | null
is_active: boolean
```

---

## 7. Frontend changes

### 7.1 Page restructure

Replace the current flat `brand-kit/page.tsx` with a tab-based layout:

```
brand-kit/
  page.tsx              — tab container + header + Edit/Save state management
```

Components (new or heavily modified):

```
components/brand-kit/
  tabs/
    colours-tab.tsx       — 2-column: colour cards + compliance guidance
    typography-tab.tsx    — 3 font cards + size-scale table
    logo-vault-tab.tsx    — 2 logo cards + compositing rules card
    templates-tab.tsx     — template grid + zone-coordinate table
    live-preview-tab.tsx  — preview canvas + validation checklist
    version-history-tab.tsx — version timeline + restore flow
  colour-card.tsx         — swatch + name + hex + usage + tints (new)
  tint-row.tsx            — 5 opacity stops visualisation (new)
  contrast-pairing.tsx    — text-on-colour preview box (new)
  font-slot-card.tsx      — enhanced: preview text, tags, upload zone (modified)
  logo-card.tsx           — enhanced: light/dark toggle, specs display (modified)
  template-card.tsx       — zone overlay diagram + pills (new)
  zone-table.tsx          — coordinate reference table (new)
  preview-canvas.tsx      — full composite poster mockup (modified from brand-preview.tsx)
  validation-checklist.tsx — 4 check cards (new)
  version-card.tsx        — version row with restore button (new)
  color-picker.tsx        — keep existing, minor tweaks
  font-upload.tsx         — keep existing upload mechanism
  logo-upload.tsx         — keep existing upload mechanism
```

### 7.2 State management

- **Edit/read mode** managed via `useState<boolean>` at the page level, passed down as prop.
- **Pending edits** tracked in a local `draftKit` state (spread from fetched kit on edit-mode entry). "Save changes" diffs draft vs original and sends the delta.
- **Tab state** via URL search param (`?tab=colours`) so tabs are deep-linkable and browser-back works.
- **Kit data** fetched via `useQuery(queryKeys.brandKit)`. Mutations use `useMutation` + `invalidateQueries`.

### 7.3 Types

Add to `frontend/src/types/brand-kit.ts`:

```typescript
interface BrandKitTemplate {
  id: string;
  name: string;
  layout_key: string;
  zones: TemplateZone[];
  is_default: boolean;
}

interface TemplateZone {
  name: string;  // "creative" | "logo" | "headline" | "body" | "disclaimer"
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrandKitVersionSummary {
  version: number;
  changelog: string | null;
  activated_by: { id: string; name: string } | null;
  activated_at: string | null;
  is_active: boolean;
}
```

Update `FontsConfig`:
```typescript
interface FontsConfig {
  heading?: string;
  body?: string;
  disclaimer?: string;           // renamed from accent
  heading_url?: string;
  body_url?: string;
  disclaimer_url?: string;       // renamed from accent_url
  disclaimer_inherited?: boolean; // new
  size_scale?: Record<string, Record<string, number>>; // new
}
```

---

## 8. Migration plan

### Database migration

1. Add columns to `brand_kit`: `is_active` (bool, default true), `changelog` (text, nullable), `activated_by` (UUID FK, nullable), `activated_at` (timestamptz, nullable).
2. Create `brand_kit_templates` table.
3. Data migration: set `is_active = true` on the existing singleton row. Rename `fonts.accent` → `fonts.disclaimer` and `fonts.accent_url` → `fonts.disclaimer_url` in the JSONB. Add `disclaimer_inherited: true`.
4. Seed 4 default templates with zone coordinates from the spec.

### Font slot rename

The `accent` → `disclaimer` rename touches:
- Backend model JSONB keys
- Backend schema (`FontsConfig`)
- Backend service (`upload_font` slot validation)
- Backend API (`POST /font?slot=disclaimer`)
- Frontend types
- Frontend font-upload component
- Seed script

Accept `accent` as a deprecated alias in the API for one release cycle, then remove.

### Backward compatibility

- Existing artifacts referencing `fonts.accent_url` must still render. The compositing/export service should fall back to `accent_url` if `disclaimer_url` is absent.
- `get_brand_kit()` changes from "first by created_at" to `WHERE is_active = true`. If no active row exists (impossible after migration, but defensive), fall back to latest by `created_at`.

---

## 9. Business rules

| Rule | Detail |
|---|---|
| **One active kit** | Exactly one `brand_kit` row has `is_active = true` at any time. Saving or restoring atomically swaps the active flag. |
| **Restore creates a new version** | Restoring v2 doesn't reactivate the v2 row — it creates v{n+1} with v2's values. The timeline only moves forward. |
| **Existing artifacts are immutable** | Published artifacts retain the kit version they were generated under. A kit change only affects *new* generations. |
| **Disclaimer size is non-negotiable** | 8px minimum, fixed. MAS legibility requirement. The backend rejects any font-size override below this. |
| **Default templates cannot be deleted** | The 4 pre-built templates are flagged `is_default = true` and protected from deletion. Custom templates can be deleted. |
| **Brand Admin only** | All write operations require `BRAND_ADMIN` role. Leaders get read-only view. Agents have no access. |
| **Logo is never AI-generated** | Logos are always composited from the vault. The AI prompt must never contain instructions to generate a logo. This is enforced in `prompt_builder.py`. |

---

## 10. Acceptance criteria

### Colours tab
- [ ] Three colour cards with swatch, name, hex, and usage line — all editable in edit mode
- [ ] Primary colour shows 5-stop tint row (10% through 100% opacity)
- [ ] Right column shows "How these colours are applied" guidance card (static)
- [ ] Right column shows "Text on brand colours" with 3 contrast-pairing preview boxes
- [ ] Hex validation rejects non-`#RRGGBB` input

### Typography tab
- [ ] Three font-slot cards: Heading, Body, Disclaimer
- [ ] Each card shows preview text rendered in the uploaded font
- [ ] Each card shows tag row (font name, sizes, upload status)
- [ ] Disclaimer card shows MAS enforcement info box
- [ ] Size-scale reference table renders correctly (read-only)
- [ ] Upload zone accepts `.woff2` and `.ttf`, max 2 MB

### Logo Vault tab
- [ ] Primary and Secondary logo cards with image preview
- [ ] Light/dark background toggle on each card
- [ ] Specs displayed (min width, clear space, format)
- [ ] Compositing rules card with 5 rules
- [ ] Upload zone: SVG preferred, PNG fallback, max 500 KB

### Poster Templates tab
- [ ] 4 pre-built template cards with zone overlay diagrams
- [ ] 1 custom template placeholder card
- [ ] Clicking a template selects it and shows its zone-coordinate table
- [ ] "+ New template" button present (v1: opens prompt/link; future: visual editor)
- [ ] Zone coordinates display correctly for each template

### Live Preview tab
- [ ] Composite poster renders using active kit values (colours, logo, fonts, template zones)
- [ ] AI scene zone shown as semi-transparent placeholder
- [ ] 4-point validation checklist with green/amber status icons
- [ ] Preview updates live when edits are pending (before save)

### Version History tab
- [ ] Lists all kit versions, newest first
- [ ] Active version shows green dot + "Active" badge
- [ ] Inactive versions show "Restore" button
- [ ] Restore triggers confirmation dialog
- [ ] After restore: new version row created, old version deactivated, notification sent
- [ ] "How versioning works" explainer card visible

### Cross-cutting
- [ ] Edit/Save mode toggle works across all tabs
- [ ] Tab selection persisted in URL (`?tab=colours`)
- [ ] Unsaved changes trigger `beforeunload` warning
- [ ] Non-admin users see read-only view (upload zones and edit button hidden)
- [ ] Version number increments on every save
- [ ] `accent` font slot gracefully migrated to `disclaimer`

---

## 11. Open questions

| # | Question | Impact |
|---|---|---|
| 1 | Should template zone coordinates be editable via a visual drag-and-drop editor, or is the coordinate table sufficient for v1? | Scope — visual editor is significant frontend effort |
| 2 | Should version restore send an email notification (as spec suggests) or just an in-app notification? Email requires SMTP integration. | Infra dependency |
| 3 | Should the size-scale reference table be editable by Brand Admin, or are font sizes baked into the compositing pipeline? | If editable: new JSONB storage + validation. If fixed: simpler. |
| 4 | How should templates propagate to existing projects? Does changing the default template affect in-progress poster wizards? | UX decision — probably not, same as "existing artifacts retain their kit version" |
| 5 | The spec shows colour hex values different from the current defaults (#E2000F vs #D0103A for Primary). Is this an intentional rebrand or just spec placeholder values? | Seed data + existing artifacts |

---

## 12. Implementation phases

| Phase | Scope | Estimate |
|---|---|---|
| **Phase 1 — Tab scaffold + Colours + Typography + Logo Vault** | Restructure page into 6 tabs. Implement first 3 content tabs with full edit/save. Rename accent → disclaimer. Migration. | Medium |
| **Phase 2 — Version History** | New versioning model (snapshot rows), version list UI, restore flow, notifications. | Medium |
| **Phase 3 — Poster Templates** | New `brand_kit_templates` table, seed 4 defaults, template grid UI, zone-coordinate display, wire into poster wizard compose step. | Medium–Large |
| **Phase 4 — Live Preview + Validation** | Enhanced preview canvas with zone rendering, 4-point validation checklist, live-update from pending edits. | Small–Medium |

Phases 1–2 can ship independently. Phase 3 has a dependency on the poster wizard's compose step accepting template zone data. Phase 4 is cosmetic and can ship any time after Phase 1.
