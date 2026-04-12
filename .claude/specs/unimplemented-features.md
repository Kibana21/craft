# CRAFT — Unimplemented / Incomplete Features

> Audit date: 2026-04-12. Cross-referenced against `prd-craft.md` and the current codebase.

---

## 1. US-018 — Compliance Review Queue

**Status:** Stub only — page exists but shows empty "All clear" state.

**What's missing:**
- Surface pending Brand Library submissions in the queue
- Surface artifacts with compliance score < 70% across all team projects
- Approve / reject with reason
- Send notification to creator on rejection
- Log every FSC export with compliance score for audit visibility

**Files to build:**
- `frontend/src/app/(authenticated)/compliance/review/page.tsx` (currently stub)
- `frontend/src/components/compliance/review-queue.tsx` (new)

---

## 2. US-008 — Project-Level Assets Panel

**Status:** Not built. Project detail page has artifact grid and suggestions but no shared assets panel.

**What's missing:**
- "Shared approved imagery pool" for the project — reusable images brand team approves for a campaign
- "Approved taglines pool" — brand team saves taglines that all project members see as suggestions
- Panel visible to all project members on the project detail page

**Files to build:**
- `backend/app/api/project_assets.py` (new — endpoints for project-scoped imagery + taglines)
- `frontend/src/components/projects/assets-panel.tsx` (new)

---

## 3. Artifact Editor — Edit Existing Artifacts

**Status:** Missing. `components/artifacts/editor/` and `components/artifacts/preview/` directories are empty. The artifact detail page shows the artifact and allows compliance scoring / export / comments, but there is no editing UI.

**What's missing:**
- Edit headline / tagline on an existing artifact
- Swap generated image, adjust tone, regenerate
- Edit message text on WhatsApp cards
- Edit storyboard frames on reels
- Save changes as a new version (version field exists in DB)

**Files to build:**
- `frontend/src/components/artifacts/editor/poster-editor.tsx`
- `frontend/src/components/artifacts/editor/whatsapp-editor.tsx`
- `frontend/src/components/artifacts/editor/reel-editor.tsx`
- `frontend/src/components/artifacts/preview/poster-preview.tsx`
- `frontend/src/components/artifacts/preview/whatsapp-preview.tsx`
- `frontend/src/components/artifacts/preview/reel-preview.tsx`

---

## 4. US-021 — FSC Photo Upload & Compositing

**Status:** Partial. Photo upload endpoint exists (`POST /api/uploads/photo`). Compositing logic exists in `render_service.py` but is not confirmed end-to-end.

**What's missing:**
- Profile settings page where FSC uploads their headshot once and it persists across all projects
- Per-artifact photo upload during creation (with headshot region compositing)
- Composited output verified in exported artifacts

**Files to build:**
- `frontend/src/app/(authenticated)/settings/page.tsx` (new — FSC profile / photo upload)
- `frontend/src/components/artifacts/create/photo-upload.tsx` (new — per-artifact upload)
- Wire render_service compositing into poster/whatsapp/reel creation pipelines

---

## 5. US-025 — District Leader Team Oversight

**Status:** Partial. Comments exist (`comment-thread.tsx`, `POST /api/artifacts/{id}/comments`). Viewing artifacts works. Summary stats and creator filtering are missing.

**What's missing:**
- Summary panel on team project detail: total artifacts, breakdown by creator, breakdown by type
- Filter / group artifacts by creator on the team project artifact grid
- Explicit enforcement: leader can view and comment, but cannot edit FSC artifacts

**Files to build / modify:**
- `frontend/src/components/projects/team-summary-panel.tsx` (new)
- `frontend/src/app/(authenticated)/projects/[id]/page.tsx` — add creator filter + summary panel

---

## 6. US-007 — Invite Members Step in Team Project Wizard

**Status:** Missing from wizard. Members can be added after project creation but not during.

**What's missing:**
- Step 5 in the team project creation wizard: search and select members to invite
- Brand Admin: can invite anyone
- District/Agency Leader: can invite any FSC (flat hierarchy, no reports-to validation for MVP)

**Files to modify:**
- `frontend/src/app/(authenticated)/projects/new/page.tsx` — add invite step (conditional on project type = team)
- `frontend/src/components/projects/step-invite-members.tsx` (new)

---

## 7. US-013 — Reel Animated Preview

**Status:** Partial. Reel creator generates a storyboard (sequence of frames). Preview is static — no animated transitions between frames.

**What's missing:**
- Animated storyboard preview rendering frames in sequence with transitions
- 9:16 vertical playback in the browser

**Files to build:**
- `frontend/src/components/artifacts/preview/reel-preview.tsx` — animate frame sequence

---

## 8. US-002 — Hierarchy API (Accepted Deferral)

**Status:** Mock only. `GET /api/hierarchy/{leader_id}/fscs` returns hardcoded data.

**What's missing (when AIA API is available):**
- Replace mock with real call to AIA's hierarchy service
- Add `district_id` field to `users` table for filtering

**Note:** This is explicitly deferred in the PRD until office network access is available. No action needed for MVP.

---

## Priority Order

| # | Feature | Why first |
|---|---|---|
| 1 | Artifact Editor | Without edit, artifacts are one-shot — no iteration possible |
| 2 | Compliance Review Queue | Brand Admin workflow is incomplete without it |
| 3 | FSC Photo Profile + Compositing | Core to the personalisation promise of the platform |
| 4 | Invite Members in Wizard | UX gap — feels broken that team project creation doesn't include inviting |
| 5 | Team Oversight Panel | Needed for District Leader value prop |
| 6 | Project Assets Panel | Campaign-level shared resources — high value for brand team |
| 7 | Reel Animated Preview | Nice-to-have — static storyboard is functional enough for MVP |
