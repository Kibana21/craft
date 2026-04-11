# UI Design Standards for CRAFT

The aesthetic is **clean, elegant, and lightweight** — simple spacing, strong typography, restrained color, and minimal decoration. Every screen should feel premium and fast, not busy or enterprise.

---

## Design DNA

1. **Whitespace is the structure.** App page backgrounds are `#F5F5F5` light grey (cards sit on this as white `#FFFFFF` surfaces). Let generous padding and spacing do the layout work — no boxes or borders as scaffolding.
2. **One accent color.** AIA red `#D0103A` is reserved for primary CTAs, active states, and the logo. Everything else is neutral. No color soup.
3. **Typography does the heavy lifting.** Clear hierarchy: large bold headings, comfortable body text, muted meta labels. 12px minimum. Never go smaller.
4. **Borders are light.** Use `#EBEBEB` / `#F0F0F0` borders to delineate — no heavy shadows. `shadow-sm` at rest, `shadow-md` on hover at most.
5. **Login left panel is warm off-white `#FAF9F7`.** The split-screen login uses a calm near-white background. Pillar cards are white (`bg-white border border-[#E8E7E3] shadow-sm rounded-2xl`) on the cream surface. Text uses strong contrast: titles `#222222`, descriptions `#888888`. Separator: `border-r border-[#EBEBEB]`. For dark overlays or modal backdrops use `#141414`, NOT pure `#000000`.
6. **Transitions are subtle.** 150–200ms. No scale effects larger than `scale-[1.02]`. Avoid heavy spring animations.
7. **Mobile-first, max-width 1120px.** Single column on mobile, 2–3 on desktop.

---

## Colors

```
/* Primary */
--craft-red:        #D0103A   /* CTAs, logo, active, letter tiles */
--craft-red-hover:  #B80E33   /* Hover */
--craft-red-tint:   #FFF0F3   /* Error / soft red bg */

/* Neutrals */
--black-panel:  #141414   /* Dark panel bg (login, overlays) */
--white:        #FFFFFF   /* Page bg, card bg */
--gray-50:      #F9F9F9   /* Input bg at rest */
--gray-100:     #F0F0F0   /* Dividers, subtle bg */
--gray-200:     #E8E8E8   /* Input borders */
--gray-300:     #DDDDDD   /* Card borders */
--gray-400:     #CCCCCC   /* Placeholder text */
--gray-500:     #AAAAAA   /* Muted meta */
--gray-600:     #888888   /* Secondary labels */
--gray-700:     #555555   /* Body text */
--gray-900:     #222222   /* Primary text */
--black:        #111111   /* Headings, max contrast */

/* Semantic */
--green:        #1B9D74   /* Success, published */
--green-light:  #F0FFF4
--amber:        #F59E0B   /* Warning */
--amber-light:  #FFFBEB
```

---

## Typography

- Font stack: `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`
- **Page title:** 28–32px, weight 800, `#111111`, tracking `-0.02em`
- **Section heading:** 20–24px, weight 700, `#111111`
- **Card title:** 15–16px, weight 600, `#222222`
- **Body:** 14–16px, weight 400, `#555555`, line-height 1.6
- **Meta / caption:** 12–13px, weight 400, `#AAAAAA`
- **Overline label:** 10–11px, weight 600, uppercase, tracking `0.15–0.2em`, `#888888` on light / `white/30` on dark
- **Minimum size:** 11px. Nothing smaller.

---

## Layout

- **Page bg:** `#F5F5F5` (light grey — cards are `#FFFFFF` white sitting on this surface)
- **Max width:** `1120px` centered
- **Page padding:** `px-6 lg:px-10`
- **Section spacing:** `py-10 lg:py-14`
- **Card grid gap:** `gap-5` (20px) — tighter than Airbnb, feels crisper
- **Nav height:** `h-16` (64px)

---

## Login page

Split-screen layout: warm cream left panel + white right panel.

**Left panel** (`bg-[#FAF9F7]`, `w-[48%]`, hidden on mobile):
- Brand mark: `h-14 w-14 rounded-2xl bg-[#D0103A] shadow-lg shadow-[#D0103A]/20` icon + "CRAFT" `text-[2.5rem] font-black text-[#111111]` + muted tagline `text-[15px] text-[#888888]`
- CRAFT pillar cards: `rounded-2xl border border-[#E8E7E3] bg-white shadow-sm` with icon in `bg-[#FFF0F3] text-[#D0103A]` circle, hover flips to `bg-[#D0103A] text-white`
- Tagline card: `rounded-2xl border border-[#E8E7E3] bg-white shadow-sm px-6 py-5`
- Separator: `w-px bg-[#EBEBEB]` on right edge

**Right panel** (`bg-white`, flex-1):
- Welcome heading: `text-[32px] font-extrabold text-[#111111]`
- Form card: no card wrapper needed — form sits directly in the white panel
- Inputs: `bg-[#F9F9F9] border border-[#E8E8E8]` at rest → `bg-white border-[#D0103A] shadow-[0_0_0_3px_rgba(208,16,58,0.08)]` on focus
- Labels: `text-[13px] font-semibold text-[#222222]` (NOT faint uppercase)
- Submit: full-width `bg-[#D0103A] rounded-xl py-3.5 font-bold text-white`
- Quick-access tiles: `border border-[#EBEBEB]`, colored avatars, hover `border-[#D0103A]/30`
- Footer caption: bottom-6, `text-[11px] text-[#DDDDDD]`

---

## Navigation

**Creator mode (brand admin, internal staff):**
- `bg-white border-b border-[#EBEBEB]`
- Left: CRAFT wordmark (red, weight 900) + "Creator" pill
- Admin links: plain text, 14px, `#717171`, hover `#222222`
- User avatar: `h-8 w-8 rounded-full bg-[#D0103A] text-white text-xs font-bold`
- Sign out button: `border border-[#D0103A] text-[#D0103A] rounded-lg px-3.5 py-1.5 text-xs font-semibold hover:bg-[#FFF0F3]`

**Agent mode (FSC):**
- Same white nav, green "Agent" pill
- Same outlined red "Sign out" button
- Simpler — fewer links

---

## Cards

```
rounded-xl border border-[#EBEBEB] bg-white
hover:shadow-md transition-shadow duration-150
```

- Padding: `p-5` or `p-6`
- **No scale transform on hover** — shadow lift only
- Image/color headers: min `h-36`, rounded top

---

## Buttons

| Type | Classes |
|------|---------|
| Primary | `bg-[#D0103A] text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-[#B80E33] transition-colors active:scale-[0.99]` |
| Secondary | `bg-white border border-[#222222] text-[#222222] rounded-xl px-6 py-3 text-sm font-semibold hover:bg-[#F7F7F7]` |
| Ghost | `text-[#222222] text-sm font-medium hover:text-[#D0103A] transition-colors` |
| Destructive | `bg-white border border-[#D0103A] text-[#D0103A] rounded-xl px-6 py-3 text-sm font-semibold hover:bg-[#FFF0F3]` |

---

## Forms

- Input: `w-full rounded-xl border border-[#E8E8E8] bg-[#F9F9F9] px-4 py-3.5 text-sm text-[#111111] placeholder-[#CCCCCC] focus:border-[#D0103A] focus:bg-white focus:shadow-[0_0_0_3px_rgba(208,16,58,0.08)] focus:outline-none transition-all`
- Label: `text-[13px] font-semibold text-[#222222] mb-2 block`
- Error: `bg-[#FFF0F3] text-[#D0103A] rounded-xl px-4 py-3 text-xs font-medium`

---

## Badges & Pills

- **Creator:** `bg-[#FFF0F3] text-[#D0103A] rounded-full px-3 py-1 text-xs font-semibold`
- **Agent:** `bg-[#F0FFF4] text-[#1B9D74] rounded-full px-3 py-1 text-xs font-semibold`
- **Status:** light tinted bg + matching text + no border needed
- Letter tiles (CRAFT acronym, gamification icons): `h-9 w-9 rounded-lg bg-[#D0103A] text-white font-black text-sm flex items-center justify-center`

---

## Tabs

Underline style (not pills):
```
border-b border-[#EBEBEB]

/* Tab item */
pb-3 px-1 text-sm font-semibold text-[#AAAAAA]
hover:text-[#222222] transition-colors

/* Active */
text-[#D0103A] border-b-2 border-[#D0103A]
```

---

## Gamification strip (Agent only)

- Inline bar at bottom of page — `bg-white border-t border-[#EBEBEB]`
- Flame icon + streak text + thin progress bar + points/rank
- Keep it minimal — informational, not decorative

---

## Empty states

- Centered, `text-center`
- Icon or emoji: 48px
- Heading: 20px, weight 700, `#222222`
- Description: 14px, `#AAAAAA`
- CTA below with 24px margin

---

## DO NOT

- Do NOT use pure `#000000` for dark panels. Use `#141414`.
- Do NOT use pure white `#FFFFFF` as the page background for app screens. Use `#F5F5F5`. Cards are white on top of this.
- Do NOT use dark navigation bars. White nav.
- Do NOT use pill tabs. Use underline tabs.
- Do NOT add glow blobs, heavy radial gradients, or decorative orbs to UI.
- Do NOT use `shadow-xl` or `shadow-2xl` in the app. Max `shadow-md` on hover.
- Do NOT use `scale-105` or larger. Keep hover transforms to `scale-[1.02]` max, or skip entirely.
- Do NOT go below 11px text.
- Do NOT use Tailwind `stone-*`, `warm-gray-*`, or `slate-*`. Use custom hex neutrals above.
- Do NOT use colored section backgrounds (pink strips, amber banners). White only.
- Do NOT add more than 2 badges per card.
