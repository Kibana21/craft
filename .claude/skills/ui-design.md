# UI Design Standards for CRAFT

Apply these rules whenever building frontend components, pages, or layouts.

---

## AIA Brand System

### Color palette
```css
--aia-red: #D0103A;           /* Primary brand — CTAs, logos, active states */
--aia-red-hover: #A50C2E;     /* Red hover state */
--aia-red-light: #FFF0F3;     /* Red tinted backgrounds */
--aia-red-border: #F9C6D0;    /* Red borders */
--aia-dark: #1A1A18;          /* Creator mode nav, headings */
--aia-warm-gray: #F0EDE6;     /* Page backgrounds */
--aia-warm-gray-dark: #E2DDD4; /* Borders, dividers */
--aia-warm-gray-darker: #C8C2B6; /* Subtle borders */
--aia-text: #1A1A18;          /* Primary text */
--aia-text-secondary: #5C5A54; /* Secondary text */
--aia-text-muted: #9C9A92;    /* Muted text, labels */
--aia-green: #1B9D74;         /* Team/agent elements, success */
--aia-green-light: #E8F6F1;   /* Green tinted backgrounds */
--aia-green-border: #9FE1CB;  /* Green borders */
--aia-green-dark: #0E6B50;    /* Green text on light backgrounds */
--aia-purple: #534AB7;        /* Library/brand items */
--aia-purple-light: #EEEDFE;  /* Purple tinted backgrounds */
--aia-purple-border: #AFA9EC; /* Purple borders */
--aia-purple-dark: #3C3489;   /* Purple text */
--aia-amber: #BA7517;         /* Gamification, streaks */
--aia-amber-light: #FFFBF0;   /* Amber backgrounds */
--aia-amber-border: #FAC775;  /* Amber borders */
--aia-amber-dark: #854F0B;    /* Amber text */
--aia-white: #FFFFFF;
--aia-card-bg: #FAFAF8;       /* Subtle card backgrounds */
```

### Typography
- Font family: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (system font stack)
- Heading weights: 700-800 (bold to extra bold)
- Body weight: 400 (regular), 500-600 for emphasis
- Font sizes: follow a consistent scale — 9px (micro labels), 10px (metadata), 11px (body small), 12px (body), 13px (headings), 15px (large headings), 18px+ (hero)
- Letter spacing: use `0.06-0.1em` on uppercase micro labels

## Component Design Language

### Cards
- Border radius: `12px` for primary cards, `8px` for nested/smaller cards
- Border: `1px solid var(--aia-warm-gray-dark)` default
- Hover: border color shifts to `--aia-warm-gray-darker`
- Colored thumbnail header on project/artifact cards (36-44px height)
- Card body padding: `8-12px`
- Use shadows sparingly — prefer borders over shadows for the AIA warm, flat aesthetic

### Buttons
- Primary: `bg-[#D0103A] text-white` with `hover:bg-[#A50C2E]`, rounded `6-8px`
- Secondary: `bg-white border border-[#E2DDD4] text-[#1A1A18]` with hover border darkening
- Ghost: no background, text color only, hover adds subtle background
- Size: padding `7px 12px` minimum, font-size `11-12px`, font-weight `600`
- Pill buttons (Quick Create): `rounded-full` or `rounded-[20px]`

### Badges
- Role badges: Creator = `bg-red-900/30 text-[#FF6B8A]` on dark, Agent = `bg-[#E8F6F1] text-[#0E6B50] border border-[#9FE1CB]` on light
- Official/Compliant: `bg-[#EEEDFE] text-[#3C3489] border border-[#AFA9EC]`
- Team project: `bg-[#E8F6F1] text-[#0E6B50] border border-[#9FE1CB]`
- Font size: `9-10px`, font-weight `700`, padding `2px 8px`, rounded full

### Navigation
- **Creator mode (internal):** Dark navbar `bg-[#1A1A18]`, CRAFT logo in `#D0103A`, text in `rgba(255,255,255,0.5)`
- **Agent mode (FSC):** Light navbar `bg-white border-b border-[#E2DDD4]`, CRAFT logo in `#D0103A`, text in `#9C9A92`
- Tab bar: `border-bottom: 1px solid #E2DDD4`, active tab has `border-bottom: 2px solid #D0103A` and `font-weight: 600`
- Tab font: `11px`, inactive color `#9C9A92`, active color `#1A1A18`

### Forms
- Input fields: `border border-[#E2DDD4] rounded-[8px] px-3 py-2`, focus ring in `#D0103A`
- Labels: `text-[11px] font-semibold text-[#1A1A18] uppercase tracking-wide`
- Placeholders: `text-[#9C9A92]`
- Select dropdowns: consistent with input styling
- Textareas: same styling, min-height `80px`

### Status colors
- Compliance green (>= 90%): `bg-[#E8F6F1] text-[#0E6B50]`
- Compliance amber (70-89%): `bg-[#FFFBF0] text-[#854F0B]`
- Compliance red (< 70%): `bg-[#FFF0F3] text-[#D0103A]`
- Pending/draft: `bg-[#F0EDE6] text-[#9C9A92]`
- Published/active: `bg-[#E8F6F1] text-[#0E6B50]`

## Layout Principles

### Page structure
- Page background: `#F0EDE6` (warm gray)
- Content max-width: `1200px` centered for Creator mode, `600px` for Agent mode (mobile-optimized)
- Page padding: `16px` on mobile, `24-32px` on desktop
- Section spacing: `14-16px` vertical gap between sections

### Grid patterns
- Project cards: `grid grid-cols-2 gap-8` on desktop, single column on mobile
- Artifact cards: `grid grid-cols-2 lg:grid-cols-3 gap-8`
- Library items: vertical list with horizontal layout per item (thumbnail + info + action)

### Two-mode design
- **Creator mode is denser:** more tabs, analytics, management controls, smaller touch targets OK (desktop users)
- **Agent mode is sparser:** fewer options, larger touch targets, prominent CTAs, mobile-first. The Quick Create strip and gamification bar are Agent-only elements.
- The mode switch happens at the layout level (nav component), NOT per-page. Every page receives the user role and adjusts content accordingly.

## Interaction Patterns

### Loading states
- Use skeleton loaders (not spinners) for content areas — they feel faster and prevent layout shift
- AI generation: show a progress indicator with the step being performed ("Generating image...", "Checking compliance...")
- Button loading: disable button, show spinner inside the button, keep button width stable

### Empty states
- Centered icon (24px) + message (11px, `#9C9A92`) + CTA button
- Be encouraging: "No projects yet — create your first campaign" not "No data found"

### Micro-interactions
- Card hover: border color shift (subtle, not dramatic)
- Button hover: background color darken
- Tab switch: instant, no animation (tabs should feel snappy)
- Toast notifications: slide in from top-right, auto-dismiss after 5 seconds
- Dialog/modal: backdrop blur, centered, max-width `500px`

### Responsive behavior
- Agent home screen MUST work on mobile (375px+). Creator mode can require 1024px+ but should degrade gracefully.
- Navigation: no hamburger menus. On mobile, tabs scroll horizontally.
- Cards: stack vertically on mobile, grid on desktop.

## Do NOT

- Do not use shadows heavier than `shadow-sm`. The AIA aesthetic is flat and warm, not elevated.
- Do not use pure black (`#000000`). Use `#1A1A18` for darkest elements.
- Do not use pure white (`#FFFFFF`) for page backgrounds. Use `#F0EDE6` (warm gray). White is for cards and inputs.
- Do not use generic blue for links or actions. Use `#D0103A` (AIA red) for interactive elements.
- Do not add gradients, glass effects, or heavy animations. The design is clean, professional, insurance-appropriate.
- Do not use emojis in the UI except for the gamification streak icon (🔥).
- Do not round corners beyond 12px on cards. This isn't a playful app — it's a professional tool.
