# CRAFT My Studio — Product Requirements Document

**Product:** CRAFT (AIA Marketing Intelligence Platform)
**Feature:** My Studio
**Version:** 1.0
**Date:** April 2026
**Author:** Product — CRAFT Team
**Status:** Draft for Review

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Stories](#3-user-stories)
4. [Navigation & Tab Placement](#4-navigation--tab-placement)
5. [My Studio — Page Layout](#5-my-studio--page-layout)
6. [Image Library](#6-image-library)
7. [Upload Flow](#7-upload-flow)
8. [Quick Action Menu](#8-quick-action-menu)
9. [AI Enhancement Workflow](#9-ai-enhancement-workflow)
10. [Prompt Builder](#10-prompt-builder)
11. [Multi-Image Batch Workflow](#11-multi-image-batch-workflow)
12. [Image Detail View](#12-image-detail-view)
13. [AI Assist Features](#13-ai-assist-features)
14. [Business Rules & Constraints](#14-business-rules--constraints)
15. [States & Transitions](#15-states--transitions)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Out of Scope](#17-out-of-scope)

---

## 1. Overview

### 1.1 Purpose

My Studio is a personal image workspace within CRAFT where users — primarily AIA agents and marketing staff — can store, organise, enhance, and generate images using AI. It sits as a dedicated top-level tab in the CRAFT navigation, adjacent to the Analytics tab.

My Studio serves two distinct but connected use cases:

**Library** — A personal repository for photos, generated images, and exported poster assets. Users own this space. Assets stored here persist across sessions and are private to the individual user unless explicitly shared.

**AI Image Workflows** — A lightweight AI-powered pipeline that takes an existing photo (casual, personal, product), collects basic intent from the user, uses AI to construct an enriched generation prompt, and produces a refined or newly generated image. This is not the full Poster Wizard — it is a fast, informal, image-first workflow for quick creative output.

### 1.2 What Makes This Different from the Poster Wizard

| Dimension | Poster Wizard | My Studio |
|---|---|---|
| Entry intent | "I want to create a marketing poster" | "I have a photo I want to do something with" |
| Structure | Guided 5-step wizard | Flexible image library + lightweight workflow |
| Output | Finished, branded, compliant poster | Enhanced or generated image (raw asset) |
| AI depth | Full brief → copy → composition pipeline | Intent collection → prompt builder → image generation |
| Branding | Brand kit enforced | Optional — user's personal creative space |
| Compliance | MAS compliance engine active | Advisory only — not a publishing workflow |
| Session length | 10–20 minutes | 2–5 minutes |

My Studio produces raw image assets. These assets can then be used as reference images inside the Poster Wizard (Image → Image mode), creating a natural upstream connection between the two features.

### 1.3 Tab Naming Rationale

The tab is named **My Studio**.

- "My" establishes personal ownership — this is the user's private creative space, distinct from shared project workspaces
- "Studio" signals creative production capability, not just file storage
- The name is short, memorable, and complements the existing navigation vocabulary (Dashboard, Projects, Analytics, My Studio)

---

## 2. Goals & Success Metrics

### 2.1 Goals

- Give users a persistent, personal space to store photos and generated image assets
- Reduce the barrier to AI image enhancement by replacing prompt-writing with guided intent collection
- Enable users to go from a casual photo to a professional-quality image in under 3 minutes
- Create a natural upstream asset pipeline feeding into the Poster Wizard
- Support batch workflows so users can process multiple images without repeating setup

### 2.2 Success Metrics

| Metric | Target |
|---|---|
| Median time from image upload to first enhanced output | < 3 minutes |
| % of AI-generated prompts accepted without major manual edits | > 60% |
| Weekly active users uploading at least one image | > 40% of CRAFT users |
| % of My Studio outputs subsequently used in Poster Wizard | > 25% |
| User satisfaction score (post-generation survey) | > 4.0 / 5.0 |

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | AIA agent | Upload my casual headshot and get a professional-looking version | I have a quality photo for marketing materials without a photoshoot |
| US-02 | Marketing staff | Keep all my image assets in one personal space | I don't have to search across drives and email for photos |
| US-03 | AIA agent | Describe what I want in simple words and have AI write the detailed prompt | I can get great results without knowing how to write image prompts |
| US-04 | Marketing manager | Select multiple photos and apply the same enhancement workflow | I can process a batch of agent headshots consistently |
| US-05 | AIA agent | See a before/after comparison of my original and enhanced image | I can decide whether the AI output is worth keeping |
| US-06 | AIA agent | Use an image from My Studio directly in the Poster Wizard | I don't have to re-upload assets I already have in CRAFT |
| US-07 | Marketing staff | Save generated images back to My Studio automatically | My library grows with every generation run |
| US-08 | AIA agent | Quickly touch up an image from the library with one click | I don't have to re-enter intent for minor vCRAFTtions |

---

## 4. Navigation & Tab Placement

### 4.1 Top Navigation Bar

My Studio is added as a persistent top-level tab in the CRAFT navigation bar, positioned between Projects and Analytics:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CRAFT                                                            [avatar] │
├────────────┬────────────┬──────────────┬─────────────┬────────────────── │
│  Dashboard │  Projects  │  My Studio ● │  Analytics  │                   │
└────────────┴────────────┴──────────────┴─────────────┴────────────────── │

● = active tab indicator (AIA red underline)
```

### 4.2 Navigation Rules

- My Studio is always visible in the top nav regardless of active project context
- Clicking My Studio from inside a project context preserves the project in the background
- My Studio content is user-scoped — switching users shows a different library
- Deep linking is supported: `/studio`, `/studio/image/{id}`, `/studio/workflow/{id}`

---

## 5. My Studio — Page Layout

### 5.1 Full Page Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CRAFT    Dashboard   Projects   [My Studio]   Analytics        [avatar]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  My Studio                                                               │
│  Your personal image workspace. Store, enhance, and generate images.     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  TOOLBAR                                                            │ │
│  │  [+ Upload images]  [+ New image from prompt]  [⚡ Batch workflow]  │ │
│  │                                         [🔍 Search]  [⊞ Grid ⊟ List│ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  FILTER BAR                                                         │ │
│  │  [All]  [Photos]  [AI Generated]  [Enhanced]  [Poster exports]      │ │
│  │                              Sort: [Newest first ▾]                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │          │  │          │  │          │  │          │  │          │  │
│  │  [image] │  │  [image] │  │  [image] │  │  [image] │  │  [image] │  │
│  │          │  │          │  │          │  │          │  │          │  │
│  │ □        │  │ □        │  │ □        │  │ □        │  │ □        │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │ Headshot │  │ Product  │  │ Team     │  │ Office   │  │ Campaign │  │
│  │ Apr 2026 │  │ Apr 2026 │  │ Mar 2026 │  │ Mar 2026 │  │ Mar 2026 │  │
│  │ [Photo]  │  │ [Photo]  │  │[AI Gen]  │  │[Enhanced]│  │ [Export] │  │
│  │ ···      │  │ ···      │  │ ···      │  │ ···      │  │ ···      │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  [image] │  │  [image] │  │  [image] │  │  [image] │                 │
│  │          │  │          │  │          │  │          │                 │
│  │ □        │  │ □        │  │ □        │  │ □        │                 │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤                 │
│  │ Profile  │  │ Banner   │  │ Event    │  │ Agent    │                 │
│  │ Mar 2026 │  │ Feb 2026 │  │ Feb 2026 │  │ Feb 2026 │                 │
│  │[Enhanced]│  │[AI Gen]  │  │ [Photo]  │  │ [Photo]  │                 │
│  │ ···      │  │ ···      │  │ ···      │  │ ···      │                 │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Toolbar Actions

| Action | Description |
|---|---|
| + Upload images | Opens file picker; supports single or multi-select upload |
| + New image from prompt | Opens Prompt Builder workflow (no source image required) |
| ⚡ Batch workflow | Opens batch mode; only active when 2+ images are selected |
| Search | Filters library by filename, tag, or date |
| Grid / List toggle | Switches between grid view (default) and list view |

### 5.3 Filter Bar

| Filter | Shows |
|---|---|
| All | Every image in the library |
| Photos | User-uploaded images that have not been AI-processed |
| AI Generated | Images created entirely from a prompt (no source image) |
| Enhanced | Uploaded images that have been AI-processed |
| Poster exports | Images exported from the Poster Wizard |

---

## 6. Image Library

### 6.1 Grid View — Image Card

```
┌────────────────────────────┐
│                            │
│                            │
│       [image preview]      │
│                            │
│                            │
│ □  ━━━━━━━━━━━━━━━━━━━━━━  │  ← checkbox for batch select
├────────────────────────────┤
│ Headshot April             │  ← filename (truncated)
│ 12 Apr 2026  [Photo]       │  ← date + type tag
│ ···                        │  ← overflow menu trigger
└────────────────────────────┘

Type tags:
  [Photo]         — user upload, unprocessed
  [AI Generated]  — created from prompt
  [Enhanced]      — upload + AI processing applied
  [Poster export] — output from Poster Wizard
```

### 6.2 List View — Image Row

```
┌──────────────────────────────────────────────────────────────────────────┐
│ □  [thumb]  Headshot April        [Photo]    12 Apr 2026  1.2 MB   ···  │
│ □  [thumb]  Product shot v2       [Enhanced] 10 Apr 2026  2.8 MB   ···  │
│ □  [thumb]  Team photo            [AI Gen]   08 Apr 2026  3.1 MB   ···  │
│ □  [thumb]  Office banner         [Enhanced] 04 Apr 2026  4.0 MB   ···  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Selection State (Batch Mode)

Clicking any checkbox activates batch mode. A selection bar replaces the toolbar:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  3 images selected   [✕ Clear]           [⚡ Batch workflow]  [🗑 Delete]│
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Image Card — Overflow Menu (···)

```
  ┌──────────────────────────────┐
  │ ⚡ Enhance with AI           │  ← triggers Enhancement Workflow
  │ 🪄 Generate vCRAFTtion        │  ← uses this image as reference
  │ 🔀 Use in Poster Wizard      │  ← opens Poster Wizard with image pre-loaded
  │ ✏ Rename                    │
  │ ⬇ Download                  │
  │ 🗑 Delete                    │
  └──────────────────────────────┘
```

---

## 7. Upload Flow

### 7.1 Upload Entry Points

- Toolbar: **+ Upload images** button
- Drag and drop anywhere on the library grid
- From inside a workflow (add image mid-workflow)

### 7.2 Upload Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│              ┌────────────────────────────────────────────┐             │
│              │                                            │             │
│              │                  ⬆                         │             │
│              │         Upload your images                 │             │
│              │         or drag and drop here              │             │
│              │                                            │             │
│              │   PNG, JPG, WEBP, HEIC  ·  max 25MB each  │             │
│              │   Up to 20 images per upload               │             │
│              │                                            │             │
│              │         [Browse files]                     │             │
│              │                                            │             │
│              └────────────────────────────────────────────┘             │
│                                                                          │
│  After selecting files — upload progress:                                │
│                                                                          │
│  headshot_april.jpg     ████████████████████  Done     [✓]              │
│  product_shot.png       ████████████░░░░░░░░  67%      [...]            │
│  team_photo.heic        ░░░░░░░░░░░░░░░░░░░░  Queued   [—]              │
│                                                                          │
│  Once uploaded, do you want to enhance these images with AI?            │
│  [Yes, enhance now →]    [No, save to library]                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Post-Upload Prompt

After upload completes, the system offers a contextual shortcut:

- **Yes, enhance now →** — passes the uploaded image(s) directly into the AI Enhancement Workflow (single image) or Batch Workflow (multiple images)
- **No, save to library** — images are saved to the library grid with type tag [Photo]; no further action

---

## 8. Quick Action Menu

### 8.1 Hover State on Image Card

On hover over any image card, three quick-action icons appear in the top-right corner of the thumbnail:

```
┌────────────────────────────┐
│                   [⚡][🪄][⋯]│  ← hover reveals icons
│                            │
│       [image preview]      │
│                            │
│                            │
│ □                          │
├────────────────────────────┤
│ Headshot April             │
│ 12 Apr 2026  [Photo]       │
└────────────────────────────┘

⚡  = Enhance with AI (triggers Enhancement Workflow)
🪄  = Generate vCRAFTtion (uses as Image → Image reference)
⋯  = Full overflow menu
```

### 8.2 Quick Action Trigger Behaviour

| Icon | Single image behaviour | Multi-image behaviour (batch) |
|---|---|---|
| ⚡ Enhance | Opens Enhancement Workflow for this image | Opens Batch Workflow for all selected images |
| 🪄 VCRAFTtion | Opens Prompt Builder with image as reference | Not available in batch mode |
| ⋯ | Full overflow menu | Not available; batch actions shown in selection bar |

---

## 9. AI Enhancement Workflow

### 9.1 Purpose

A lightweight, guided workflow that takes a source image, collects simple intent from the user, uses AI to construct an enriched image generation prompt, and produces an enhanced or re-generated version. Designed for completion in under 3 minutes.

### 9.2 Workflow Steps

```
Source image selected
        │
        ▼
  Step 1: Intent
  What do you want to do
  with this image?
        │
        ▼
  Step 2: Style inputs
  Simple guided questions
  about the desired output
        │
        ▼
  Step 3: Prompt Builder
  AI constructs enriched
  prompt; user reviews/edits
        │
        ▼
  Step 4: Generate
  AI generates output;
  before/after comparison;
  save or discard
```

### 9.3 Step 1 — Intent Collection Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← My Studio                                                             │
│                                                                          │
│  What would you like to do with this image?                              │
│                                                                          │
│  ┌────────────────────────┐    ┌────────────────────────────────────┐    │
│  │                        │    │                                    │    │
│  │   [source image]       │    │  ┌──────────────────────────────┐  │    │
│  │                        │    │  │  ✨  Make it professional    │  │    │
│  │   headshot_april.jpg   │    │  │  Transform casual photo to   │  │    │
│  │   Original · 1.2MB     │    │  │  a polished, professional    │  │    │
│  │                        │    │  │  headshot or portrait        │  │    │
│  └────────────────────────┘    │  └──────────────────────────────┘  │    │
│                                │                                    │    │
│                                │  ┌──────────────────────────────┐  │    │
│                                │  │  🎨  Change the background   │  │    │
│                                │  │  Keep the subject; replace   │  │    │
│                                │  │  or extend the background    │  │    │
│                                │  └──────────────────────────────┘  │    │
│                                │                                    │    │
│                                │  ┌──────────────────────────────┐  │    │
│                                │  │  🌟  Enhance quality         │  │    │
│                                │  │  Improve lighting, sharpness,│  │    │
│                                │  │  colour, and overall quality │  │    │
│                                │  └──────────────────────────────┘  │    │
│                                │                                    │    │
│                                │  ┌──────────────────────────────┐  │    │
│                                │  │  🔀  Generate a vCRAFTtion    │  │    │
│                                │  │  Create a new image inspired │  │    │
│                                │  │  by this photo's style/mood  │  │    │
│                                │  └──────────────────────────────┘  │    │
│                                │                                    │    │
│                                │  ┌──────────────────────────────┐  │    │
│                                │  │  ✏  Custom                   │  │    │
│                                │  │  Describe what you want in   │  │    │
│                                │  │  your own words              │  │    │
│                                │  └──────────────────────────────┘  │    │
│                                └────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Intent Options

| Intent | Description | Generation mode |
|---|---|---|
| Make it professional | Casual → polished; attire, background, lighting adjusted | Image → Image |
| Change the background | Subject preserved; background replaced or extended | Image → Image (inpaint) |
| Enhance quality | Upscale, colour correct, lighting improve | Image → Image |
| Generate a vCRAFTtion | New image inspired by source; same mood/subject | Image → Image |
| Custom | User writes their own starting intent | Image → Image or Text → Image |

### 9.5 Step 2 — Style Inputs Wireframe

Style inputs adapt based on the selected intent. Example shown for **Make it professional**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Tell us a little more                                                   │
│  Answer a few quick questions to guide the AI.                           │
│                                                                          │
│  ┌────────────────────────┐    ┌────────────────────────────────────┐    │
│  │                        │    │                                    │    │
│  │   [source image]       │    │  Setting / background              │    │
│  │                        │    │  ┌──────────┐ ┌──────────┐         │    │
│  │                        │    │  │  Office  │ │  Outdoor │         │    │
│  │                        │    │  └──────────┘ └──────────┘         │    │
│  └────────────────────────┘    │  ┌──────────┐ ┌──────────┐         │    │
│                                │  │  Studio  │ │  Blurred │         │    │
│                                │  │  (plain) │ │  (bokeh) │         │    │
│                                │  └──────────┘ └──────────┘         │    │
│                                │                                    │    │
│                                │  Attire / style                    │    │
│                                │  ┌──────────┐ ┌──────────────────┐ │    │
│                                │  │ Keep     │ │ Make more formal │ │    │
│                                │  │ current  │ └──────────────────┘ │    │
│                                │  └──────────┘                      │    │
│                                │                                    │    │
│                                │  Mood / expression                 │    │
│                                │  ┌──────────┐ ┌──────────┐         │    │
│                                │  │Confident │ │  Warm /  │         │    │
│                                │  │/ Composed│ │ Friendly │         │    │
│                                │  └──────────┘ └──────────┘         │    │
│                                │  ┌──────────┐                      │    │
│                                │  │Approachab│                      │    │
│                                │  └──────────┘                      │    │
│                                │                                    │    │
│                                │  Anything specific to add?         │    │
│                                │  ┌──────────────────────────────┐  │    │
│                                │  │ e.g. keep glasses, no tie,   │  │    │
│                                │  │ warmer skin tones             │  │    │
│                                │  └──────────────────────────────┘  │    │
│                                └────────────────────────────────────┘    │
│                                                                          │
│                                           [← Back]  [Build prompt →]    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.6 Style Input Fields by Intent Type

**Make it professional:**

| Field | Type | Options |
|---|---|---|
| Setting / background | Multi-select chip | Office, Outdoor, Studio (plain), Blurred (bokeh) |
| Attire / style | Single-select chip | Keep current, Make more formal |
| Mood / expression | Single-select chip | Confident / Composed, Warm / Friendly, Approachable |
| Additional notes | Text input | Free text; optional |

**Change the background:**

| Field | Type | Options |
|---|---|---|
| New background type | Single-select chip | Office interior, Outdoor nature, City skyline, Abstract, Plain colour, Custom (describe) |
| Lighting match | Toggle | Match original / Relight for new background |
| Background description | Text input | Free text; required if Custom selected |

**Enhance quality:**

| Field | Type | Options |
|---|---|---|
| Focus areas | Multi-select chip | Lighting, Sharpness / clarity, Colour balance, Skin tones, Background blur |
| Output resolution | Single-select | Same as original / 2× upscale / 4× upscale |

**Generate a vCRAFTtion:**

| Field | Type | Options |
|---|---|---|
| How different? | Slider | Subtle (10%) ←──────→ Very different (90%) |
| Keep consistent | Multi-select chip | Subject identity, Colour palette, Composition, Mood |
| Style direction | Single-select chip | Same style, More professional, More artistic, More vibrant |

**Custom:**

| Field | Type | Options |
|---|---|---|
| Describe what you want | Long text | Free text; required |
| Use source as reference | Toggle | On / Off |

---

## 10. Prompt Builder

### 10.1 Purpose

The Prompt Builder is the AI layer that sits between the user's simple intent inputs (Step 2) and the image generation API call. It takes the structured inputs and source image context and constructs an optimised, detailed generation prompt. The user sees this prompt before generation fires.

This step is the core differentiator of My Studio. Users should never need to write a generation prompt manually — they answer plain-language questions, and AI handles prompt engineering.

### 10.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Your AI-built prompt                                                    │
│  Built from your inputs. Review, edit, or regenerate before generating.  │
│                                                                          │
│  ┌────────────────────────┐    ┌────────────────────────────────────┐    │
│  │                        │    │                                    │    │
│  │   [source image]       │    │  GENERATED PROMPT — EDITABLE       │    │
│  │   Original             │    │  ┌──────────────────────────────┐  │    │
│  │                        │    │  │ A professional corporate     │  │    │
│  │                        │    │  │ headshot of a South Asian    │  │    │
│  │                        │    │  │ man in his 30s, wearing a    │  │    │
│  │                        │    │  │ well-fitted navy blazer,     │  │    │
│  │                        │    │  │ composed and confident       │  │    │
│  │                        │    │  │ expression, direct eye       │  │    │
│  │                        │    │  │ contact. Soft-focus modern   │  │    │
│  │                        │    │  │ office background with warm  │  │    │
│  │                        │    │  │ ambient bokeh lighting.      │  │    │
│  │                        │    │  │ Clean, premium aesthetic.    │  │    │
│  │                        │    │  │ 85mm portrait lens feel.     │  │    │
│  │                        │    │  └──────────────────────────────┘  │    │
│  └────────────────────────┘    │                                    │    │
│                                │  [↻ Regenerate prompt]             │    │
│                                │                                    │    │
│                                │  ─────────────────────────────     │    │
│                                │                                    │    │
│                                │  WHAT THE AI ADDED FOR YOU         │    │
│                                │  Based on your inputs, the AI      │    │
│                                │  enriched your prompt with:        │    │
│                                │  · Lens / camera style cues        │    │
│                                │  · Specific lighting description   │    │
│                                │  · Professional attire language    │    │
│                                │  · Composition framing guidance    │    │
│                                └────────────────────────────────────┘    │
│                                                                          │
│  Number of vCRAFTtions to generate                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                    │
│  │  1   │ │  2   │ │  4 ● │ │  8   │                                    │
│  └──────┘ └──────┘ └──────┘ └──────┘                                    │
│                                                                          │
│                                    [← Back]    [Generate images →]      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Prompt Construction Logic

The Prompt Builder AI call receives:
1. Source image (as base64 for analysis, if Image → Image mode)
2. Intent type (from Step 1)
3. All style inputs (from Step 2)
4. User's additional notes (if any)

The AI constructs a prompt that includes:

| Element | Source | Example |
|---|---|---|
| Subject description | Inferred from source image analysis | "A South Asian man in his 30s" |
| Intent framing | Selected intent type | "Professional corporate headshot" |
| Style language | Style chip selections | "Soft-focus office background" |
| Technical cues | AI-added enrichment | "85mm portrait lens feel, shallow depth of field" |
| Lighting | Style selection + AI enrichment | "Warm ambient bokeh lighting" |
| Composition | AI-added enrichment | "Centred composition, direct camera engagement" |
| Negative guidance | AI-added enrichment | Internally appended; not shown to user |

### 10.4 "What the AI Added" Panel

The semi-transparent breakdown panel explains in plain language what the AI enriched beyond the user's inputs. This builds user trust and helps them understand what makes a good prompt — without requiring them to know it upfront.

### 10.5 VCRAFTtion Count

The user selects how many vCRAFTnts to generate: 1, 2, 4, or 8. Default is 4. Selecting 8 requires a confirmation step noting longer generation time.

### 10.6 Prompt Regeneration

If the user clicks **↻ Regenerate prompt**, the AI produces an alternative formulation of the same intent. Up to 3 regenerations are allowed per workflow run. The previous prompt is preserved and can be restored.

---

## 11. Multi-Image Batch Workflow

### 11.1 Purpose

Allows the user to apply the same AI enhancement workflow to multiple images simultaneously. Designed for scenarios like processing a set of agent headshots or a product photo series with consistent style.

### 11.2 Entry Points

- Toolbar: **⚡ Batch workflow** button (requires 2+ images selected)
- Selection bar: **⚡ Batch workflow** button (appears when 2+ images are checked)
- Post-upload: **Yes, enhance now** after uploading 2+ images

### 11.3 Batch Workflow Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← My Studio                                                             │
│                                                                          │
│  Batch workflow                                4 images selected         │
│  Apply the same AI enhancement to all selected images.                  │
│                                                                          │
│  SELECTED IMAGES ─────────────────────────────────────────────────────  │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                                 │
│  │[img1]│  │[img2]│  │[img3]│  │[img4]│   [+ Add more]                  │
│  └──────┘  └──────┘  └──────┘  └──────┘                                 │
│  agent_1   agent_2   agent_3   agent_4                                   │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  STEP 1 — INTENT (applied to all images)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ✨  Make it professional  ●                                     │   │
│  │  🎨  Change the background                                       │   │
│  │  🌟  Enhance quality                                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  STEP 2 — STYLE (applied to all images)                                  │
│  Setting:   [Office ●]  [Outdoor]  [Studio]  [Blurred]                  │
│  Attire:    [Keep current ●]  [Make more formal]                        │
│  Mood:      [Confident ●]  [Warm / Friendly]  [Approachable]            │
│  Notes:     ┌──────────────────────────────────────────────────────┐    │
│             │ Keep each agent's face and hair exactly as-is         │    │
│             └──────────────────────────────────────────────────────┘    │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  GENERATED PROMPT (shared across all images)                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ A professional corporate headshot, composed and confident        │   │
│  │ expression, direct eye contact. Soft-focus modern office         │   │
│  │ background with warm ambient bokeh lighting. Clean, premium      │   │
│  │ aesthetic. Subject identity and facial features preserved.       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  [↻ Regenerate prompt]                                                   │
│                                                                          │
│  VCRAFTtions per image: [1 ●]  [2]  [4]                                  │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  Estimated generation time: ~2 min for 4 images × 1 vCRAFTtion           │
│                                                                          │
│                              [← Cancel]    [Generate all →]             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 11.4 Batch Generation Progress Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Generating your images                                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  agent_1.jpg    ████████████████████  Done     [✓]  [View result] │  │
│  │  agent_2.jpg    ████████████░░░░░░░░  67%      [...]              │  │
│  │  agent_3.jpg    ████░░░░░░░░░░░░░░░░  20%      [...]              │  │
│  │  agent_4.jpg    ░░░░░░░░░░░░░░░░░░░░  Queued   [—]               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  You can leave this page — we'll notify you when all images are ready.  │
│                                                                          │
│  [View completed results as they finish]                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 11.5 Batch Constraints

| Parameter | Value |
|---|---|
| Minimum images for batch | 2 |
| Maximum images per batch run | 20 |
| Maximum vCRAFTtions per image in batch | 4 |
| Maximum total generations per batch | 40 (images × vCRAFTtions) |
| Concurrency | Up to 4 images generated in parallel |
| Individual failure handling | Failed images shown with retry; others complete normally |

---

## 12. Image Detail View

### 12.1 Purpose

A full-screen view for a single image showing the original (if applicable), the generated output, all metadata, and quick actions.

### 12.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← My Studio   /  headshot_april_enhanced.png                            │
│                                                                          │
│  ┌────────────────────────────────────┐  ┌──────────────────────────┐   │
│  │                                    │  │ IMAGE DETAILS            │   │
│  │                                    │  │ ─────────────────────── │   │
│  │                                    │  │ Name    headshot_april   │   │
│  │         [generated image]          │  │ Type    Enhanced         │   │
│  │                                    │  │ Created 12 Apr 2026      │   │
│  │                                    │  │ Size    3.2 MB           │   │
│  │                                    │  │ Dims    1024 × 1536 px   │   │
│  │                                    │  │                          │   │
│  │                                    │  │ SOURCE IMAGE             │   │
│  │                                    │  │ ─────────────────────── │   │
│  └────────────────────────────────────┘  │ [thumb] headshot_apr.jpg │   │
│                                          │         [View original]  │   │
│  [Before / After ↔]                     │                          │   │
│                                          │ PROMPT USED              │   │
│                                          │ ─────────────────────── │   │
│                                          │ A professional corporate │   │
│                                          │ headshot of a South      │   │
│                                          │ Asian man in his 30s...  │   │
│                                          │ [Show full prompt]       │   │
│                                          │                          │   │
│                                          │ ACTIONS                  │   │
│                                          │ ─────────────────────── │   │
│                                          │ [⬇ Download]             │   │
│                                          │ [🔀 Use in Poster Wizard] │   │
│                                          │ [⚡ Enhance further]      │   │
│                                          │ [🪄 Generate vCRAFTtion]   │   │
│                                          │ [🗑 Delete]               │   │
│                                          └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 12.3 Before / After Toggle

When the image has a source original, a **Before / After ↔** toggle activates a split-screen comparison:

```
┌────────────────────────────────────┐
│              │                     │
│   ORIGINAL   │   ENHANCED          │
│              │                     │
│  [original]  │  [generated]        │
│              │                     │
│     ◄── drag to compare ──►        │
└────────────────────────────────────┘
```

The divider is draggable. Dragging left shows more of the enhanced; dragging right shows more of the original.

---

## 13. AI Assist Features

### 13.1 Summary Table

| Feature | Where | Trigger | Input | Output |
|---|---|---|---|---|
| Prompt Builder | Enhancement Workflow Step 3 | Auto after Step 2 | Intent + style inputs + source image | Enriched generation prompt |
| Prompt Regenerate | Enhancement Workflow Step 3 | Button | Same as above | Alternative prompt formulation |
| Scene description AI | Custom intent (Step 2) | Button | User's free text | Expanded, prompt-optimised description |
| Batch prompt builder | Batch Workflow | Auto after style inputs | Intent + style inputs (shared) | Single shared prompt for all images |
| What AI added panel | Prompt Builder screen | Automatic | Generated prompt | Plain-language explanation of enrichments |

### 13.2 Prompt Builder — AI Enrichment Rules

When constructing the generation prompt, the AI:
- Always preserves subject identity language from the source image analysis
- Adds technical photography cues (lens type, depth of field) appropriate to the intent
- Adds lighting descriptors that match the selected mood
- Appends negative guidance internally (blurry, low quality, distorted face, etc.) — not shown to user
- Keeps the visible prompt under 120 words for readability while maintaining full technical richness

### 13.3 AI Behaviour Rules

- Prompt construction triggers automatically on arriving at the Prompt Builder step (no manual trigger needed)
- Loading state is shown while the prompt is being built (spinner + "Building your prompt…")
- If prompt construction fails, the user is shown an empty editable field with a retry button
- The AI does not store prompt history between sessions; prompts are saved only to the image's metadata record

---

## 14. Business Rules & Constraints

### 14.1 Library Capacity

| Parameter | Limit |
|---|---|
| Images per user library | 500 |
| Maximum file size per upload | 25 MB |
| Accepted formats | PNG, JPG, WEBP, HEIC |
| Maximum images per batch run | 20 |
| VCRAFTtions per image (single run) | 1, 2, 4, or 8 |

When the library approaches capacity (>450 images), a banner prompts the user to archive or delete old images before uploading more.

### 14.2 Source Image Retention

- The original uploaded image is retained in the library unless the user explicitly deletes it
- Enhanced / generated outputs are saved as separate entries alongside the original
- Deleting the original does not delete derived outputs; they become standalone records

### 14.3 Image → Image Reference Handling

When a source image is used as a reference for Image → Image generation:
- It is never sent to external services in identifiable form — it is processed as base64 through the CRAFT backend
- No PII extraction or facial recognition is performed by CRAFT itself; the image is passed as a generation reference only
- Reference images from My Studio used in the Poster Wizard follow the same handling rules

### 14.4 Use in Poster Wizard

- Any image in My Studio can be loaded as the Subject reference image in the Poster Wizard (Step 2, Product / Asset type)
- When the user selects **Use in Poster Wizard** from My Studio, the Poster Wizard opens with the image pre-loaded in Step 2 and subject type pre-selected to Product / Asset
- This is a one-way link — changes made in the Poster Wizard do not affect the My Studio record

### 14.5 Compliance Scope

My Studio is a personal workspace. The MAS compliance engine (active in the Poster Wizard copy step) is **not** applied in My Studio workflows. Images generated in My Studio are raw assets intended for personal creative use. Compliance checks apply at the point of publishing — which occurs through the Poster Wizard or other CRAFT publishing flows, not through My Studio itself.

### 14.6 Brand Kit

My Studio workflows do not enforce brand kit colours or typography. The brand kit is available as an optional input in the custom notes field (e.g. "use AIA red tones"), but it is not auto-applied. Brand enforcement is a Poster Wizard concern.

---

## 15. States & Transitions

### 15.1 Image State Machine

```
  User uploads image
          │
          ▼
     ┌─────────┐
     │ STORED  │  ← type tag: [Photo]
     └────┬────┘
          │  User triggers enhancement workflow
          ▼
    ┌──────────────┐
    │  PROCESSING  │  ← AI generation in progress
    └──────┬───────┘
           │
     ┌─────┴──────┐
     │             │
     ▼             ▼
 ┌──────────┐  ┌────────┐
 │ ENHANCED │  │ FAILED │
 │ [saved]  │  │[retry] │
 └──────────┘  └────────┘
     │
     ├── User generates vCRAFTtion → new PROCESSING state for new image
     ├── User uses in Poster Wizard → Poster Wizard flow begins
     └── User downloads → STORED state unchanged
```

### 15.2 Enhancement Workflow Navigation

```
Step 1 (Intent)
   → Intent selected → Step 2 enabled
Step 2 (Style Inputs)
   → Required fields complete → "Build prompt" enabled
   → "Build prompt" clicked → Step 3 loads with auto-built prompt
Step 3 (Prompt Builder)
   → Prompt present (auto or manually written) → "Generate" enabled
   → VCRAFTtions count selected
Step 4 (Generate)
   → Generation completes → images displayed
   → User saves to library → images added to My Studio
   → User discards → no library change; workflow closes
```

### 15.3 Chat Refinement vs Enhancement Workflow

My Studio does not include the chat refinement panel from the Poster Wizard's Generate step. Post-generation adjustments in My Studio are handled by:
- Triggering **Enhance further** from the Image Detail View (re-enters Enhancement Workflow with the generated image as new source)
- Triggering **Generate vCRAFTtion** (re-enters Prompt Builder with original prompt pre-filled and editable)

---

## 16. Non-Functional Requirements

### 16.1 Performance

| Operation | Target |
|---|---|
| Library page load (up to 100 images) | < 2 seconds |
| Image thumbnail render | Progressive loading; first frame < 500ms |
| Prompt building | < 6 seconds |
| Single image generation (1 vCRAFTtion) | < 30 seconds |
| Batch generation start (first image) | < 30 seconds |
| Upload (25MB file) | < 10 seconds on standard broadband |

### 16.2 Image Quality

| Generation type | Minimum output resolution |
|---|---|
| Image → Image (enhance / professional) | 1024 × 1024 px |
| Image → Image (upscale 2×) | 2× source dimensions |
| Text → Image (vCRAFTtion / custom) | 1024 × 1024 px |
| Portrait orientation | 1024 × 1536 px |

### 16.3 Accessibility

- Image cards include alt text derived from filename and type tag
- Before / After toggle is keyboard accessible with clear focus states
- Drag-to-compare divider has a keyboard alternative (← → arrow keys)
- Batch progress states are communicated via CRAFT live regions

### 16.4 Mobile

- My Studio library is responsive down to 375px (2-column grid on mobile)
- Enhancement Workflow is single-column on mobile; source image preview collapses to a thumbnail strip
- Batch workflow is desktop-only; mobile users see a prompt to switch to desktop for batch operations

---

## 17. Out of Scope

| Item | Rationale |
|---|---|
| Video / GIF generation | Handled by the Video Wizard; out of scope for My Studio |
| Shared / team image library | v2 feature; requires access control and shared workspace infrastructure |
| Image annotation or drawing tools | Requires canvas editor; separate initiative |
| Direct social media publishing from My Studio | Publishing is handled through the Poster Wizard flow |
| Face recognition or identity matching | Out of scope and sensitive; not permitted without explicit consent framework |
| Brand kit enforcement | Intentional — My Studio is a personal, informal workspace |
| Version history for enhanced images | v2 feature |
| AI-generated image watermarking | Policy decision; out of PRD scope — to be aligned with Legal |
| Third-party image search or stock library integration | Separate licensing and integration initiative |

---

*This document describes My Studio v1.0 as a personal image workspace within CRAFT. Image generation uses Image-to-Image and Text-to-Image APIs through the CRAFT backend. All user-uploaded images are processed server-side; no images are sent directly from the client to third-party generation APIs. Prompt enrichment passes source image context as base64 for subject analysis only — no biometric data is extracted or stored. Data retention policies described in Section 14 should be reviewed against AIA's data governance framework before production release.*
