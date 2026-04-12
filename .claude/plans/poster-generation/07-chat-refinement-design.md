# 07 — Chat Refinement Design

Step 5's chat panel is the wizard's most novel surface. This doc specifies its turn model, message types, structural-change redirect, inpainting integration, save-as-variant, and persistence.

## Scope Constraint

Per PRD §9.5, the chat is **visual-refinement-only**. It processes:
- Colour and tone changes ("warmer background").
- Scale and position ("bigger headline", "move CTA down").
- Lighting and mood ("more dramatic contrast").
- Element removal ("remove the body copy").

Anything else is a **structural change** and triggers redirect (see §Structural-Change Redirect below).

---

## Turn Model

A **turn** is one user message that produces one AI action. Each turn increments `turn_count_on_selected` on the currently selected variant.

**Hard cap: 6 turns per variant state.** On the 6th turn:
- Backend processes it normally.
- AI response includes a **Save-as-variant nudge**.
- The 7th submission is rejected with `error_code = TURN_LIMIT_REACHED`; input is disabled.

**Turn counter:** Server is source of truth. Client renders `{turn_count} / 6` using the `turn_index + 1` returned in `refine-chat` responses.

**Counter reset:** happens when the user clicks Save as variant (doc 02 endpoint 15). Creates a new variant entry with `parent_variant_id`, switches selection to it, and resets count to 0.

**What counts as a turn:**
- Chat refinement message (always counts).
- Inpainting action (counts — per PRD §9.7, §12.5).
- Undoing a change-log pill (does **not** count as a turn — client-only action that re-submits the full history minus the undone entry; but the next actual refinement that follows does count).
- Redirect notices (do **not** count — the user's message was rejected pre-processing).

---

## Message Types

PRD §13.3 defines five:

| Type | Sender | Styling | Example |
|---|---|---|---|
| System notice | System | Centred italic grey | "Poster generated. Refine below." |
| User message | User | Right-aligned, AIA red background, white text, 12px padding, rounded | "Make the background warmer" |
| AI response | AI | Left-aligned, light grey background (#F5F5F5), dark text, 12px padding | "Done — shifted to warm champagne tone." |
| Redirect notice | System | Left-aligned, blue info box (#E8F0FE), action buttons | See §Structural-Change Redirect |
| Turn-limit nudge | AI | Left-aligned grey + nudge button | "You've made several refinements. Save as variant?" |

Render in a virtualised list (`react-virtuoso` or similar if already in repo; else native scroll for MVP).

---

## Change Log

Every accepted refinement (AI response with a new image) appends a pill to the Change Log strip:

```
[Warmer background ×]  [Headline larger ×]  [CTA moved down ×]
```

Pill text = `change_description` from the refinement response (≤ 5 words, per prompt constraint in doc 03).

**✕ behaviour:**
1. Pill visually removed.
2. Client sends a new `refine-chat` call with the pill *removed* from `change_history`, and a synthetic `user_message = "undo the change: {description}"`. The AI re-renders the image without that change.
3. This does **not** count against the turn limit.

**Persistence:** Change log is **session-only** (PRD §14.3). It lives on `variant.change_log` in the client store. When the user saves as variant, the change log snapshot is rolled into the new variant entry and reset.

---

## Suggestion Chips

Four suggestion chips appear above the input. Static for v1 (not AI-generated). Example set:

- "Darken the background"
- "Try a different CTA colour"
- "More breathing room"
- "Stronger contrast on the headline"

Clicking a chip pre-fills the input (does not auto-submit). The user can edit before sending.

(Future: generate context-aware suggestions per variant. Defer to v2; see doc 11.)

---

## Structural-Change Redirect

When `refine-chat` returns `action_type = "REDIRECT"`, the chat panel renders a **Redirect notice** instead of a normal AI response:

```
┌──────────────────────────────────────────────────────┐
│ ℹ That looks like a change to your copy.            │
│ Want to go back to:                                  │
│   [Step 3 — Copy ←]                                  │
└──────────────────────────────────────────────────────┘
```

- Clicking the step button: navigates to that step, **preserving the chat history and change log** (see doc 11 — open question).
- If the user makes the edit and returns to Step 5, the merged prompt may have gone stale (Step 3 changed); Step 4 shows the stale banner first.

Triggered by either:
- Keyword classifier match (fast path, doc 03).
- LLM classifier fallback with `confidence ≥ 0.7`.

Server decides; client just renders the response.

### Pre-submission hint (optional polish)

On input blur (if user has typed ≥ 10 words), optionally call `classify-structural-change` to show a soft hint under the input: "This looks like a copy change — consider editing in Step 3." The hint doesn't block submission. Skip if it adds too much chatter in telemetry; revisit after v1 usage.

---

## Inpainting from Chat

PRD §9.7. Triggered two ways:
1. **Button:** "Edit region" in the action toolbar under the main preview.
2. **Implicit from chat:** if the user's message contains "this area", "this part", or "selected region" but no region is selected, prompt them to draw a region first.

### Region Selection

Clicking "Edit region" activates selection mode on the main preview:
- User drags a bounding box.
- Description input appears near the box: "Describe what should change in this area".
- Cancel button exits mode.
- Submit sends `POST /api/ai/poster/inpaint` (multipart with mask PNG derived from the box).

### Mask construction (client-side)

Client creates an RGBA PNG matching the main preview dimensions:
- Outside the box: (0, 0, 0, 0) — fully transparent = keep.
- Inside the box: (0, 0, 0, 255) — opaque black = regenerate area.
- For v1 use rectangular masks only. Free-form brush is v2 (doc 11).

### Inpaint result

Behaves like any other refinement turn:
- Counts against the 6-turn limit.
- Adds a change-log pill: "Region edit: {description}".
- Replaces the selected variant's image.

### Mask coverage guardrail

If the selected region exceeds 60% of the image area, the client shows a warning: "Large regions may not behave reliably. Consider regenerating the whole poster instead." User can proceed anyway.

---

## Save as Variant

PRD §9.5. Triggered:
- Manually via "Save as variant" button in the action toolbar.
- Via the turn-6 nudge card (suggestion button).

### Flow

1. Client calls `POST /api/artifacts/{id}/save-as-variant` with the current `variant_id`.
2. Server:
   - Locks the artifact row.
   - Clones the selected variant's current state (image_url, change_log snapshot) into a new entry in `artifacts.content.generation.variants[]`.
   - Sets `parent_variant_id` on the new entry for lineage.
   - Resets `turn_count_on_selected` to 0 on the new variant.
3. Client:
   - Switches selection to the new variant.
   - Clears the in-memory chat log but keeps the change-log pills (as the new variant's initial state).
   - Shows a toast: "Saved as new variant."

Variants accumulate in the JSONB array. No hard cap for v1, but monitor (doc 11 — potential cap needed).

---

## Persistence

| Data | Where | Retention |
|---|---|---|
| Chat turns (server) | `poster_chat_turns` table | 30 days |
| Chat turns (client in-memory) | `useState` in ChatPanel (session only) | Session only |
| Change log pills | JSONB `variant.change_log[]` (session-attached) | Until save-as-variant or 30-day sweep |
| Inpaint masks | Object storage, referenced by `poster_chat_turns.inpaint_mask_url` | 30 days (alongside turn) |
| Variants (generated images) | Object storage, referenced by `variant.image_url` | 90 days |

Full reconstruction on session resume:
- Load `artifacts.content` (brief, subject, copy, composition, generation).
- Load recent `poster_chat_turns` rows for the current variant (last 6 for UI; more for audit).
- Rebuild the message list in the chat panel.

---

## Streaming vs Unary (v1 decision: unary)

Streaming the AI response text would improve perceived latency but:
- Turn-counter must increment atomically on a complete turn, not partial.
- Change-log pill appears after the AI's complete confirmation + new image URL.
- Error handling mid-stream is more complex.

**v1 unary.** Show a typing indicator during the request. Revisit streaming in v2 once UX stabilises.

---

## Error Handling

| Condition | UX |
|---|---|
| AI upstream failure | AI message: "Something went wrong. Try rephrasing or try again." `Retry` button. Turn does not count. |
| Turn limit reached | Input disabled with tooltip "Save as variant to continue refining." |
| Subject-locked violation | N/A — chat never modifies subject. |
| Slow response (> 15s) | Show "Still working…" after 15s, "Taking longer than usual…" after 30s. |

---

## Telemetry

Per turn:
- `poster_refine_turn_submitted` (message_length)
- `poster_refine_turn_succeeded` (duration_ms, action_type)
- `poster_refine_turn_failed` (error_code)
- `poster_refine_redirect_shown` (target)
- `poster_save_as_variant_clicked` (trigger: manual | nudge)
- `poster_inpaint_submitted` (mask_coverage_pct)
- `poster_change_log_pill_removed`

Used to compute satisfaction, cost-per-successful-refine, structural-change rate (whether the wizard flow is correctly scoping chat).

---

## Cross-references

- `refine-chat` / `inpaint` / `save-as-variant` contracts → doc 02.
- Structural-change classifier prompt → doc 03.
- Image generation for refinement → doc 04.
- Chat panel component tree → doc 05.
- Step 5 UI layout → doc 06.
- Chat turn persistence table → doc 01.

*Continue to `08-compliance-engine-extension.md`.*
