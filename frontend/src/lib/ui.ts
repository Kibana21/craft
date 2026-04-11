/**
 * CRAFT Design Tokens
 * Single source of truth for all UI styles.
 * Uses Google/NotebookLM-inspired neutral palette with AIA red as the brand accent.
 */

// ─── Color primitives ────────────────────────────────────────────────────────

export const colors = {
  // Brand
  red:      "#D0103A",
  redHover: "#B80E33",
  redTint:  "#FCE8E6",

  // Text
  text1: "#1F1F1F",   // primary
  text2: "#3C4043",   // secondary
  text3: "#5F6368",   // muted
  text4: "#80868B",   // placeholder / meta

  // Surface
  surface:  "#FFFFFF",
  surfaceAlt: "#F8F9FA",
  hover:    "#F1F3F4",

  // Border
  border:   "#E8EAED",
  borderHover: "#DADCE0",

  // Semantic
  green:       "#188038",
  greenBg:     "#E6F4EA",
  amber:       "#B45309",
  amberBg:     "#FEF7E0",
  error:       "#C5221F",
  errorBg:     "#FCE8E6",
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const text = {
  h1:    "text-[22px] font-semibold text-[#1F1F1F]",
  h2:    "text-[16px] font-semibold text-[#1F1F1F]",
  body:  "text-[14px] font-medium text-[#1F1F1F]",
  small: "text-[13px] text-[#5F6368]",
  meta:  "text-[12px] text-[#80868B]",
  label: "text-[13px] font-medium text-[#3C4043]",
} as const;

// ─── Button variants ─────────────────────────────────────────────────────────

export const btn = {
  /** Primary action — dark charcoal pill, NotebookLM-style */
  primary:
    "inline-flex items-center gap-2 rounded-full bg-[#1F1F1F] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#3C4043] active:scale-[0.98]",

  /** Brand red — remix / brand actions */
  brand:
    "inline-flex items-center gap-2 rounded-full bg-[#D0103A] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#B80E33] active:scale-[0.98]",

  /** Outlined — secondary actions */
  outline:
    "inline-flex items-center gap-2 rounded-full border border-[#DADCE0] px-4 py-2 text-[14px] font-medium text-[#3C4043] transition-colors hover:bg-[#F1F3F4]",

  /** Ghost — tertiary / nav items */
  ghost:
    "rounded-full px-4 py-2 text-[14px] font-medium text-[#5F6368] transition-colors hover:bg-[#F1F3F4] hover:text-[#1F1F1F]",

  /** Icon button */
  icon:
    "flex h-10 w-10 items-center justify-center rounded-full text-[#5F6368] transition-colors hover:bg-[#F1F3F4]",

  /** Form submit — full width */
  submit:
    "w-full rounded-lg bg-[#D0103A] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B80E33] disabled:opacity-60",
} as const;

// ─── Card ────────────────────────────────────────────────────────────────────

export const card = {
  base:
    "rounded-2xl border border-[#E8EAED] bg-white transition-all duration-150 hover:border-[#DADCE0] hover:shadow-[0_1px_6px_rgba(32,33,36,0.1)]",
  padding: "p-5",
  row:
    "flex items-center gap-4 rounded-xl border border-[#E8EAED] bg-white px-4 py-3.5 transition-all hover:border-[#DADCE0] hover:shadow-[0_1px_4px_rgba(32,33,36,0.08)]",
  new:
    "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#DADCE0] bg-white transition-all hover:border-[#D0103A] hover:bg-[#FFF8F9]",
} as const;

// ─── Input ───────────────────────────────────────────────────────────────────

export const input = {
  base:
    "w-full rounded-lg border border-[#DADCE0] bg-white px-3.5 py-2.5 text-[14px] text-[#1F1F1F] placeholder-[#BDC1C6] outline-none transition-all focus:border-[#D0103A] focus:shadow-[0_0_0_3px_rgba(208,16,58,0.08)]",
} as const;

// ─── Nav ─────────────────────────────────────────────────────────────────────

export const nav = {
  root:       "sticky top-0 z-50 border-b border-[#E8EAED] bg-white",
  inner:      "mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-6",
  link:       "rounded-full px-4 py-2 text-[14px] font-medium text-[#5F6368] transition-colors hover:bg-[#F1F3F4] hover:text-[#1F1F1F]",
  linkActive: "rounded-full bg-[#F1F3F4] px-4 py-2 text-[14px] font-medium text-[#1F1F1F]",
} as const;

// ─── Tab ─────────────────────────────────────────────────────────────────────

export const tab = {
  root:      "mb-8 border-b-2 border-[#E8EAED]",
  item:      "relative pb-3.5 pr-8 text-[15px] font-medium text-[#80868B] transition-colors hover:text-[#3C4043]",
  active:    "relative pb-3.5 pr-8 text-[15px] font-semibold text-[#1F1F1F]",
  indicator: "absolute inset-x-0 -bottom-[2px] h-[3px] rounded-full bg-[#D0103A]",
} as const;

// ─── Badge ───────────────────────────────────────────────────────────────────

export const badge = {
  green:  "rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[11px] font-medium text-[#188038]",
  amber:  "rounded-full bg-[#FEF7E0] px-2 py-0.5 text-[11px] font-medium text-[#B45309]",
  red:    "rounded-full bg-[#FCE8E6] px-2 py-0.5 text-[11px] font-medium text-[#C5221F]",
  grey:   "rounded-full bg-[#F1F3F4] px-2 py-0.5 text-[11px] font-medium text-[#5F6368]",
} as const;

// ─── Page layout ─────────────────────────────────────────────────────────────

export const layout = {
  page:  "mx-auto max-w-[1200px] px-6 py-8",
  grid5: "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  grid3: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
} as const;
