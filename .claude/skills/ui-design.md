# UI Design Standards for CRAFT

The aesthetic is **Airbnb-tier** — clean whites, confident typography, visual cards with rich previews, smooth micro-interactions, and generous breathing room. Every screen should feel like a polished consumer product, not an internal admin tool.

---

## Design DNA (What makes it feel Airbnb)

1. **White is the canvas.** Page backgrounds are white `#FFFFFF`, not gray. Content sections use very subtle `#F7F7F7` only for contrast. Cards sit on white, separated by thin `#EBEBEB` borders and soft shadows.
2. **One accent color.** AIA red `#D0103A` is used sparingly — primary CTAs, active states, the logo. Everything else is neutral. No color soup.
3. **Typography does the heavy lifting.** Big bold headings (28-32px), comfortable body text (16px), generous line height (1.5+). The type hierarchy creates structure without needing boxes and borders.
4. **Cards are visual.** Every card has a large image/preview area (60%+ of card height), rounded corners (12px), and lifts on hover with a subtle shadow transition. Think Airbnb listing cards.
5. **Whitespace is generous.** 24px minimum padding on cards, 48-64px between sections, 80-100px vertical padding on page-level sections. When in doubt, add more space.
6. **Interactions are smooth.** 200ms transitions on everything. Cards scale to 1.02 on hover. Buttons darken smoothly. No abrupt state changes.
7. **Mobile-first layout.** Max content width 1120px. Single column on mobile, 2-3 columns on desktop. Grid gaps of 24px.

## Colors

```
/* Primary */
--craft-red: #D0103A        /* Primary CTA, logo, active */
--craft-red-hover: #B80E33  /* Hover state */
--craft-red-light: #FFF0F3  /* Red tint backgrounds */

/* Neutrals — Airbnb-clean */
--white: #FFFFFF             /* Page bg, card bg */
--gray-50: #F7F7F7           /* Section bg, input bg */
--gray-100: #F0F0F0          /* Hover states */
--gray-200: #EBEBEB          /* Borders, dividers */
--gray-300: #DDDDDD          /* Input borders */
--gray-400: #B0B0B0          /* Placeholder text */
--gray-500: #717171          /* Secondary text */
--gray-600: #6A6A6A          /* Body text */
--gray-700: #484848          /* Headings */
--gray-900: #222222          /* Primary text, dark bg */

/* Semantic */
--green: #008A05             /* Success, published, active */
--green-light: #F0FFF0
--amber: #E07912             /* Warning, pending */
--amber-light: #FFF8F0
--blue: #1A73E8              /* Info, links */
--purple: #7B2FF7            /* Library, brand */
--purple-light: #F5F0FF
```

## Typography

- Font: `'Circular', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif` (Airbnb uses Circular; fall back to system)
- **Page title:** 28-32px, weight 800, color #222222, letter-spacing -0.02em
- **Section heading:** 22-24px, weight 700, color #222222
- **Card title:** 16-18px, weight 600, color #222222
- **Body:** 16px, weight 400, color #484848, line-height 1.5
- **Caption/meta:** 14px, weight 400, color #717171
- **Label:** 12px, weight 600, color #717171, uppercase tracking 0.05em
- **Minimum size:** 12px. Nothing smaller.

## Layout

- **Page bg:** `#FFFFFF` (pure white, NOT gray)
- **Max width:** `1120px` centered
- **Page padding:** `px-6 lg:px-10` (24-40px)
- **Section spacing:** `py-12 lg:py-16` (48-64px)
- **Card grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` (24px gaps)
- **Nav height:** `h-20` (80px) — room to breathe

## Navigation

**Creator mode:**
- `bg-white border-b border-[#EBEBEB]` — clean white, NOT dark. Let the content speak.
- Left: CRAFT logo (red, 20px, weight 900) + "Creator" pill badge
- Center: nav links as clean text (16px, #484848, hover: #222222)
- Right: avatar (40px circle) + dropdown

**Agent mode:**
- Same white nav, but with green "Agent" badge
- Simpler — fewer nav links

**Why white nav?** Airbnb uses a white nav. Dark navs feel enterprise. White feels modern.

## Cards

**Standard card:**
```
rounded-xl border border-[#EBEBEB] bg-white overflow-hidden
hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer
```

**Project card:**
- Image/color header: `h-40` minimum, full gradient or image, rounded-t-xl
- Body: `p-4` with title (16px/600), meta line (14px/#717171)
- No border on header — the border wraps the whole card

**Library item card:**
- Horizontal: thumbnail (64x64 rounded-lg) + info + action button
- OR vertical: image header (h-40) + info below (listing-card style)

**"+ New" card:**
- `border-2 border-dashed border-[#DDDDDD] rounded-xl`
- Centered: 32px plus icon + "New project" label
- `hover:border-[#D0103A] hover:bg-[#FFF0F3]`

## Buttons

**Primary:** `bg-[#D0103A] text-white rounded-lg px-6 py-3 text-base font-semibold hover:bg-[#B80E33] transition-colors duration-200 shadow-sm hover:shadow-md`

**Secondary:** `bg-white border border-[#222222] text-[#222222] rounded-lg px-6 py-3 text-base font-semibold hover:bg-[#F7F7F7] transition-colors`

**Ghost:** `text-[#222222] underline underline-offset-4 font-semibold hover:text-[#D0103A]`

**Pill (filter/tag):** `rounded-full border border-[#DDDDDD] px-4 py-2 text-sm font-semibold text-[#222222] hover:border-[#222222] transition-colors` — active: `bg-[#222222] text-white border-[#222222]`

## Badges

- **Creator:** `bg-[#FFF0F3] text-[#D0103A] border border-[#FECDD3] rounded-full px-3 py-1 text-xs font-semibold`
- **Agent:** `bg-[#F0FFF0] text-[#008A05] border border-[#A7F3D0] rounded-full px-3 py-1 text-xs font-semibold`
- **Official:** `bg-[#F5F0FF] text-[#7B2FF7] border border-[#C4B5FD] rounded-full`
- **Status pills:** same pattern — light bg + darker text + subtle border

## Forms

- **Input:** `w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base bg-white placeholder-[#B0B0B0] focus:border-[#222222] focus:ring-0 focus:outline-none transition-colors`
- **Label:** `text-sm font-semibold text-[#222222] mb-2 block`
- **Textarea:** same as input, `min-h-[120px]`
- **Select:** same height as input, custom arrow
- Inputs are taller (py-3.5) for comfortable touch targets

## Tabs

**Airbnb-style underline tabs (not pills):**
```
/* Container */
border-b border-[#EBEBEB]

/* Tab item */
pb-3 px-1 text-sm font-semibold text-[#717171] border-b-2 border-transparent
hover:text-[#222222] hover:border-[#DDDDDD] transition-colors

/* Active */
text-[#222222] border-b-2 border-[#222222]
```

Tabs should be underline-style (Airbnb uses this), not pills. Clean, minimal, lets content breathe.

## Quick Create (Agent only)

- Clean white card with subtle border, NOT pink background
- Row of square-ish cards (100x100) with icon + label
- `border border-[#EBEBEB] rounded-xl p-4 text-center hover:shadow-md hover:border-[#D0103A]`
- Selected/active: red border + light red background

## Gamification (Agent only)

- Inline bar at bottom: white bg, thin top border
- Clean and minimal — flame icon, text, thin progress bar
- Not attention-grabbing — it's informational

## Empty States

- Centered layout with large icon (48-64px)
- Bold heading (22px)
- Muted description (16px, #717171)
- Primary CTA button below
- Generous vertical spacing (40px between elements)

## DO NOT

- Do NOT use gray/stone page backgrounds. White only.
- Do NOT use dark navigation bars. White nav with border.
- Do NOT use pill-style tabs. Use Airbnb underline tabs.
- Do NOT use colored backgrounds on strips (pink quick create, amber gamification). Keep it white.
- Do NOT use text below 12px.
- Do NOT use heavy box shadows. Use `shadow-sm` default, `shadow-lg` on hover only.
- Do NOT use stone-* or warm-gray tailwind colors. Use neutral gray scale.
- Do NOT clutter with badges — max 2 badges per card.
- Do NOT use gradients on backgrounds. Gradients only on card preview headers.
</thinking>
