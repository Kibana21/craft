# Plan: Migrate CRAFT Frontend to Material UI v6

## Context

The current UI is a custom design system built entirely with Tailwind CSS v4 utility classes and a `lib/ui.ts` token file that exports composed Tailwind class strings. The result is functional but visually flat. Migrating to MUI v6 (Material Design 3) gives the platform proper tonal surfaces, state layers, ripple effects, a systematic type scale, and consistent component polish across all 52 component files — all driven by a single AIA-branded theme.

The two-mode architecture (Creator vs Agent) must be preserved exactly throughout the migration.

---

## Approach: Full MUI v6 Migration, Tailwind Removed at End

MUI and Tailwind will **coexist during Phases 1–5** using `enableCssLayer: true` in `AppRouterCacheProvider` (puts MUI styles in `@layer mui`, lower cascade priority). Rule: when a component is migrated, **all its Tailwind classes are removed in the same pass** — no half-migrated components.

Tailwind, `@base-ui/react`, and `shadcn` are removed in Phase 6 once everything is migrated.

---

## Phase 0 — Setup (2–3 hrs)

### Install

```bash
cd frontend
npm install @mui/material @mui/system @emotion/react @emotion/cache @emotion/server
```

Remove later (Phase 6): `@base-ui/react`, `shadcn`, `tw-animate-css`, `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`

### Wire SSR

**`src/app/layout.tsx`** — wrap with `AppRouterCacheProvider` + `ThemeProvider` + `CssBaseline`:

```tsx
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { craftTheme } from '@/lib/theme'

// Wrapping order inside <body>:
<AppRouterCacheProvider options={{ enableCssLayer: true }}>
  <ThemeProvider theme={craftTheme}>
    <CssBaseline />
    <AuthProvider>{children}</AuthProvider>
  </ThemeProvider>
</AppRouterCacheProvider>
```

> `AppRouterCacheProvider` must stay in a **Server Component** — `layout.tsx` already is one. ✓  
> `CssBaseline` replaces Tailwind's Preflight — comment out the `@layer base` block in `globals.css` at this point.

---

## Phase 1 — AIA Theme Definition (3–4 hrs)

**New file: `src/lib/theme.ts`** (Server-safe, pure TS, no JSX)

### Palette mapping from `lib/ui.ts` → MUI tokens

| Current token | MUI token | Value |
|---|---|---|
| `colors.red` | `palette.primary.main` | `#D0103A` |
| `colors.redHover` | `palette.primary.dark` | `#B80E33` |
| `colors.redTint` | `palette.primary.light` | `#FCE8E6` |
| `#1F1F1F` (charcoal) | `palette.secondary.main` | `#1F1F1F` |
| `colors.text1` | `palette.text.primary` | `#1F1F1F` |
| `colors.text3` | `palette.text.secondary` | `#5F6368` |
| `colors.text4` | `palette.text.disabled` | `#80868B` |
| `colors.green` | `palette.success.main` | `#188038` |
| `colors.greenBg` | `palette.success.light` | `#E6F4EA` |
| `colors.amber` | `palette.warning.main` | `#B45309` |
| `colors.error` | `palette.error.main` | `#C5221F` |
| `colors.border` | `palette.divider` | `#E8EAED` |
| `colors.hover` | `palette.action.hover` | `#F1F3F4` |

Custom tokens (via module augmentation):
```ts
declare module '@mui/material/styles' {
  interface Palette {
    neutralGray: { border: string; borderHover: string; hover: string }
  }
}
// neutralGray.border = #E8EAED, borderHover = #DADCE0, hover = #F1F3F4
```

### Typography

```ts
typography: {
  fontFamily: 'var(--font-geist-sans), -apple-system, sans-serif',
  h1: { fontSize: '22px', fontWeight: 600 },
  h2: { fontSize: '16px', fontWeight: 600 },
  body1: { fontSize: '14px', fontWeight: 500 },
  body2: { fontSize: '13px' },
  caption: { fontSize: '12px' },
  overline: { fontSize: '13px', fontWeight: 500 },
}
```

### Key global component overrides

| Component | Override |
|---|---|
| `MuiButton` | `borderRadius: 9999`, `disableElevation: true`, `textTransform: 'none'` |
| `MuiAppBar` | `elevation: 0`, `bgcolor: '#FFFFFF'`, `borderBottom: '1px solid #E8EAED'`, `color: 'inherit'` |
| `MuiCard` | `borderRadius: 16`, `border: '1px solid #E8EAED'`, `boxShadow: 'none'` |
| `MuiChip` | `borderRadius: 9999` |
| `MuiTabs` | indicator color = `primary.main` |
| `MuiTextField` | default `variant: 'outlined'`, focus ring = `primary.main` |
| `MuiLinearProgress` | bar color = `primary.main` |
| `MuiDialog` | paper `borderRadius: 16` |

---

## Phase 2 — Navigation (2–3 hrs)

### Files
- `src/components/nav/creator-nav.tsx`
- `src/components/nav/agent-nav.tsx`
- `src/app/(authenticated)/layout.tsx` (loading state only)

### Pattern

Both navs: outer `<header>` → `<AppBar position="sticky" color="inherit" elevation={0}>` with inner `<Toolbar sx={{ maxWidth: Npx, mx: 'auto', px: 3 }}>`.

**CreatorNav** replacements:
- Nav link buttons → `Button variant="text"` with `sx={{ borderRadius: 9999, bgcolor: isActive ? 'action.selected' : 'transparent' }}`
- Search icon → `IconButton`
- Avatar → MUI `Avatar` with initials

**AgentNav** replacements:
- "Agent" badge → `Chip color="success" size="small"`
- Leaderboard link → `Button variant="text" component={Link}`
- Sign out → `Button variant="outlined" size="small"`

**Layout loading state**: `<div className="flex h-screen ...">` → `<Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>`

---

## Phase 3 — Core Components (4–6 hrs)

### 3a. Buttons (all files using `btn.*` or raw button classes)

| Old token | MUI replacement |
|---|---|
| `btn.brand` | `<Button variant="contained" color="primary">` |
| `btn.primary` | `<Button variant="contained" color="secondary">` |
| `btn.outline` | `<Button variant="outlined">` |
| `btn.ghost` | `<Button variant="text">` |
| `btn.icon` | `<IconButton>` |
| `btn.submit` | `<Button variant="contained" color="primary" fullWidth>` |
| `btn.back` | `<Button variant="outlined" size="small">` |

### 3b. Dialog

Replace `src/components/ui/dialog.tsx` (currently wraps `@base-ui/react`) with a thin re-export:
```tsx
export { Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText } from '@mui/material'
```

Then migrate the 3 raw overlay divs that should be dialogs:
- `src/components/artifacts/export-dialog.tsx`
- `src/components/compliance/score-breakdown.tsx`
- `src/app/(authenticated)/projects/[id]/page.tsx` (delete confirmation)

### 3c. Inputs and Forms

All `<input>` / `<textarea>` → `<TextField fullWidth variant="outlined" size="small">`  
`<select>` in wizard → `<Select>` wrapped in `<FormControl>` + `<InputLabel>`

Key files:
- `src/app/login/page.tsx`
- `src/components/home/tabs/my-projects-tab.tsx` (search input)
- `src/app/(authenticated)/projects/new/page.tsx` + wizard step components
- `src/components/artifacts/create/poster-creator.tsx`, `whatsapp-creator.tsx`, `reel-creator.tsx`
- `src/components/brand-kit/color-picker.tsx` (hex input only; native `<input type="color">` swatch stays)

### 3d. Chips (badges)

`badge.*` spans → `<Chip label="..." color="success|warning|error" size="small">` throughout all files.

> After Phase 3: `@base-ui/react` has zero imports. Delete `src/components/ui/` directory (button, card, checkbox, dialog, input, label, select, tabs, textarea, badge, avatar — none are imported by business components).

---

## Phase 4 — Page Layouts (6–8 hrs)

### Login (`src/app/login/page.tsx`)
`div` stack → `Box` centered layout, form card → `Paper elevation={0}` with border, inputs already done in 3c, submit → `Button fullWidth`, error → `Alert severity="error"`, demo accounts → `Box` grid with `Paper` cards

### Home Tabs

**`src/components/home/creator-home.tsx`** + **`agent-home.tsx`**:
- Welcome banner: keep dark `Box` with gradient, replace className → `sx`
- Tabs: manual button tabs (`tab.root/item/active/indicator` from `lib/ui.ts`) → MUI `Tabs` + `Tab` with `value={activeTab}`

**`src/components/home/tabs/my-projects-tab.tsx`** + **`team-projects-tab.tsx`**:
- Active/Archived toggle → `ToggleButtonGroup` + `ToggleButton`
- Grid/List view toggle → `ToggleButtonGroup`
- Sort dropdown → `Select variant="standard"` (borderless)
- List view rows → `Box` with `sx` flex layout (or keep as is, just remove Tailwind classes)

**`src/components/home/tabs/brand-library-tab.tsx`** + **`analytics-tab.tsx`**: same pattern

### Project Detail (`src/app/(authenticated)/projects/[id]/page.tsx`)
- Back button → `Button variant="outlined" size="small"`
- Status/type badges → `Chip`
- Tabs (Artifacts/Suggestions/Members) → MUI `Tabs` + `Tab`
- Archive/Delete buttons → `Button variant="outlined"` with `color="error"` for delete
- Sort + view toggles → same as home tabs
- Delete dialog → MUI `Dialog` (from Phase 3b)
- `TYPE_META` color classes (`bg-emerald-600` etc.) → hex `backgroundColor` in `style` prop

### Project Detail (`src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/page.tsx`)
- Back button, action buttons, compliance badge, status chip → MUI equivalents

---

## Phase 5 — Feature Components (8–12 hrs, parallelisable)

### 5a. Project Cards (`src/components/cards/project-card.tsx`)
- Outer `<button>` → MUI `Card component="button"` with hover `sx`
- Gradient covers and `getProjectTheme()` function **stay completely unchanged** — pure data
- `CardContent` for body text

### 5b. Gamification Strip (`src/components/home/gamification-strip.tsx`)
- Fixed bottom `div` → `Paper` with `position: 'fixed', bottom: 0, zIndex: theme.zIndex.appBar - 1`
- Custom progress bar → `LinearProgress variant="determinate"`

### 5c. Quick Create Strip (`src/components/home/quick-create-strip.tsx`)
- Quick action buttons → `Button variant="outlined"` with custom hover `sx`

### 5d. Analytics (`src/components/analytics/`)
- Metric cards → MUI `Card`
- Period filter toggle → `ToggleButtonGroup`
- Keep Recharts untouched — just wrap in `Box`

### 5e. Brand Kit (`src/app/(authenticated)/brand-kit/page.tsx` + `src/components/brand-kit/`)
- Two-column layout → `Grid2 container`
- Section cards → MUI `Card`
- Upload zones: keep file input logic, migrate visual layer to `Box`

### 5f. Compliance (`src/app/(authenticated)/compliance/*/page.tsx` + `src/components/compliance/`)
- Rule list → MUI `List` + `ListItem` + `ListItemText`
- Severity chips → `Chip color="error|warning"`
- Already planning Dialog migration in Phase 3b

### 5g. Leaderboard (`src/components/gamification/`)
- Current grid → MUI `Table` + `TableContainer` + `TableRow`
- Current user row highlight → `TableRow sx={{ bgcolor: 'primary.light' }}`
- Progress/streak → `LinearProgress`, `Typography`

### 5h. Artifact Creators (`src/components/artifacts/create/`)
- `poster-creator.tsx`, `whatsapp-creator.tsx`, `reel-creator.tsx`
- Tailwind gradient classes (`bg-gradient-to-br from-red-600`) → inline `style` prop
- Tone/format selectors → `ToggleButtonGroup`
- Tagline generator → `TextField multiline`

---

## Phase 6 — Cleanup (2–3 hrs)

### Remove packages

```bash
npm uninstall @base-ui/react shadcn tw-animate-css class-variance-authority tailwind-merge clsx lucide-react
npm uninstall -D @tailwindcss/postcss tailwindcss
```

### Delete files

- `src/components/ui/` — entire directory (already emptied in Phase 3)
- `src/lib/ui.ts` — verify zero imports: `grep -r "from.*@/lib/ui"` returns nothing, then delete
- `src/lib/utils.ts` — the `cn()` function is no longer needed
- `components.json` — shadcn CLI config
- `tailwind.config.ts`

### Clean `globals.css`

Remove: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, all `@theme`, `@custom-variant`, `@layer base` blocks.

Keep: font face declarations (if any), `box-sizing: border-box` reset.

### Clean `postcss.config.mjs`

Remove `@tailwindcss/postcss`. Keep autoprefixer if present.

---

## Verification

After each phase:
1. `npm run typecheck` — zero TypeScript errors
2. `npm run lint` — zero ESLint errors
3. Browser check: login → Creator home (tabs, project cards, welcome banner) → Agent home (quick create, gamification strip) → Project detail (archive/delete, artifact grid) → Brand kit page

After Phase 6:
- `grep -r "className=" src/` should return zero results
- `grep -r "@base-ui" src/` should return zero results
- `grep -r "from.*@/lib/ui" src/` should return zero results
- Bundle size check: `npm run build` — confirm no Tailwind output in `.next/static/css/`

---

## Critical Files Summary

| File | Phase | Change |
|---|---|---|
| `src/app/layout.tsx` | 0 | Add `AppRouterCacheProvider` + `ThemeProvider` + `CssBaseline` |
| `src/lib/theme.ts` | 1 | **New file** — complete AIA MUI theme |
| `src/lib/ui.ts` | 6 | **Delete** |
| `src/components/nav/creator-nav.tsx` | 2 | `AppBar` + `Toolbar` |
| `src/components/nav/agent-nav.tsx` | 2 | `AppBar` + `Toolbar` |
| `src/components/ui/dialog.tsx` | 3 | Thin MUI re-export |
| `src/components/cards/project-card.tsx` | 5a | MUI `Card`, keep gradient logic |
| `src/app/login/page.tsx` | 4 | Full MUI layout |
| `src/components/home/creator-home.tsx` | 4 | MUI `Tabs` |
| `src/components/home/agent-home.tsx` | 4 | MUI `Tabs` |
| `src/components/home/tabs/my-projects-tab.tsx` | 4 | `ToggleButtonGroup`, `Select` |
| `src/components/home/tabs/team-projects-tab.tsx` | 4 | Same as above |
| `src/app/(authenticated)/projects/[id]/page.tsx` | 4 | Most complex — tabs, dialog, chips, toggles |
| `src/components/home/gamification-strip.tsx` | 5b | `Paper` + `LinearProgress` |
| `globals.css` | 6 | Strip all Tailwind imports |
