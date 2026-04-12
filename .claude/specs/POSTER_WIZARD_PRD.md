# CRAFT Poster Wizard — Product Requirements Document

**Product:** CRAFT
**Feature:** Poster Wizard
**Version:** 1.0
**Date:** April 2026
**Author:** Product — CRAFT Team
**Status:** Draft for Review

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Stories](#3-user-stories)
4. [Wizard Flow Overview](#4-wizard-flow-overview)
5. [Step 1 — Brief](#5-step-1--brief)
6. [Step 2 — Subject](#6-step-2--subject)
7. [Step 3 — Copy](#7-step-3--copy)
8. [Step 4 — Composition](#8-step-4--composition)
9. [Step 5 — Generate & Refine](#9-step-5--generate--refine)
10. [AI Assist Features](#10-ai-assist-features)
11. [Compliance Engine](#11-compliance-engine)
12. [Business Rules & Constraints](#12-business-rules--constraints)
13. [States & Transitions](#13-states--transitions)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Out of Scope](#15-out-of-scope)

---

## 1. Overview

### 1.1 Purpose

The Poster Wizard is a structured, step-by-step creation flow within CRAFT that enables AIA agents and marketing staff to produce print-ready and digital marketing posters without design skills, using AI-assisted copy generation and AI image generation.

The wizard guides the user through five sequential stages — Brief, Subject, Copy, Composition, and Generate — each building on the previous, culminating in a generated poster image that can be refined conversationally and exported in multiple formats.

### 1.2 How It Differs from the Video Wizard

The Video Wizard's spine is **time**: a presenter delivers a script across scenes that unfold sequentially. The Poster Wizard's spine is **space**: everything that needs to communicate must land simultaneously in a single frame. This distinction drives nearly every design decision.

| Dimension | Video Wizard | Poster Wizard |
|---|---|---|
| Temporal structure | Multi-scene, sequential | Single frame |
| Subject type | Always a human presenter | Human model / Product / Scene (3 types) |
| Content unit | Script → scenes | Structured copy fields (H1, H2, body, CTA) |
| AI generation input | Per-scene merged prompt | Single merged composition prompt |
| AI generation mode | Text → Video only | Text → Image OR Image → Image |
| Post-generation editing | Regenerate individual scenes | Chat refinement, inpainting, vCRAFTnts |
| Compliance check | Script-level | Per copy field, inline |
| Primary output | MP4 | PNG / PDF (print-ready) |

### 1.3 Entry Point

The Poster Wizard is triggered when a user selects **Static Poster** from the CRAFT project workspace's Choose Artifact type. It opens as a dedicated wizard view with a five-step progress indicator at the top.

---

## 2. Goals & Success Metrics

### 2.1 Goals

- Reduce time-to-poster from hours (agency-dependent) to under 10 minutes
- Eliminate dependence on external design tools for standard campaign posters
- Ensure all generated copy passes MAS insurance advertising compliance checks before export
- Maintain AIA brand consistency through brand kit integration
- Enable agents with no design background to produce professional-grade outputs

### 2.2 Success Metrics

| Metric | Target |
|---|---|
| Median time from wizard open to first export | < 10 minutes |
| % of posters exported without returning to agency | > 70% |
| Compliance flag rate on first draft | < 20% |
| User satisfaction score (post-export survey) | > 4.2 / 5.0 |
| AI-generated brief acceptance rate (no manual edit) | > 50% |

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | AIA agent | Generate a compliant promotional poster from a brief | I can share it with prospects without involving the marketing team |
| US-02 | Marketing manager | Upload a product photo and have AI compose a poster around it | I can produce branded assets from existing photography quickly |
| US-03 | Campaign manager | Adjust a generated poster's visual tone via chat | I don't have to regenerate from scratch for small tweaks |
| US-04 | Compliance officer | See inline warnings on copy before export | I can catch MAS guideline breaches early in the workflow |
| US-05 | AIA agent | Reuse brand-approved copy tone and colour palette | Every poster I produce feels on-brand without manual configuration |
| US-06 | Marketing manager | Export a poster in print-ready PDF and digital PNG | I can use the same asset across print and digital channels |
| US-07 | AIA agent | See a change log of every chat-based refinement | I can undo individual changes without losing the full revision history |

---

## 4. Wizard Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Home  /  New poster  /  Poster wizard                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ① Brief ──── ② Subject ──── ③ Copy ──── ④ Composition ──── ⑤ Generate│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
         │            │           │              │               │
         ▼            ▼           ▼              ▼               ▼
    Purpose,      Who/what     Headline,     Format,        AI generates
    audience,     is the       subhead,      layout,        poster +
    tone, CTA     visual       body copy,    style,         chat refine
                  hero         CTA, legal    palette,       loop
                               text          merged prompt
```

Each step produces a structured output that feeds directly into subsequent steps. The merged composition prompt assembled in Step 4 is the single artifact sent to the image generation API in Step 5.

### 4.1 Step Indicator Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Home  /  New poster  /  Poster wizard                               │
│                                                                      │
│  ●─────────────────────────────────────────────────────────────────  │
│  Brief    ○ ── Presenter    ○ ── Copy    ○ ── Composition ○──Generate│
│  (active)     (locked)          (locked)     (locked)      (locked) │
└──────────────────────────────────────────────────────────────────────┘

States:
  ● = Active (current step, red fill)
  ✓ = Done (white fill, red border, checkmark)
  ○ = Locked (grey border, grey text)
  All completed steps remain clickable for backward navigation.
  Forward navigation only via Continue button.
```

---

## 5. Step 1 — Brief

### 5.1 Purpose

Establishes the strategic intent of the poster. All downstream steps — copy generation, subject rendering, and image composition — draw from this brief as shared context.

### 5.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Define your poster brief                  [+ AI Generate Brief]     │
│  Set the direction for your poster.                                  │
│  All fields feed into copy and image generation.                     │
│                                                                      │
│  Poster title                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ New poster                                                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Campaign objective           Target audience          [+ AI]        │
│  ┌───────────────────────┐    ┌──────────────────────────────────┐   │
│  │ Product launch     ▾  │    │ Who is this poster for?          │   │
│  └───────────────────────┘    └──────────────────────────────────┘   │
│                                                                      │
│  Tone                                                                │
│  ┌────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐      │
│  │Professional│ │ Inspirational│ │ Energetic│ │  Empathetic  │      │
│  └────────────┘ └──────────────┘ └──────────┘ └──────────────┘      │
│  ┌──────────────────┐                                                │
│  │  Urgency-driven  │                                                │
│  └──────────────────┘                                                │
│                                                                      │
│  Call to action                                          [+ AI]      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ What should viewers do after seeing this?                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Poster brief                                            [+ AI]      │
│  A narrative summary used as context throughout generation.          │
│  Leave blank or let AI build it from your inputs above.              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │ Describe the purpose, audience, and visual direction           │  │
│  │ in a few sentences.                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│  Step 1 of 5                                    [Continue →]         │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Fields

| Field | Type | Required | AI Assist | Description |
|---|---|---|---|---|
| Poster title | Text input | Yes | No | Working name for the poster asset |
| Campaign objective | Dropdown | Yes | No | Product launch / Brand awareness / Lead generation / Event promotion / Policy renewal |
| Target audience | Text input | Yes | Yes | Free text; AI can suggest from objective |
| Tone | Single-select chip | Yes | No | Professional / Inspirational / Energetic / Empathetic / Urgency-driven |
| Call to action | Text input | Yes | Yes | The single action viewers should take |
| Poster brief | Long text | No | Yes | Narrative summary; used as context in all AI calls downstream |

### 5.4 AI Generate Brief

When the user clicks **AI Generate Brief**, the system:
1. Reads all currently filled fields (objective, audience, tone, CTA)
2. Generates a coherent paragraph-length Poster Brief that synthesises them
3. Places the result in the Poster Brief textarea
4. The user can accept, edit, or regenerate

If Poster Brief is already filled, the button label changes to **Regenerate Brief** and overwrites on click (with confirmation).

### 5.5 Validation

- Poster title: required before Continue
- Campaign objective: required before Continue
- Tone: must have one selection; defaults to Professional on load
- CTA: required before Continue

---

## 6. Step 2 — Subject

### 6.1 Purpose

Defines what the visual hero of the poster is. This is the structurally most novel step in the Poster Wizard. The subject type selected here determines which AI generation mode is used in Step 5.

### 6.2 Wireframe — Subject Type Selection

```
┌──────────────────────────────────────────────────────────────────────┐
│  Define your subject                                                 │
│  The visual hero of your poster.                                     │
│  Your choice determines which AI generation mode is used.           │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │       👤        │  │       📦        │  │       🌅        │     │
│  │  Human model    │  │ Product / asset │  │ Scene / abstract│     │
│  │                 │  │                 │  │                 │     │
│  │ Describe a      │  │ Upload a photo  │  │ No person or    │     │
│  │ person — AI     │  │ — AI integrates │  │ product. AI     │     │
│  │ renders them    │  │ it styled.      │  │ generates a     │     │
│  │ into the poster │  │                 │  │ mood visual.    │     │
│  │                 │  │                 │  │                 │     │
│  │ [Text → Image]  │  │ [Image → Image] │  │ [Text → Image]  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│       ▲ selected                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Subject Type A — Human Model

```
┌──────────────────────────────────────────────────────────────────────┐
│  Appearance keywords           Expression / mood                     │
│  ┌─────────────────────────┐   ┌──────────────────────────────────┐  │
│  │ e.g. South Asian, 30s,  │   │ e.g. confident, warm, direct     │  │
│  │ navy blazer             │   │ eye contact                      │  │
│  └─────────────────────────┘   └──────────────────────────────────┘  │
│                                                                      │
│  Full appearance description           [+ Generate from keywords]   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Detailed paragraph describing the person — injected directly   │  │
│  │ into image generation prompt.                                  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Aim for 40–80 words for consistent rendering.                       │
│                                                                      │
│  Posture / framing                                                   │
│  ┌───────────────┐ ┌──────────────────┐ ┌─────────┐ ┌───────────┐   │
│  │ Facing camera │ │ Three-quarter    │ │ Profile │ │ Looking up│   │
│  └───────────────┘ └──────────────────┘ └─────────┘ └───────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 Subject Type B — Product / Asset

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                       ⬆                                       │  │
│  │            Upload reference image                             │  │
│  │                 or drag and drop                              │  │
│  │        PNG, JPG, WEBP · max 20MB · up to 3 images             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Product placement                                                   │
│  ┌───────────────┐ ┌──────────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Hero centred  │ │ Lifestyle context│ │Detail close│ │Floating  │ │
│  └───────────────┘ └──────────────────┘ └────────────┘ └──────────┘ │
│                                                                      │
│  Background treatment                                                │
│  ┌──────────────────┐ ┌──────────────────┐ ┌───────────────────┐    │
│  │ Replace          │ │ Extend           │ │ Keep original     │    │
│  │ background       │ │ background       │ │                   │    │
│  └──────────────────┘ └──────────────────┘ └───────────────────┘    │
│  ┌──────────────────┐                                                │
│  │ Abstract blend   │                                                │
│  └──────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.5 Subject Type C — Scene / Abstract

```
┌──────────────────────────────────────────────────────────────────────┐
│  Scene description                                       [+ AI]      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ e.g. A calm Singapore cityscape at dusk,                      │  │
│  │ warm amber light, wide open sky.                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Visual style                                                        │
│  ┌──────────────┐ ┌───────────────────┐ ┌────────────┐              │
│  │Photorealistic│ │Editorial / graphic│ │ Illustrated│              │
│  └──────────────┘ └───────────────────┘ └────────────┘              │
│  ┌──────────────────────┐ ┌────────────┐                             │
│  │ Abstract / painterly │ │ Minimalist │                             │
│  └──────────────────────┘ └────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.6 Subject Fields Summary

**Human Model fields:**

| Field | Type | Required | AI Assist |
|---|---|---|---|
| Appearance keywords | Text input | Yes | No |
| Expression / mood | Text input | Yes | No |
| Full appearance description | Long text | Yes | Yes — Generate from keywords |
| Posture / framing | Single-select chip | Yes | No |

**Product / Asset fields:**

| Field | Type | Required | AI Assist |
|---|---|---|---|
| Reference image(s) | File upload | Yes | No |
| Product placement | Single-select chip | Yes | No |
| Background treatment | Single-select chip | Yes | No |

**Scene / Abstract fields:**

| Field | Type | Required | AI Assist |
|---|---|---|---|
| Scene description | Long text | Yes | Yes |
| Visual style | Single-select chip | Yes | No |

### 6.7 Subject Lock

Once the user proceeds past Step 2 and a composition prompt is generated in Step 4, the subject description or reference image is embedded into the merged prompt. At this point:
- Subject type cannot be changed without clearing composition
- Appearance description on the embedded prompt cannot be overridden per-session
- A **Subject Locked** tag is shown on the Step 5 generate panel

---

## 7. Step 3 — Copy

### 7.1 Purpose

Defines all text that will appear on the poster. Unlike the Video Wizard's single continuous script, the Poster Wizard uses structured copy fields — because every line of text on a poster carries a distinct visual weight, character limit, and purpose.

### 7.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Write your poster copy              [+ Draft all from brief]        │
│  Each field has a distinct visual weight.                            │
│  AI can draft all from your brief.                                   │
│                                                                      │
│  Headline                                                [+ AI]      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ The dominant text — first thing eyes land on                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Optimal: 5–8 words                                                  │
│                                                                      │
│  Subheadline                 [+ AI]   Call to action text  [+ AI]   │
│  ┌───────────────────────────────┐    ┌───────────────────────────┐  │
│  │ Supports headline, context    │    │ e.g. Get a free quote     │  │
│  └───────────────────────────────┘    └───────────────────────────┘  │
│  Optimal: 10–15 words                 Optimal: 3–6 words            │
│                                                                      │
│  Body copy                                               [+ AI]      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1–2 supporting sentences that amplify the headline.            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Optimal: 20–35 words                                                │
│                                                                      │
│  Brand tagline                        Regulatory / disclaimer text   │
│  ┌───────────────────────────────┐    ┌───────────────────────────┐  │
│  │ Healthier, Longer, Better     │    │ MAS-required small print  │  │
│  │ Lives            [from kit]   │    │ (manual only)             │  │
│  └───────────────────────────────┘    └───────────────────────────┘  │
│                                       Not AI-editable               │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│  Tone rewrite                                                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐ ┌────────┐  │
│  │Sharper / Punchier│ │Warmer / More     │ │More      │ │Shorter │  │
│  │                  │ │human             │ │urgent    │ │        │  │
│  └──────────────────┘ └──────────────────┘ └──────────┘ └────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ⚠ Compliance check: Headlines with absolute promises (e.g.    │  │
│  │   "guarantee", "no risk") may breach MAS insurance advertising │  │
│  │   guidelines. Review before proceeding.                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│  Step 3 of 5                          [← Back]       [Continue →]   │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.3 Copy Fields

| Field | Type | Required | AI Assist | Character guidance | Notes |
|---|---|---|---|---|---|
| Headline | Text input | Yes | Yes | 5–8 words | Largest text element; displayed at larger font size in field |
| Subheadline | Text input | No | Yes | 10–15 words | Supporting context; appears below headline |
| Call to action text | Text input | Yes | Yes | 3–6 words | Rendered as a button label on the poster |
| Body copy | Textarea | No | Yes | 20–35 words | 1–2 sentences; amplifies headline |
| Brand tagline | Text input | No | No | Auto-populated | Pulled from brand kit; editable per session |
| Regulatory / disclaimer | Text input | No | No | No limit | Appears at poster base in small type; never AI-generated |

### 7.4 Draft All from Brief

When the user clicks **Draft all from brief**, AI simultaneously generates: Headline, Subheadline, Body copy, and CTA text from the Poster Brief (Step 1) + Tone + Campaign objective. All four fields are populated. The user can accept, edit, or regenerate individual fields independently.

### 7.5 Tone Rewrite

Four tone chips can be applied to all AI-generated copy fields at once:

| Chip | Effect |
|---|---|
| Sharper / Punchier | Shorter sentences, stronger verbs, more direct register |
| Warmer / More human | First-person language, empathetic framing, softer tone |
| More urgent | Deadline-like framing, loss-aversion language, stronger CTA |
| Shorter | Condenses all fields to their minimum viable expression |

Each tone rewrite sends all current copy fields + selected tone to AI and replaces fields with rewritten versions. Previous version is saved internally for a single-level undo.

### 7.6 Character Guidance

Live character/word counts are shown per field. When a field exceeds optimal range, the hint text turns amber. This is advisory only — not a hard block on progression.

---

## 8. Step 4 — Composition

### 8.1 Purpose

Translates the brief, subject, and copy into spatial decisions — the single-frame layout that governs how the generated poster is structured. The primary output of this step is the **Merged Composition Prompt**: a natural-language paragraph that is sent verbatim to the image generation API.

### 8.2 Wireframe — Format & Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Define composition                                                  │
│  Set format, layout, style, and palette.                             │
│  AI assembles these into a single merged generation prompt.          │
│                                                                      │
│  FORMAT ─────────────────────────────────────────────────────────    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  ┌────┐  │ │  ┌────┐  │ │  ┌─────┐ │ │  ┌───┐  │ │  ┌────┐  │  │
│  │  │    │  │ │  │    │  │ │  │     │ │ │  │   │  │ │  │    │  │  │
│  │  │    │  │ │  └────┘  │ │  └─────┘ │ │  │   │  │ │  └────┘  │  │
│  │  └────┘  │ │          │ │          │ │  └───┘  │ │          │  │
│  │ Portrait │ │  Square  │ │Landscape │ │  Story  │ │  Custom  │  │
│  │  A4/A3   │ │1080×1080 │ │   16:9   │ │   9:16  │ │Any size  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                      │
│  LAYOUT TEMPLATE ───────────────────────────────────────────────     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ ┌──────┐ │ │ ┌──┬───┐ │ │ ┌──────┐ │ │ TEXT     │ │ ┌──────┐ │  │
│  │ │ img  │ │ │ │im│txt│ │ │ │      │ │ │ IS THE   │ │ │image │ │  │
│  │ └──────┘ │ │ └──┴───┘ │ │ │ img  │ │ │ VISUAL   │ │ │      │ │  │
│  │ [copy]   │ │          │ │ │      │ │ │          │ │ │[copy]│ │  │
│  │          │ │          │ │ └──────┘ │ │          │ │ └──────┘ │  │
│  │  Hero    │ │  Split   │ │  Frame   │ │  Typo-   │ │  Full    │  │
│  │ dominant │ │  layout  │ │  border  │ │  graphic │ │  bleed   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  Visual hero, copy overlaid at bottom ← descriptor for active card  │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3 Wireframe — Style, Palette & Merged Prompt

```
┌──────────────────────────────────────────────────────────────────────┐
│  VISUAL STYLE ──────────────────────────────────────────────────     │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────────┐               │
│  │Clean &       │ │ Warm &     │ │ Bold &           │               │
│  │corporate     │ │ human      │ │ high-contrast    │               │
│  └──────────────┘ └────────────┘ └──────────────────┘               │
│  ┌──────────────────┐ ┌────────────────┐ ┌─────────────────────┐    │
│  │ Soft &           │ │ Dark &         │ │ Illustrated /       │    │
│  │ aspirational     │ │ premium        │ │ graphic             │    │
│  └──────────────────┘ └────────────────┘ └─────────────────────┘    │
│                                                                      │
│  COLOUR PALETTE ────────────────────────────────────────────────     │
│  ●  ●  ●  ●  ●  ●  [+]   Brand kit colours · click to add custom   │
│  (red)(navy)(green)(gold)(teal)(orange)(add)                         │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│  Merged composition prompt        [AI Generate Composition]         │
│  GENERATED PROMPT — EDITABLE                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ A professional, clean portrait-format poster for AIA Life      │  │
│  │ Insurance, targeting young Singapore professionals. A South    │  │
│  │ Asian woman in her early 30s, long dark hair neatly tied back, │  │
│  │ navy blazer over a white blouse, composed and confident. She   │  │
│  │ occupies the left two-thirds of the frame. Soft warm bokeh     │  │
│  │ background in cream and champagne tones. Dominant AIA red      │  │
│  │ headline text at the bottom third. AIA logo top-right.         │  │
│  │ Premium, refined aesthetic.                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│  Step 4 of 5                          [← Back]       [Continue →]   │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.4 Format Options

| Format | Aspect Ratio | Primary Use |
|---|---|---|
| Portrait (A4 / A3) | 1:√2 | Print posters, branch display, agent handouts |
| Square | 1:1 | Instagram feed, WhatsApp broadcast |
| Landscape | 16:9 | LinkedIn banner, digital signage, presentation inserts |
| Story | 9:16 | Instagram / Facebook Stories, TikTok |
| Custom | User-defined | Any non-standard dimensions |

### 8.5 Layout Templates

| Template | Description | Best for |
|---|---|---|
| Hero dominant | Visual takes 65–75% of frame; copy overlaid at bottom third | Product launches, lifestyle campaigns |
| Split layout | Visual one side, copy the other (left/right or top/bottom) | Informational, product detail |
| Frame / border | Copy arranged around a central visual element | Event posters, announcements |
| Typographic | Copy IS the visual — minimal or no imagery | Urgency messages, text-forward campaigns |
| Full bleed | Full-frame image with semi-transparent text overlay | Brand imagery, emotional campaigns |

### 8.6 Visual Style Options

| Style | Description |
|---|---|
| Clean & corporate | White space, structured grid, minimal decoration |
| Warm & human | Soft lighting, approachable tone, organic elements |
| Bold & high-contrast | High saturation, strong typography, graphic impact |
| Soft & aspirational | Muted palette, gentle gradients, aspirational mood |
| Dark & premium | Dark backgrounds, gold or white accents, luxury feel |
| Illustrated / graphic | Non-photographic, vector-style or hand-drawn aesthetic |

### 8.7 Merged Composition Prompt Construction

The AI Generate Composition function assembles inputs from all prior steps into a single coherent generation prompt:

```
Inputs consumed:
  ├── Step 1: Campaign objective, tone, target audience, poster brief
  ├── Step 2: Subject type + appearance description OR reference image description
  │           + posture / placement / background treatment
  ├── Step 3: Headline, subheadline, body copy (for text placement instructions)
  └── Step 4: Format, layout template, visual style, colour palette

Output:
  └── Merged composition prompt (natural language paragraph)
      Placed in editable text field. User can modify before proceeding.
```

The prompt is the single artifact passed to the image generation API. It is never auto-submitted — the user must review it before clicking Continue to Step 5.

---

## 9. Step 5 — Generate & Refine

### 9.1 Purpose

Triggers AI image generation using the merged composition prompt, presents vCRAFTnts for selection, and provides a conversational refinement interface that allows the user to make targeted adjustments without returning to earlier wizard steps.

### 9.2 Wireframe — Full Generate Step Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Generate your poster                                                │
│  Review vCRAFTnts and refine using the chat panel.                   │
│  Export when ready.                                                  │
│                                                                      │
│  [👤 Human model] [📐 Portrait A4] [Hero dominant] [Text → Image]   │
│                                                                      │
│  ┌─────────────────────────────────┐  ┌──────────────────────────┐  │
│  │  VCRAFTNT THUMBNAILS (4 across)  │  │  REFINE WITH AI      ●   │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│  │  Describe adjustments —  │  │
│  │  │  1  │ │  2  │ │  3  │ │  4  ││  │  colour, scale, position │  │
│  │  └─────┘ └─────┘ └─────┘ └─────┘│  ├──────────────────────────┤  │
│  │    ▲ selected                   │  │                          │  │
│  │                                 │  │ [system] Poster          │  │
│  │  ┌──────────────────────────┐   │  │ generated. Refine below. │  │
│  │  │                          │   │  │                          │  │
│  │  │                          │   │  │         Can you make     │  │
│  │  │   MAIN POSTER PREVIEW    │   │  │         the background   │  │
│  │  │   (selected vCRAFTnt,     │   │  │         warmer?   [user] │  │
│  │  │    full size)            │   │  │                          │  │
│  │  │                          │   │  │ Done — shifted to warm   │  │
│  │  │                          │   │  │ champagne tone.   [ai]   │  │
│  │  │                          │   │  │                          │  │
│  │  └──────────────────────────┘   │  ├──────────────────────────┤  │
│  │                                 │  │ CHANGE LOG               │  │
│  │  [✏ Edit region] [⬆ 2× upscale]│  │ [Warmer background ×]    │  │
│  │  [↓ Export PNG] [↓ Export PDF]  │  │ [Headline larger ×]      │  │
│  │  [↻ Regen all] [+ Save vCRAFTnt] │  │ [CTA moved down ×]       │  │
│  └─────────────────────────────────┘  ├──────────────────────────┤  │
│                                       │ SUGGESTIONS              │  │
│                                       │ [Darken background]      │  │
│                                       │ [Try diff CTA colour]    │  │
│                                       │ [More breathing room]    │  │
│                                       ├──────────────────────────┤  │
│                                       │ ┌──────────────────────┐ │  │
│                                       │ │ e.g. make background  │ │  │
│                                       │ │ warmer…          [↑]  │ │  │
│                                       │ └──────────────────────┘ │  │
│                                       │ Refinements: 3 / 6       │  │
│                                       └──────────────────────────┘  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│  Step 5 of 5                [← Back]              [Export poster ↗] │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.3 VCRAFTnt Generation

On arrival at Step 5, the system automatically dispatches 4 parallel generation requests using the merged composition prompt. Each vCRAFTnt uses a slightly temperature-varied call to produce aesthetic diversity while remaining faithful to the brief.

| Property | Value |
|---|---|
| VCRAFTnt count | 4 |
| Generation mode | Parallel (all 4 simultaneously) |
| Timeout per vCRAFTnt | 60 seconds |
| On partial failure | Show completed vCRAFTnts; mark failed slots with retry option |
| VCRAFTnt selection | Single-select; selected vCRAFTnt is shown in the main preview |

### 9.4 Main Preview

The selected vCRAFTnt is displayed at full scale in the left panel. The preview includes a **copy overlay toggle** — allowing the user to view the raw generated image without text overlay to evaluate the visual independently from the copy placement.

### 9.5 Chat Refinement Interface

The right panel contains a conversational AI interface scoped strictly to **visual refinement of the current poster**. It is not a general-purpose chat.

#### Chat Panel Anatomy

| Zone | Description |
|---|---|
| Chat log | Scrollable thread of system notices, user messages, and AI responses |
| Change log | Pill strip showing all accepted changes; each pill has an ✕ undo button |
| Suggestion chips | 4 pre-populated quick-action suggestions; tapping pre-fills the input |
| Chat input | Textarea accepting natural language refinement requests; Enter to send |
| Turn counter | Shows current refinements vs maximum (6) |

#### Refinement Scope

The chat handles **visual adjustments only**:
- Colour and tone changes ("make the background darker")
- Scale and position changes ("make the headline larger", "move CTA to bottom right")
- Lighting and mood ("add warmer lighting", "increase contrast")
- Element removal ("remove the body copy overlay")

#### Structural Change Detection

If the user's message touches content that lives in a previous wizard step, the system detects this and responds with a redirect nudge instead of processing the change in chat:

```
Trigger keywords / patterns:
  "change the headline text"   → redirect to Step 3 — Copy
  "different layout"           → redirect to Step 4 — Composition
  "change the subject"         → redirect to Step 2 — Subject
  "different format"           → redirect to Step 4 — Composition
  "rewrite the copy"           → redirect to Step 3 — Copy

Redirect response pattern:
  ┌──────────────────────────────────────────────────────────────┐
  │ ℹ That looks like a change to your [copy / layout].         │
  │ Want to go back to:                                          │
  │ [Step 3 — Copy ←]    [Step 4 — Composition ←]               │
  └──────────────────────────────────────────────────────────────┘
```

#### Turn Limit & Save-as-VCRAFTnt Nudge

After 6 refinement turns the AI stops processing new changes and nudges the user:

```
AI response at turn 6:
  "You've made several refinements to this poster. I'd suggest
   saving this as a new vCRAFTnt before continuing, so you don't
   lose the current version."
  [+ Save as vCRAFTnt]
```

The turn counter resets after the user saves as a new vCRAFTnt.

#### Change Log

Every accepted AI refinement is appended as a pill in the Change Log panel. Clicking ✕ on a pill:
1. Removes that change from the log
2. Sends a reversal instruction to the AI
3. Re-renders the poster without that change

Change log is preserved across the session but not exported with the poster.

#### AI Context Per Call

Each refinement call passes:
1. The original merged composition prompt from Step 4
2. The full change history (all accepted changes as a structured list)
3. The current refinement request

The AI has no memory between calls — full context is reconstructed each time.

### 9.6 Export Options

| Option | Format | Resolution | Use case |
|---|---|---|---|
| Export PNG | PNG | 1× screen resolution | Digital channels, email, social |
| Export PNG (2× upscale) | PNG | 2× via AI upscale | High-DPI digital, large format digital |
| Export PDF (print-ready) | PDF | 300 DPI, CMYK | Print production |
| Save as vCRAFTnt | Internal | Same as source | Preserve current state before further refinement |

### 9.7 Edit Region (Inpainting)

When the user clicks **Edit region**:
1. The main preview enters selection mode
2. User draws a bounding box over any area of the poster
3. A description input appears: "Describe what should change in this area"
4. The AI regenerates only the selected region, preserving the rest of the image
5. The change is added to the change log as "Region edit: [description]"

```
Inpainting wireframe (overlay state):
  ┌──────────────────────────────────────────┐
  │                                          │
  │    ╔══════════════════╗                  │
  │    ║                  ║ ← drag to select │
  │    ║   SELECTED       ║                  │
  │    ║   REGION         ║                  │
  │    ╚══════════════════╝                  │
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │ Describe the change for this area: │  │
  │  │ ┌──────────────────────────────┐   │  │
  │  │ │ e.g. replace with darker     │   │  │
  │  │ │ bokeh background        [↑]  │   │  │
  │  │ └──────────────────────────────┘   │  │
  │  └────────────────────────────────────┘  │
  └──────────────────────────────────────────┘
```

---

## 10. AI Assist Features

### 10.1 Summary Table

| Feature | Step | Trigger | Input | Output |
|---|---|---|---|---|
| Generate Brief | 1 | Button | Objective, audience, tone, CTA | Poster brief paragraph |
| Generate Appearance Description | 2 | Button | Appearance keywords + posture | Detailed appearance paragraph |
| Generate Scene Description | 2 (Type C) | Button | Visual style + brief | Scene description paragraph |
| Draft All Copy | 3 | Button | Brief + tone + objective | Headline, subhead, body, CTA text |
| Draft Field | 3 | Per-field chip | Brief + tone + field context | Single copy field |
| Tone Rewrite | 3 | Chip | All copy fields + tone | All copy fields rewritten |
| Generate Composition | 4 | Button | All prior step outputs | Merged composition prompt |
| Poster Refinement | 5 | Chat input | Original prompt + change history + new request | Updated poster image |

### 10.2 AI Behaviour Rules (All Features)

- While any AI call is in progress, its triggering button is disabled to prevent duplicate submissions
- If an AI call fails, existing field content is preserved unchanged and an error message appears near the trigger
- AI-generated content fills the relevant field but is not committed until the user proceeds or explicitly saves
- The AI has no memory between independent calls — each call is self-contained
- Refinement calls in Step 5 maintain continuity only by passing the full change history as explicit context

---

## 11. Compliance Engine

### 11.1 Scope

The compliance engine operates on the **copy fields** in Step 3. It is advisory — it surfaces warnings inline but does not block progression.

### 11.2 Flagged Patterns

The following pattern types trigger a compliance warning:

| Pattern Type | Example phrases | MAS basis |
|---|---|---|
| Absolute performance claims | "guaranteed returns", "no risk", "best in market" | FAA Advertisement Guidelines |
| Unqualified superlatives | "the cheapest", "the only", "number one" | MAS Notice FAA-N16 |
| Misleading certainty | "you will receive", "definitely pays out" | Insurance Act advertising provisions |
| Missing product qualifier | Headline implying investment when it is insurance | Product description requirements |

### 11.3 Warning Presentation

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠ Compliance check                                                 │
│ Your headline contains "guaranteed" which may breach MAS           │
│ insurance advertising guidelines (FAA-N16). Consider:              │
│ "protected" / "covered" / "secured"                                │
└────────────────────────────────────────────────────────────────────┘
```

Warnings appear inline below the relevant field, not as a modal. The user may proceed despite warnings — the warning state is recorded in the poster's audit metadata.

### 11.4 Regulatory Text Field

The Regulatory / disclaimer text field is intentionally excluded from AI generation. It must be manually entered. This field is never overwritten by any AI feature. Content from this field is placed at the base of the poster in the smallest permissible type size.

---

## 12. Business Rules & Constraints

### 12.1 Subject Lock

Once the user reaches Step 5 and generation is triggered, the subject (appearance description or reference image) is embedded in the merged prompt. Changing the subject requires re-generating the composition (Step 4) which clears the current vCRAFTnt set.

### 12.2 One Active Generation Job Per Session

Only one generation job (4 vCRAFTnts) may be active per poster session at a time. Triggering a new generation (via Regenerate All) cancels any in-progress job.

### 12.3 Copy Changes Do Not Retroactively Update Merged Prompt

If the user navigates back to Step 3 and edits copy after the merged prompt has been generated, the prompt is marked **stale** and the user is shown a prompt to regenerate it before proceeding to Step 5.

```
Stale prompt banner (Step 4):
  ┌────────────────────────────────────────────────────────────────┐
  │ ⚠ Your copy has changed since this prompt was generated.      │
  │ Regenerate the composition prompt to reflect your latest copy. │
  │ [Regenerate composition]                                       │
  └────────────────────────────────────────────────────────────────┘
```

### 12.4 Regulatory Field Always Printed

If the Regulatory / disclaimer field contains text, it is always rendered on the poster regardless of layout template. Its position (bottom of poster) and size (minimum legible, never overriding primary copy) are system-enforced.

### 12.5 Maximum Refinement Turns

The chat refinement interface caps at 6 turns per vCRAFTnt state. On reaching turn 6, the AI responds with a save-as-vCRAFTnt nudge. The cap exists to prevent compounding prompt drift that degrades image quality.

### 12.6 Brand Kit Precedence

Brand tagline and colour palette are auto-populated from the brand kit if one is defined for the user's organisation. Users may override per session, but overrides are not saved back to the brand kit.

### 12.7 Reference Image Handling (Image → Image Mode)

- Uploaded reference images are stored temporarily for the session only
- They are not saved to the poster's persistent record
- Maximum 3 reference images per session
- Files must be PNG, JPG, or WEBP; maximum 20 MB each

---

## 13. States & Transitions

### 13.1 Poster Generation State Machine

```
User clicks Continue on Step 4
          │
          ▼
    ┌──────────┐
    │ QUEUED   │  ← All 4 vCRAFTnt jobs dispatched
    └────┬─────┘
         │  Workers pick up jobs
         ▼
    ┌──────────────┐
    │  GENERATING  │  ← 4 parallel image generation calls
    └──────┬───────┘
           │
     ┌─────┴──────┐
     │             │
     ▼             ▼
 ┌───────┐    ┌────────┐
 │ READY │    │ FAILED │
 └───┬───┘    └───┬────┘
     │             │
     │  (partial   │  (show completed vCRAFTnts;
     │   failure)  │   retry failed slots)
     └──────┬──────┘
            ▼
    User selects vCRAFTnt
            │
            ▼
    ┌──────────────┐
    │  REFINEMENT  │  ← Chat loop (max 6 turns)
    └──────┬───────┘
           │
     ┌─────┴──────┐
     │             │
     ▼             ▼
 ┌────────┐   ┌──────────────┐
 │EXPORTED│   │ SAVED AS     │
 │        │   │ NEW VCRAFTNT  │ ← resets turn counter
 └────────┘   └──────────────┘
```

### 13.2 Step Navigation State

```
Step 1 → filled required fields → Continue enabled
Step 2 → subject type selected + required fields filled → Continue enabled
Step 3 → headline + CTA filled → Continue enabled
         (compliance warnings shown but do not block)
Step 4 → merged prompt generated → Continue enabled
         (prompt must be generated at least once; stale state blocks Continue)
Step 5 → generation complete → Export enabled
         ← Back always available on all steps
         → Forward navigation only via Continue button
```

### 13.3 Chat Refinement Message States

| Message Type | Sender | Appearance | Description |
|---|---|---|---|
| System notice | System | Centred italic grey text | Status messages (e.g. "Poster generated") |
| User message | User | Right-aligned, AIA red background | User's refinement request |
| AI response | AI | Left-aligned, light grey background | AI's confirmation and description of change |
| Redirect notice | System | Left-aligned, blue info box with action buttons | Structural change detected; redirects to wizard step |
| Turn limit notice | AI | Left-aligned, grey background | Nudge to save as vCRAFTnt at turn 6 |

---

## 14. Non-Functional Requirements

### 14.1 Performance

| Operation | Target |
|---|---|
| AI field generation (brief, copy, appearance) | < 5 seconds |
| Composition prompt generation | < 8 seconds |
| VCRAFTnt generation (4 parallel) | < 45 seconds |
| Chat refinement turn response | < 15 seconds |
| 2× upscale | < 30 seconds |
| PDF export (print-ready) | < 20 seconds |

### 14.2 Availability

- Wizard UI must remain fully functional even when AI generation is unavailable (fields remain editable manually)
- Generation failures must present actionable retry options, not dead ends
- Export must be available for any successfully generated vCRAFTnt regardless of chat refinement state

### 14.3 Data Retention

| Data type | Retention |
|---|---|
| Poster brief, copy fields | Persistent — saved to project |
| Merged composition prompt | Persistent — saved to poster record |
| Generated image vCRAFTnts | 90 days from creation |
| Reference images (upload) | Session only — deleted on session end |
| Chat refinement log | 30 days |
| Change log pills | Session only — not persisted |
| Compliance warning audit trail | Persistent — attached to poster record |

### 14.4 Accessibility

- All interactive controls must be keyboard-navigable
- Step indicator must communicate current step state to screen readers via CRAFT roles
- Chat input must be labelled correctly for assistive technology
- Colour is never the sole means of conveying state (selected/active states use border + fill changes, not colour alone)

### 14.5 Mobile

- Wizard is desktop-first
- On mobile (< 768px), the Generate step chat panel stacks below the poster preview (vertical layout)
- VCRAFTnt thumbnails compress to a horizontal scroll strip on mobile
- All other steps are single-column on mobile

---

## 15. Out of Scope

The following are explicitly out of scope for Poster Wizard v1.0:

| Item | Rationale |
|---|---|
| Multi-page poster / brochure | Separate flow; requires layout engine beyond single-frame |
| Template library (pre-built designs) | Future phase; requires template curation workflow |
| Direct social media publishing | Requires platform OAuth integration; separate initiative |
| Version history / full revision history | v2 feature; current scope covers single-level undo only |
| Team collaboration / shared editing | Requires real-time sync infrastructure; separate initiative |
| Custom font upload | Brand kit fonts only for v1; custom fonts in v2 |
| Video export (animated poster) | Handled by Video Wizard; out of scope for this document |
| A/B testing of vCRAFTnts | Downstream analytics feature; not part of creation flow |

---

*This document describes the CRAFT Poster Wizard as designed for v1.0 release. Image generation uses text-to-image and image-to-image APIs. The chat refinement architecture passes full context per call; no session memory is assumed at the API layer. Compliance flag patterns are based on MAS FAA-N16 and Insurance Act advertising provisions as of April 2026 and should be reviewed against current MAS guidance before production release.*
