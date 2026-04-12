# UI Design Standards for CRAFT

The aesthetic is **clean, airy, and light** — generous whitespace, strong typography, soft pastel surfaces, and restrained color. Every screen should feel premium and effortless, not busy or enterprise. The reference aesthetic is NotebookLM / Google One — white canvas, soft colored cards, underline tabs, frosted nav.

---

## Tech stack

All UI is built with **Material UI v9** (`@mui/material`) using the `sx` prop. Tailwind is present but being phased out — do NOT add new Tailwind classes. Use `sx` and the MUI theme tokens (`craftTheme` in `src/lib/theme.ts`) for all new code.

---

## Design DNA

1. **White canvas, soft card surfaces.** Page background is `#FFFFFF`. Cards sit on this as softly tinted pastel surfaces — not white-on-white, not grey-on-grey.
2. **One accent color.** AIA red `#D0103A` is reserved for primary CTAs, active tab indicators, logo, and focus rings. Everything else is neutral or pastel. No color soup.
3. **Typography does the heavy lifting.** Clear hierarchy: large bold headings, comfortable body text, muted meta labels. 12px minimum. Never go smaller.
4. **Borders are whisper-light.** Use `#E8EAED` / `#F0F0F0` to delineate. No heavy shadows. `0 1px 4px rgba(0,0,0,0.06)` at rest, `0 4px 20px rgba(0,0,0,0.10)` on hover at most.
5. **Frosted glass nav.** Navigation bar uses `background: rgba(255,255,255,0.9)` with `backdrop-filter: blur(12px)` — feels premium and modern.
6. **Transitions are subtle.** 150–200ms `ease`. No scale effects larger than `translateY(-3px)` on cards. Avoid heavy spring animations.
7. **Max-width 1200px centered**, padding `px: 3` (24px). Cards use `gap: 1.5` (12px).

---

## Colors

```ts
// Brand
primary.main:        #D0103A   // CTAs, logo, active, focus rings
primary.dark:        #B80E33   // Hover on red
primary.light:       #FCE8E6   // Soft red tint bg

// Text
text.primary:        #1F1F1F   // Headings, card titles
text.secondary:      #5F6368   // Body, labels
text.disabled:       #80868B   // Placeholder, meta

// Surfaces
background.default:  #FFFFFF   // Page background
background.paper:    #FFFFFF   // Card, dialog, popover bg

// Borders / dividers
divider:             #E8EAED   // Standard border
neutralGray.border:  #E8EAED
neutralGray.borderHover: #DADCE0
neutralGray.hover:   #F1F3F4   // Button hover bg

// Semantic
success.main:        #188038
success.light:       #E6F4EA
warning.main:        #B45309
warning.light:       #FEF7E0
error.main:          #C5221F
error.light:         #FCE8E6
```

### Project card pastel palette (8 themes, assigned by name hash)

| Slot | Background | Emoji |
|------|-----------|-------|
| 0 | `#ECEDF8` soft lavender | 📋 |
| 1 | `#FAE8EC` soft rose     | 🎯 |
| 2 | `#E5F3EC` soft mint     | 📂 |
| 3 | `#FDF4E0` soft amber cream | ⚡ |
| 4 | `#EEE8F8` soft lilac    | ✨ |
| 5 | `#E4EFF8` soft sky blue | 🌿 |
| 6 | `#FAE8F4` soft blush    | 💡 |
| 7 | `#E2F2F0` soft seafoam  | 🔷 |

These are intentionally muted and desaturated. Do NOT use vivid/saturated gradients for project cards.

---

## Typography

Font: `var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Page heading | 26–28px | 700 | `#1F1F1F` |
| Section heading | 16px | 600 | `#1F1F1F` |
| Card title | 15px | 600 | `#1A1A1A` |
| Body | 14px | 500 | `#1F1F1F` |
| Small body | 13px | 400 | `#5F6368` |
| Meta / caption | 11–12px | 400 | `rgba(0,0,0,0.45)` |
| Overline label | 11px | 700 | uppercase, `#D0103A` on light bg |
| Minimum size | **11px** — nothing smaller | | |

---

## Layout

```ts
// Page wrapper (all authenticated pages)
sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}

// Card grids
const GRID_5 = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 1.5,
  "@media (min-width:600px)":  { gridTemplateColumns: "repeat(3, 1fr)" },
  "@media (min-width:900px)":  { gridTemplateColumns: "repeat(4, 1fr)" },
  "@media (min-width:1200px)": { gridTemplateColumns: "repeat(5, 1fr)" },
}
```

---

## Navigation

**Both modes** use MUI `<AppBar position="sticky">` with the global theme override:
```ts
backgroundColor: "rgba(255,255,255,0.9)"
backdropFilter: "blur(12px)"
borderBottom: "1px solid #E8EAED"
```

**Creator mode** (`src/components/nav/creator-nav.tsx`):
- Logo: 36×36 red rounded square + "CRAFT" bold text
- Nav links: `Button variant="text"` with `bgcolor: isActive ? "#F1F3F4" : "transparent"`
- Active link: `fontWeight: 600, color: "#1F1F1F"`
- Inactive link: `color: "#5F6368"`
- Right: search `IconButton` + initials `Avatar` (grey bg, logout on click)

**Agent mode** (`src/components/nav/agent-nav.tsx`):
- "CRAFT" wordmark in `#D0103A`
- "Agent" `Chip color="success"` — `bgcolor: "#E6F4EA", color: "#188038"`
- Leaderboard `Button variant="text"`
- Red avatar + name + outlined red "Sign out" `Button`

---

## Welcome banner

Light, airy — never dark. Replaces any dark charcoal gradient.

```ts
sx={{
  borderRadius: "20px",
  background: "linear-gradient(135deg, #FFF0F4 0%, #FFFBFC 55%, #FFF5ED 100%)",
  border: "1px solid rgba(208,16,58,0.10)",
  px: { xs: 3, sm: 5 },
  py: { xs: 3.5, sm: 4.5 },
  position: "relative",
  overflow: "hidden",
}}
```

- Overline: `Typography variant="overline"` in `#D0103A`
- Heading: 26px, weight 700, `#1F1F1F`
- Subtitle: 14px, `#80868B`
- Optional: decorative soft radial circles (low opacity `rgba(208,16,58,0.04–0.06)`) as `position: absolute` decorations

---

## Tabs

MUI `<Tabs>` + `<Tab>` — underline style (NOT pills).

```ts
// Theme overrides in craftTheme:
MuiTabs.indicator: { backgroundColor: "#D0103A", height: 3, borderRadius: "3px 3px 0 0" }
MuiTab.root: { textTransform: "none", fontSize: "15px", fontWeight: 500, color: "#80868B" }
MuiTab.root["&.Mui-selected"]: { color: "#1F1F1F", fontWeight: 600 }
```

Tab panels render directly below with `mb: 4` on the `<Tabs>` component.

---

## Project cards (NotebookLM style)

**Regular project card** — `src/components/cards/project-card.tsx`:
```ts
// Card container
sx={{
  display: "flex", flexDirection: "column",
  minHeight: 180, borderRadius: "16px",
  bgcolor: theme.bg,          // soft pastel from PROJECT_THEMES
  border: "none", p: 2,
  transition: "all 0.18s ease",
  "&:hover": { filter: "brightness(0.96)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" },
}}
// Emoji: 36px at top-left, flex: 1 area
// Title: 15px, weight 600, #1A1A1A — bottom area
// Meta: 12px, rgba(0,0,0,0.45) — date + artifact count
// Three-dot menu: top-right, opacity 0 → 1 on hover
```

**Create new project card** — white background, `#E8E8E8` border:
```ts
// Soft lavender circle (#F0F0F8) with + icon, centered in top area
// "Create new project" label at bottom-left
// On hover: border → #D0103A, circle and label → #D0103A
```

---

## Toolbar pattern (My projects / Team projects)

Left side: pill status filters (`Active` / `Archived`):
```ts
// Active pill: bgcolor "#1F1F1F", color "#FFFFFF"
// Inactive: transparent bg, color "#6B6B6B", hover: "#F1F3F4"
// Shape: borderRadius 9999, px: 2, py: 0.625, fontSize: "13px"
```

Right side: search icon → expanding `InputBase`, sort `Select` in a pill, red `Button variant="contained"` "Create new".

---

## Buttons

| Type | MUI props | Notes |
|------|-----------|-------|
| Primary CTA | `variant="contained" color="primary"` | Red, rounded pill, `disableElevation` |
| Secondary | `variant="outlined"` | `borderColor: #DADCE0`, hover `bgcolor: #F1F3F4` |
| Ghost / nav | `variant="text"` | Hover `bgcolor: #F1F3F4` |
| Icon | `<IconButton>` | Rounded, hover `bgcolor: #F1F3F4` |
| Destructive | `variant="outlined" color="error"` | Red border + text |

All buttons: `borderRadius: 9999` (pill), `textTransform: "none"`, `disableElevation: true`.

---

## Chips / badges

```ts
<Chip size="small" color="success|warning|error" />
// Theme overrides give these tinted light backgrounds:
// success → #E6F4EA bg, #188038 text
// warning → #FEF7E0 bg, #B45309 text
// error   → #FCE8E6 bg, #C5221F text
// All chips: borderRadius 9999, height 22, fontSize "11px", fontWeight 600
```

---

## Forms & inputs

```ts
// TextField default: variant="outlined" size="small"
// Focus ring: borderColor "#D0103A", boxShadow "0 0 0 3px rgba(208,16,58,0.08)"
// Border at rest: #DADCE0
// Placeholder: #BDC1C6
// Border-radius: 10px
```

---

## Skeleton / loading states

Use MUI `<Skeleton variant="rectangular">` with matching border-radius:
```ts
<Skeleton variant="rectangular" height={180} sx={{ borderRadius: "16px" }} />
```
Show 4–5 skeletons in the same grid as real cards.

---

## Empty states

```ts
// Centered column
sx={{ mt: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}

// Icon container
sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#F5F5F5", display: "flex", ... }}

// Heading: fontSize "15px", fontWeight 600, color "#1F1F1F"
// Body: fontSize "13px", color "#9E9E9E"
```

---

## DO NOT

- Do NOT use dark navigation bars or dark hero banners. White/frosted nav, light welcome banners only.
- Do NOT use vivid/saturated gradients on project cards. Use soft pastel flat colors from the theme palette.
- Do NOT use pure `#000000` for any text or panels. Use `#1F1F1F` or `#1A1A1A`.
- Do NOT use Tailwind classes on any migrated component. Use MUI `sx` props.
- Do NOT add `TabIndicatorProps` to `<Tabs>` — it was removed in MUI v9. Configure the indicator via `craftTheme`.
- Do NOT use `shadow-xl` or deep box shadows. Max `0 4px 20px rgba(0,0,0,0.10)` on hover.
- Do NOT use `scale-105` or larger transforms. Card hover uses `filter: brightness(0.96)` or `translateY(-2px)` at most.
- Do NOT use colored section background strips (pink banners, amber bars). White page only.
- Do NOT go below 11px text.
- Do NOT add more than 2 badges per card.
- Do NOT use pill-style tabs. Underline tabs only (MUI `<Tabs>` default indicator style).
- Do NOT duplicate the "Create new" affordance — it appears once as the first card in the grid, and once as a button in the toolbar.
