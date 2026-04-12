# 11 — Open Questions

Items that need user/stakeholder input before their owning phase ships. Each question states the default assumption used elsewhere in this package, the options, the owner, and the phase it blocks if unresolved.

Owner codes: **PM** = Product, **CO** = Compliance, **BR** = Brand, **PRINT** = AIA print-house liaison, **ENG** = Engineering lead, **SEC** = Security / Infra.

---

## OQ-01 — Turn limit: hard stop or soft nudge?
- **Current default in docs:** Hard stop at turn 6 — input disabled after 7th submission. Server returns `TURN_LIMIT_REACHED`.
- **Options:**
  1. Hard stop (current assumption).
  2. Soft nudge: keep processing but show increasingly prominent save-as-variant prompt.
  3. Configurable per project (e.g., power users get 10).
- **Impact if delayed:** Backend + chat UI logic needs to change.
- **Owner:** PM.
- **Blocks:** Phase D.

## OQ-02 — Preserve chat history on structural-change redirect?
- **Current default in docs:** Yes — when user clicks through to Step 3/4 from a redirect, the chat history remains in store. On return to Step 5, the chat log replays.
- **Options:**
  1. Preserve (current).
  2. Clear on redirect (simpler; treats each visit as a fresh chat).
  3. Preserve but mark old messages as "before edit".
- **Impact:** Chat-panel state logic; stale prompt handling.
- **Owner:** PM.
- **Blocks:** Phase D.

## OQ-03 — Variant count fixed at 4 or configurable?
- **Current default:** Fixed at 4 in client and backend (PRD §9.3).
- **Options:**
  1. Fixed at 4 (current).
  2. User-configurable (2–6) — direct cost implications.
  3. Tier-based (FSC gets 2; HQ marketing gets 4).
- **Impact:** Cost controls, UI grid, server concurrency.
- **Owner:** PM + ENG (cost).
- **Blocks:** Phase C.

## OQ-04 — CMYK ICC profile
- **Current default:** FOGRA39 (European coated).
- **Options:** FOGRA39 / GRACoL 2013 / SWOP.
- **Impact:** Print fidelity; print-house rejects a file with the wrong profile.
- **Owner:** PRINT.
- **Blocks:** Phase E (PDF export acceptance).

## OQ-05 — Bleed & trim geometry
- **Current default:** 3 mm bleed, trim marks optional off.
- **Question:** What bleed does the AIA print house spec require? Any additional marks (registration, colour bars)?
- **Owner:** PRINT.
- **Blocks:** Phase E.

## OQ-06 — Reference image TTL
- **Current default:** 24 hours.
- **Question:** Does a user resuming the wizard the next day need their uploaded references to still be valid?
- **Options:**
  1. 24h (current).
  2. 7 days — higher storage cost, better UX.
  3. Tie to artifact-draft lifetime (upload persists as long as the draft).
- **Owner:** PM + ENG (storage cost).
- **Blocks:** Phase C.

## OQ-07 — Save-as-variant: per-artifact cap?
- **Current default:** No cap.
- **Question:** Do we cap the number of saved variants per artifact to prevent JSONB bloat?
- **Options:**
  1. No cap (current).
  2. Soft cap at 20 — UI warns.
  3. Hard cap at 50 — UI blocks.
- **Owner:** PM + ENG.
- **Blocks:** Phase D (enforcement logic).

## OQ-08 — Compliance failure on export: hard block or warn?
- **Current default:** Hard block for score < 70 (matches existing behaviour). Soft warn for unresolved field flags above the threshold.
- **Question:** Should BRAND_ADMIN or senior roles have override capability?
- **Options:**
  1. Current rule applies to all roles.
  2. BRAND_ADMIN can force-export with recorded override (audit-logged).
  3. DISTRICT_LEADER and above can override.
- **Owner:** CO + PM.
- **Blocks:** Phase E.

## OQ-09 — Brand kit palette enforcement
- **Current default:** Suggested — user can add custom colours.
- **Question:** Should AIA red be required in every palette? Should non-brand colours warn?
- **Options:**
  1. Suggested (current).
  2. AIA red required (enforced server-side).
  3. Non-brand colours warn but allow.
- **Owner:** BR.
- **Blocks:** Phase C (palette picker UI).

## OQ-10 — AI endpoint rate limits
- **Current default (doc 02):** e.g., 10/min/user for variants, 60/min/user for compliance.
- **Question:** Are these numbers workable for real usage, or do we need higher ceilings for power users? Per-project caps?
- **Current per-project cap guess:** 100 variants/project/day.
- **Owner:** PM + ENG.
- **Blocks:** Phase C onwards.

## OQ-11 — Telemetry events (final list)
- **Current default:** Event list enumerated across docs 03, 05, 07, 08, 09, 10.
- **Question:** Are all PRD §2.2 metrics computable from this event set? Any missing dimensions (e.g., project type, user role)?
- **Owner:** PM + Analytics.
- **Blocks:** Phase B (instrumentation lands with first AI endpoints).

## OQ-12 — Custom font upload in v1?
- **Current default:** No — brand kit fonts only (PRD §15).
- **Question:** Confirm this stays v1 out-of-scope; any FSC-level need for custom fonts?
- **Owner:** BR + PM.
- **Blocks:** — (confirmation only; assumption is out of scope).

## OQ-13 — Golden compliance regression set
- **Current default (doc 10):** Dependency on CO team to provide 100 AIA examples + 50 clean controls.
- **Question:** Who provides this set and when?
- **Owner:** CO.
- **Blocks:** Phase E test gating.

## OQ-14 — Multi-reference image compositing
- **Current default (doc 04):** If user uploads > 1 reference image, only the first is used as base for v1.
- **Question:** Is first-only acceptable, or should we explicitly disable multi-upload until v2 collage is built?
- **Options:**
  1. First-only, silently (current).
  2. First-only with UI notice "additional references used as secondary only".
  3. Disable multi-upload for v1 — only allow 1.
- **Owner:** PM.
- **Blocks:** Phase C (upload UI).

## OQ-15 — Per-project daily variant cap
- **Current default:** 100 variants/project/day.
- **Question:** Appropriate, or needs tiering per project type?
- **Owner:** PM + ENG (cost signal).
- **Blocks:** Phase C.

## OQ-16 — Feature-flag mechanism
- **Current default (doc 05):** A simple `user.settings.beta_flags` lookup or hardcoded allowlist.
- **Question:** Is there a preferred feature-flag system (e.g., LaunchDarkly) or are we inventing the mechanism?
- **Owner:** ENG.
- **Blocks:** Phase A.

## OQ-17 — Inpaint mask: freehand vs rectangle only
- **Current default (doc 07):** Rectangle only for v1.
- **Question:** Is rectangle-only acceptable for initial launch?
- **Owner:** PM.
- **Blocks:** Phase D.

## OQ-18 — Upscale source: Imagen 3 vs Pillow fallback
- **Current default (doc 04):** Imagen 3 upscale if available; Pillow Lanczos fallback otherwise.
- **Question:** Confirm Imagen 3 upscale is available to AIA via Vertex AI; if not, budget for alternative service.
- **Owner:** ENG (Vertex AI provisioning).
- **Blocks:** Phase C / E.

## OQ-19 — Structural-change LLM fallback cost budget
- **Current default (doc 03):** LLM fallback only when keyword match fails and message is ambiguous.
- **Question:** Acceptable cost, or do we skip LLM fallback and accept higher false-negative rate on structural detection?
- **Owner:** PM + ENG.
- **Blocks:** Phase D.

## OQ-20 — Watermark behaviour by role
- **Current default (doc 09):** No watermark for authenticated AIA staff / FSC. Watermarks on exports are noop in v1.
- **Question:** Confirm no watermark in v1 for any export; defer watermarking to later phase if ever needed.
- **Owner:** PM + BR.
- **Blocks:** Phase E.

## OQ-21 — Session resume semantics
- **Current default (doc 05):** Drafts are auto-saved server-side; resuming loads latest state.
- **Question:** Should we add explicit "my drafts" UI at project level? Does it replace current surface?
- **Owner:** PM.
- **Blocks:** Phase A (only UI placement).

---

## Tracking

This document is the living decision log. As answers land:
- Update the doc where the assumption lives.
- Move the question here to a "Resolved" section with the decision and date.
- Link to any related ADRs if the team adopts an ADR practice.

Every question above must be resolved before its phase goes to production — not necessarily before development begins.

*End of planning package.*
