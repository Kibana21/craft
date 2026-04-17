# Phase 4 — Live Preview + Validation

**Goal:** Enhanced composite poster preview with zone rendering and a 4-point validation checklist.

**Depends on:** Phase 1 (tab scaffold, draft kit state). Benefits from Phase 3 (template zones for layout) but can render a default layout without templates.
**Blocks:** Nothing

---

## 1. No Backend Changes

The live preview is entirely client-side rendering. All data is available from existing endpoints:
- Brand kit values (colours, fonts, logos) — `GET /api/brand-kit`
- Template zones (if Phase 3 shipped) — `GET /api/brand-kit/templates`

---

## 2. Frontend: Live Preview Tab

**Replace placeholder:** `frontend/src/components/brand-kit/tabs/live-preview-tab.tsx`

### Props

```typescript
interface LivePreviewTabProps {
  kit: BrandKit;
  draft: Partial<BrandKit>;        // pending unsaved edits
  templates: BrandKitTemplate[];   // from Phase 3; empty array if not yet shipped
}
```

### Layout

Two-column (Grid: 5 / 7):
- **Left:** `<PreviewCanvas>` with footer text
- **Right:** "What this preview validates" title + `<ValidationChecklist>`

### Merged kit for preview

```typescript
const previewKit: BrandKit = {
  ...kit,
  ...draft,
  fonts: { ...(kit.fonts || {}), ...(draft.fonts || {}) },
  color_names: { ...(kit.color_names || {}), ...(draft.color_names || {}) },
};
```

This ensures the preview updates live when the user makes edits in other tabs (before Save).

### Footer text

Below the canvas:
> "Live render using active kit. AI scene zone shows where Gemini-generated imagery will be placed. All other elements are composited from Brand Kit values."

Muted text, 12px, max-width matches canvas.

---

## 3. Frontend: Preview Canvas

**New file:** `frontend/src/components/brand-kit/preview-canvas.tsx`

Enhanced version of the existing `brand-preview.tsx`. Replaces the hardcoded layout with zone-aware positioning.

### Props

```typescript
interface PreviewCanvasProps {
  kit: BrandKit;                       // merged kit with draft values
  template?: BrandKitTemplate | null;  // selected template (null = default layout)
}
```

### Rendering (4:5 aspect ratio, max-width ~260px)

The canvas is a relatively-positioned `Box` with `aspectRatio: "4/5"`. Child elements are absolutely positioned using zone coordinates scaled proportionally from the 1080x1080 base canvas.

| Element | Zone source | Render |
|---|---|---|
| **Background** | Full canvas | `background: linear-gradient(135deg, ${kit.primary_color}, ${darken(kit.primary_color, 0.3)})` |
| **AI scene zone** | `creative` zone | Semi-transparent dark overlay (`rgba(0,0,0,0.3)`) at zone coordinates. Label: "AI scene" in small white text. |
| **Logo** | `logo` zone | If `kit.logo_url`: render `<img>` at zone position. Else: white placeholder rectangle with "LOGO" text. |
| **Headline** | `headline` zone | "Protect what matters most" in white, bold, font-family from `kit.fonts?.heading` or fallback. |
| **Body** | `body` zone (if exists) | "Life coverage starting from $8/month. MAS-regulated." in white, regular. |
| **CTA button** | Below body | "Learn more" — white text on primary-colour rounded pill. |
| **Disclaimer** | `disclaimer` zone | "This ad has not been reviewed by MAS. Protected by SDIC." Very small, muted white. |

### Zone coordinate scaling

```typescript
function scaleZone(zone: TemplateZone, canvasWidth: number, canvasHeight: number) {
  const BASE = 1080;
  return {
    left: `${(zone.x / BASE) * 100}%`,
    top: `${(zone.y / BASE) * 100}%`,
    width: `${(zone.width / BASE) * 100}%`,
    height: `${(zone.height / BASE) * 100}%`,
  };
}
```

### Default layout (no template selected)

If no template is provided, use a hardcoded default similar to the current `brand-preview.tsx` layout:
- Logo: top-right
- Headline: middle-right
- Body: lower-right
- CTA: below body
- Disclaimer: bottom full-width

### Darken helper

```typescript
function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`;
}
```

---

## 4. Frontend: Validation Checklist

**New file:** `frontend/src/components/brand-kit/validation-checklist.tsx`

### Props

```typescript
interface ValidationChecklistProps {
  kit: BrandKit;  // merged with draft
}
```

### 4 check cards

Each card: icon (green checkmark or amber warning), title (bold), description (muted text). Rendered as a vertical stack with 12px gap.

| # | Title | Description | Status logic |
|---|---|---|---|
| 1 | **Colour accuracy** | Background is exact Primary hex, not AI approximation. CTA uses Primary. Disclaimer uses Secondary. | Always green (deterministic from kit data) |
| 2 | **Logo placement** | Composited at template zone coordinates. Clear space enforced. AI scene doesn't bleed into logo area. | Green if `kit.logo_url` exists; amber if null |
| 3 | **Typography rendering** | Headline uses the uploaded Heading font at the correct size. Body uses Body font. Disclaimer capped at MAS minimum. | Green if all font slots have uploads (check `kit.fonts?.heading_url`, `body_url`, `disclaimer_url || disclaimer_inherited`); amber if any missing |
| 4 | **AI scene zone** | Placeholder shown — actual Gemini output fills this region at generation time. Verify zone dimensions match template. | Always amber (runtime-dependent) |

### Card component

```typescript
function CheckCard({ status, title, description }: {
  status: "pass" | "warn";
  title: string;
  description: string;
}) {
  const icon = status === "pass" ? "✓" : "!";
  const color = status === "pass" ? "#188038" : "#F59E0B";
  return (
    <Box sx={{ display: "flex", gap: 1.5, p: 2, border: "1px solid #E8EAED", borderRadius: 2 }}>
      <Box sx={{
        width: 24, height: 24, borderRadius: "50%", bgcolor: color,
        color: "white", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
        <Typography sx={{ color: "#5F6368", fontSize: 13, mt: 0.25 }}>{description}</Typography>
      </Box>
    </Box>
  );
}
```

---

## 5. Integration with Edit Mode

The Live Preview tab receives `draft` from the page-level state. When the user:
1. Changes a colour in the Colours tab
2. Uploads a new logo in the Logo Vault tab
3. Uploads a new font in the Typography tab

...and then switches to the Live Preview tab, they see those pending changes reflected immediately (before Save). The validation checklist also re-evaluates against the draft values.

This is handled by the prop drilling from `page.tsx` — no additional wiring needed beyond passing `draft` down.

---

## 6. Relationship to Existing BrandPreview

The existing `brand-preview.tsx` (used as the Phase 1 placeholder in the Live Preview tab) can be kept for backward compatibility in other contexts (e.g. if any other page references it). The new `preview-canvas.tsx` is a separate, more capable component.

If no other page uses `brand-preview.tsx` after Phase 4 ships, it can be deleted.

---

## 7. Verification Checklist

- [ ] Live Preview tab renders the composite poster mockup
- [ ] Background uses Primary colour from kit
- [ ] Logo renders at correct zone position (or placeholder if no logo)
- [ ] Headline renders in Heading font family (or system fallback)
- [ ] Disclaimer renders small at bottom
- [ ] AI scene zone shows semi-transparent placeholder
- [ ] Changing a colour in Colours tab, then switching to Live Preview, shows the new colour
- [ ] Uploading a new logo, then switching to Live Preview, shows the new logo
- [ ] Validation checklist: Check 1 (Colour) always green
- [ ] Validation checklist: Check 2 (Logo) green when logo exists, amber when missing
- [ ] Validation checklist: Check 3 (Typography) green when all fonts uploaded, amber when any missing
- [ ] Validation checklist: Check 4 (AI zone) always amber
- [ ] Template zones (if Phase 3 shipped) affect element positioning
- [ ] Without templates, default layout renders correctly
- [ ] `make test-frontend` (typecheck) passes
