# CRAFT — Business PRD

**Product:** CRAFT — AI-powered content creation platform
**Organisation:** AIA Singapore
**Document type:** Business Requirements (derived from the shipped MVP + Poster/Video wizard phases)
**Status:** v1.0 — reflects the product as currently built

---

## 1. Executive summary

CRAFT is an AI-first content creation platform that lets AIA Singapore's brand team and its distributed network of Financial Service Consultants (FSCs) produce compliance-safe marketing content in minutes rather than weeks — and do so without leaving one shared, brand-controlled system.

The platform solves a specific business problem: insurance marketing is **expensive to produce** (copy, imagery, video), **slow to route through compliance** (MAS regulations, disclaimers, prohibited claims), and **inconsistent in brand expression** once it leaves head office and reaches thousands of individual agents. CRAFT collapses those three problems into a single guided workflow where AI does the heavy lifting, compliance is scored as the work is created (not at the end), and every asset is anchored to the brand kit by default.

One product, two audiences: **Creator mode** (brand admins, district leaders, agency leaders) produces the master templates and library; **Agent mode** (FSCs) remixes approved content for their own campaigns. Role is detected at login — no mode switching, no accidental channel crossing.

---

## 2. Background and problem

AIA Singapore runs two parallel marketing motions:

1. **Head-office produced content** — campaigns, product launches, seasonal pushes. Created by brand and marketing teams, reviewed by compliance, distributed to the field.
2. **Agent-produced content** — thousands of FSCs producing their own WhatsApp cards, Instagram stories, explainer videos for client outreach.

Both suffer from the same pain points:

| Pain | Cost to the business |
|---|---|
| Every asset needs a human copywriter, designer, and editor | Linear headcount cost per campaign |
| Every asset must pass MAS compliance review (disclaimers, prohibited claims, product fact alignment) | Days-long review cycles; iteration friction |
| Agents go off-brand when left unsupervised — wrong logo, wrong colours, unapproved product claims | Brand erosion + regulatory exposure |
| No shared memory of what's been produced — same taglines, same stock photography, same product explainers get rebuilt repeatedly | Duplicated effort, stale creative |
| No visibility into *who is producing what* across the field | Leadership blind to agent enablement gaps |

CRAFT is the single system that addresses all five.

---

## 3. Goals and non-goals

### Goals

1. **Cut the time-to-first-asset** for both a brand campaign and an agent's WhatsApp send by ≥80% versus the current external-agency + compliance-review loop.
2. **Make compliance a guardrail, not a gate** — score every artifact against MAS rules in real time, flag issues per field, at the point of creation.
3. **Keep brand expression on-rails by default** — brand kit (colours, fonts, logos) is attached to every project automatically; agents cannot publish off-brand from inside the product.
4. **Give one shared surface** for the head-office library and agent remix — so approved content gets leveraged dozens of times instead of once.
5. **Make leadership legible** — dashboards on what's being produced, by whom, at what compliance score.

### Non-goals (v1)

- Replacing human compliance reviewers for edge cases. CRAFT augments; Brand Admin still has final review on library publishing.
- Building AIA's global brand kit. Brand kit is a managed asset uploaded by Brand Admin, not auto-generated.
- Replacing the agent-facing CRM or policy-management system. CRAFT is the creation + distribution surface only.
- Full integration with AIA's real hierarchy / SSO on day one. MVP runs on hardcoded accounts; SSO is a later phase.
- Automated posting to client channels (email, WhatsApp Business API). CRAFT produces the asset; distribution is out of scope.

---

## 4. Target users

### Primary personas

**1. Sarah — Brand Admin (creator)**
Runs AIA Singapore's content team. Owns the brand kit, approves what goes into the library, writes compliance rules, watches the analytics. Needs speed **and** control.

**2. David — District Leader (creator)**
Oversees a district of agencies. Produces campaign-level templates his agencies can remix. Needs team-project visibility and the ability to publish locally relevant content back to the library.

**3. Michael — Agency Leader (creator)**
Runs an agency. Similar to David but one tier down. Produces content for the agents reporting into him; reviews what his agents create.

**4. Maya — Financial Service Consultant (agent)**
Front-line advisor. Doesn't write copy, doesn't design posters. Needs to send a warm, on-brand, compliant asset to a client within the same sitting of a conversation. Her version of the app is stripped down: remix the approved library, generate a poster for a specific client context, post to WhatsApp, move on.

### Role matrix

| Feature | Brand Admin | District / Agency Leader | FSC (Agent) |
|---|---|---|---|
| See all projects across org | ✅ | Own + team | Own only |
| Create personal + team projects | ✅ | ✅ | Personal only |
| Invite members | ✅ | ✅ | ❌ |
| Comment on artifacts | ✅ | ✅ | ❌ |
| Manage brand kit (colours, fonts, logos) | ✅ | ❌ | ❌ |
| Write compliance rules / upload MAS docs | ✅ | ❌ | ❌ |
| Publish to brand library | ✅ (direct) | ✅ (via review) | ❌ |
| Review submission queue | ✅ | ❌ | ❌ |
| Remix from library | ✅ | ✅ | ✅ |
| Use My Studio (personal image library) | ✅ | ✅ | ✅ (primary surface) |
| See leaderboard | ✅ | ✅ | ✅ |

---

## 5. Product pillars

CRAFT is organised around five pillars. Every feature in the product maps to exactly one.

### Pillar 1 — Project-scoped creation
Work happens inside a **project** (a campaign, a product launch, a seasonal push, an agent enablement initiative). Each project carries a brief, a brand kit, a team, and a growing set of artifacts. AI uses that project context to ground every downstream generation — so a brief written once steers every poster, video, and WhatsApp card produced from it.

### Pillar 2 — AI-assisted artifact wizards
Three artifact types have fully guided creation flows today:

- **Poster Wizard** (5 steps: Brief → Subject → Copy → Compose → Generate + Refine) — generates 4 variants in parallel, refined via a 6-turn chat with region-level inpaint, and saved back into the artifact's variant history.
- **Video Wizard** (5 steps: Brief → Presenter → Script → Storyboard → Generate) — writes a script, plans scenes, and renders a real MP4 via Veo on a per-scene basis.
- **WhatsApp Card** (single-screen creator) — fastest path for agents to produce a client-ready card.

Reel, Story, Infographic, and Slide Deck exist as artifact types; richer creators are a later phase.

### Pillar 3 — Compliance as a guardrail
Every artifact is scored against the active compliance rule set (MAS regulations, disclaimer requirements, prohibited claims, benefit illustration rules, testimonial handling) using an LLM grounded in a RAG corpus of uploaded regulatory documents. The score is visible on the artifact at all times (red <70, amber 70–89, green ≥90), and — in the Poster Copy step — individual fields carry inline compliance flags *before* the asset is even rendered.

### Pillar 4 — Brand library as shared memory
Approved artifacts get published to a searchable brand library. Agents discover and remix them; the platform tracks remix count so leadership can see which templates are actually carrying weight. This turns one-shot creative into a reusable asset base.

### Pillar 5 — Gamification and analytics
A points-and-streaks system rewards the behaviours the business wants: creating artifacts, exporting them, remixing library items, generating videos, maintaining weekly activity. A leaderboard surfaces top creators. Analytics give admins a view of volume, compliance averages, content gaps, and top-remixed items — the feedback loop that informs what to produce next.

---

## 6. Core user journeys

### Journey A — Brand Admin launches a new product campaign

1. Sarah logs in, lands on the Creator home, clicks **New Project**.
2. Selects **Product Launch** as purpose, enters product name, target audience, campaign window, key message. Brand kit auto-attaches.
3. CRAFT's AI suggests a starter artifact mix — "you'll probably want a hero poster, a 30-second explainer reel, a WhatsApp teaser, and a training deck for the field." Sarah accepts three of four.
4. She opens the poster wizard. AI drafts the brief from the project she just wrote, offers a human-model subject paragraph, and drafts all six copy fields. She tweaks the headline.
5. Hits Generate → four variants appear in parallel within a minute. She refines variant #2 via chat: "make the background warmer, remove the second smaller figure." Two turns later she saves it as a new variant.
6. The artifact's compliance score is 94 (green). She publishes it to the brand library — no separate review step needed since she's Brand Admin.
7. Moves to the video wizard; same flow. Forty minutes later she has poster, video, and WhatsApp card ready for the district leaders to cascade.

### Journey B — FSC produces a client-ready asset in under three minutes

1. Maya logs in (Agent mode — stripped-down navigation). Lands on her Agent home.
2. Opens the brand library, filters to the new product, finds the poster Sarah just published.
3. Hits **Remix** — CRAFT creates a personal project and artifact preloaded with the approved template.
4. Maya opens the artifact, swaps in her own headshot via My Studio, edits the headline to name the client's concern ("Protecting your family's income"), confirms compliance is still green.
5. Exports as a WhatsApp-sized JPG and sends to her client.
6. Earns +15 remix points + a streak bonus. Her weekly rank ticks up.

### Journey C — Brand Admin tunes the compliance system

1. Sarah gets a flag from internal compliance that a new MAS circular has changed wording on investment-linked policy illustrations.
2. She opens **Compliance Documents**, uploads the PDF; it's auto-chunked and indexed into the RAG store.
3. Opens **Compliance Rules**, adds a new ERROR-severity rule: "ILP illustrations must use the three-rate scenario format."
4. From the next artifact onwards, every copy field is scored against this rule. Existing artifacts re-score on next open.

---

## 7. Functional scope (what's built)

### Onboarding and auth
- Login page with eight hardcoded demo accounts (one per role). Password `craft2026`. SSO deferred.
- JWT session with silent refresh — a session never drops mid-task.
- Cross-tab sync — opening a second tab inherits the active session; logging out in one tab logs out everywhere.

### Home and navigation
- **Creator home** — four tabs (My Projects, Team Projects, Brand Library, Analytics) + a gamification strip.
- **Agent home** — simplified layout (Home, My Studio, Leaderboard) with quick-create shortcuts; no admin surfaces.
- Distinct nav chrome per mode (dark-chrome Creator vs light-chrome Agent) so a user always knows which surface they're on.

### Projects
- Four-step creation wizard (Purpose → Brief → Brand Kit → AI Suggestions).
- Project detail with tabs for Brief, Artifacts, Suggestions, Members.
- Soft-delete + archive support; BRAND_ADMIN sees all, others see owned + member.

### Artifact creation
- **Poster Wizard** (5 steps, fully shipped incl. chat refinement, region inpaint, save-as-variant, history restore — see `.claude/plans/poster-generation/`).
- **Video Wizard** (5 steps, full Veo pipeline incl. scene-by-scene rendering with ffmpeg concat).
- **WhatsApp card creator** (single-screen).
- Artifact detail with live compliance score, comments (leaders+), export actions.
- Eight artifact types in the data model; three have shipped creators.

### Brand system
- **Brand Kit** — primary/secondary/accent colours, heading/body/accent fonts, primary/secondary logos. Single source of truth; every new project inherits it.
- **Brand Library** — submission → review → approval → publish flow; search, filter by product, remix-count badges. FSCs remix; Brand Admin reviews.

### Compliance
- **Rules** — Brand Admin CRUD with category + severity (ERROR/WARNING), activate/deactivate without delete.
- **Documents** — Brand Admin uploads MAS regulations, disclaimers, product fact sheets; chunked and embedded for RAG.
- **Scoring** — every artifact gets a 0–100 score with per-rule breakdown; per-field inline flagging live in the Poster Copy step.

### Gamification
- Points awarded for CREATE (10), EXPORT (20), REMIX (15), VIDEO_GENERATED (50), 7-day STREAK (50).
- Current streak + longest streak tracked per user.
- Redis-backed leaderboard with rank, percentile, next-milestone progress.

### Analytics
- Overview metrics (total artifacts, exports, average compliance).
- 30-day activity trends.
- Top-remixed leaderboard for artifacts.
- Content-gap signal for project purposes that are under-produced.

### My Studio
- Personal image library per user — uploaded photos, AI-generated images, enhanced images, poster exports all indexed here.
- Filter by type, search, grid/list, bulk delete, pagination.
- Primary surface for FSCs; also available to creators.

### Cross-cutting
- Role-aware navigation and route guards.
- Compliance score badge on every artifact card everywhere it appears.
- Request-ID embedded in every server response so support can correlate incidents.
- Stale-while-revalidate error banners — a network blip never empties a list.

---

## 8. Success metrics

### Business metrics
- **Median time from project creation to first published artifact** — target ≤ 30 min for Creator, ≤ 3 min for Agent remix.
- **% of artifacts scoring ≥90 compliance** at first generation — target ≥ 70%.
- **Weekly active FSCs** producing at least one artifact — target ≥ 60% of onboarded agents.
- **Library remix ratio** — average remixes per published library item; target ≥ 5 within 30 days of publish.
- **Reduction in compliance-review escalation volume** — target 50% reduction versus baseline of the pre-CRAFT workflow.

### Leading indicators
- Poster wizard completion rate (brief → generate).
- Video generation success rate (QUEUED → READY without FAILED).
- Compliance score distribution per artifact type.
- Per-field flag dismiss rate in the Poster Copy step (tells us whether AI is over- or under-flagging).

---

## 9. Business rules and constraints

- **Brand Admin is the compliance authority.** Only Brand Admin can create/edit rules, upload MAS documents, approve library submissions. This is intentional centralisation.
- **FSCs cannot create team projects.** An FSC's surface is personal only; cross-agent collaboration happens via library remix, not shared projects.
- **Soft-delete everywhere.** No user-facing hard deletes; every project, artifact, comment carries a `deleted_at`. Recoverability is a product promise, not an engineering nicety.
- **One brand kit at a time.** The system supports versioning but v1 assumes one active kit per organisation.
- **Compliance score is advisory in v1.** A sub-70 score does not block publish; it highlights risk for the human to review. Hard-blocking is a later policy call.
- **6-turn cap on poster refinement chat** per variant — forces iteration discipline. "Save as variant" branches to a new 6-turn budget instead.

---

## 10. Out of scope — deferred features

Tracked formally in `.claude/specs/unimplemented-features.md`. Summary:

1. Compliance review queue UI (the stub exists; review workflow itself runs through library submission today).
2. FSC photo compositing — blending the agent's headshot into poster templates procedurally.
3. Invite-members step inside the project-creation wizard (members can be added from the project detail today).
4. District Leader team-oversight dashboard (separate from the generic analytics tab).
5. Project-level shared assets panel.
6. Animated reel preview on the artifact detail page (currently static storyboard).
7. AIA hierarchy API integration (mock endpoint only until network access is granted).
8. My Studio enhancement workflows (batch upscale, batch export, style transfers).
9. Phase E poster polish — per-field compliance inline on export, 2× upscale service, print-ready PDF with CMYK + 300 DPI.

None of these are blockers for the v1 value proposition; all are on the roadmap.

---

## 11. Assumptions and open questions

### Assumptions
- AIA provides Google Cloud project access for Gemini and Vertex AI (Veo) at sufficient quota.
- MAS regulatory text is legally redistributable within the platform for RAG purposes.
- FSCs have sufficient network bandwidth to upload reference images and download generated videos (up to ~50MB).
- Brand team will actively curate the library (review submissions, deprecate stale items) — the system does not auto-expire.

### Open questions
- Should compliance-scoring below a threshold (e.g. <70) *block* export, or only warn? Current implementation warns; policy decision required.
- Should FSC-generated content require leader review before export to a client channel? Current implementation does not enforce this.
- What is the canonical retention for poster refinement chat turns (30 days today) and reference images (24 hours today)? Tuneable but not yet validated with legal.
- Real hierarchy integration — when network access is available, does CRAFT pull the org tree nightly, or query live? Affects caching strategy.

---

## 12. Release phases (reference)

| Phase | Contents | Status |
|---|---|---|
| Phase 0–6 (MVP) | Auth, projects, artifacts, brand kit, brand library, compliance, gamification, analytics, video wizard | Shipped |
| Poster Phase A–D | Poster wizard scaffold → text AI → image AI → chat refine + inpaint + save-as-variant | Shipped |
| Poster Phase E | Per-field compliance inline on export, 2× upscale, print-ready PDF | Partial |
| Phase 2 (deferred) | Items in §10 | Not started |

---

## 13. One-paragraph essence

CRAFT is a single, role-aware AI workspace where AIA Singapore's brand team and its distributed agent network produce, compliance-check, and distribute marketing content at a pace that was previously only possible with an external agency. It earns its keep by fusing three things that insurance organisations normally keep apart — creative production, regulatory compliance, and brand-asset governance — into one guided flow that ends with an on-brand, MAS-aligned asset the user can send to a client in minutes.
