# PRD: CRAFT — AI-Powered Content Creation Platform for AIA Singapore

## Introduction

CRAFT is a web application that serves two distinct audiences from a single platform: **internal AIA staff** (Brand, Marketing, L&D, Compliance teams) who create and manage official campaign content, and **Financial Service Consultants (FSCs)** who personalise and remix that content for their own client outreach.

The core problem: AIA's ~5,000 FSCs need on-brand, MAS-compliant marketing materials (posters, WhatsApp cards, reels) but lack design skills and compliance knowledge. Meanwhile, the brand team has no scalable way to distribute approved content that agents can personalise. CRAFT bridges this gap — brand teams publish approved templates to a shared Brand Library, FSCs remix them with their own photo and tone, and every output is automatically checked against MAS compliance rules. The result: thousands of personalised, compliant assets produced daily without bottlenecking the brand team.

The platform detects the user's role at login and renders the appropriate experience — **Creator mode** for internal staff (full project management, analytics, compliance controls) or **Agent mode** for FSCs (simplified UI, quick create, gamification). Same app, same URL, no switching.

## Goals

- Enable FSCs to create personalised, MAS-compliant marketing content in under 60 seconds via remix
- Give the brand team a single publishing pipeline: create content, review compliance, publish to Brand Library, track adoption
- Enforce MAS compliance automatically on every artifact — FSCs see a score, not the rules engine
- Support the real AIA hierarchy (FSC → Agency Leader → District Leader → Brand Team) through two simple project types (My Projects + Team Projects) rather than mirroring the org chart in software
- Drive FSC adoption through gamification (streaks, points, district leaderboard)
- Surface upstream signals to the brand team: usage analytics, content gaps, top-performing formats

## Recommended Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | **Next.js 15 (App Router)** + TypeScript | SSR for fast initial loads, client-side interactivity, role-based routing via middleware |
| Styling | **Tailwind CSS** + **shadcn/ui** | Rapid UI development, consistent design tokens matching the AIA brand palette |
| Backend | **FastAPI** (Python 3.12+) | Async-first, excellent for AI workloads, native Pydantic validation, auto-generated OpenAPI docs |
| Database | **PostgreSQL** via **SQLAlchemy 2.0** + **Alembic** | Relational model fits projects/artifacts/roles cleanly; SQLAlchemy gives flexible async queries |
| Auth | **Hardcoded login (MVP)** → **Microsoft Entra ID** later | Both FSCs and staff use Microsoft AD (different forests). MVP: seeded test users with role selection, JWT tokens. Real SSO integration deferred until office network access is available. |
| AI — Image | **Google Imagen 3** API via **google-cloud-aiplatform** SDK | Specified in the product vision; generates campaign imagery from prompts |
| AI — Text | **Google Gemini** via **google-generativeai** Python SDK | Tagline generation, tone adaptation, brief expansion |
| AI — Compliance | **pgvector** extension on PostgreSQL + **LangChain** | RAG over MAS compliance rules + product fact sheets; LangChain handles chunking, embedding, retrieval |
| Storage | **AWS S3** via **boto3** (or Cloudflare R2) | Media assets — uploaded photos, generated images, exported artifacts |
| Image Processing | **Pillow** + **CairoSVG** | Server-side headshot compositing, poster rendering, watermark application |
| Cache / Realtime | **Redis** via **redis-py** | Leaderboard rankings, streak tracking, session caching |
| Frontend Hosting | **Vercel** | Native Next.js hosting, edge middleware for role routing |
| Backend Hosting | **Railway** or **Fly.io** | Python backend with persistent connections to PostgreSQL and Redis |

## User Stories

---

### US-001: Hardcoded login with role selection (MVP)
**Description:** As any AIA user, I want to log in and land on the correct CRAFT experience based on my role. (MVP uses hardcoded/seeded users; Microsoft Entra ID SSO integration deferred until office network access is available.)

**Acceptance Criteria:**
- [ ] Login page with email input and password field
- [ ] Database seeded with test users for each role: brand_admin, district_leader, agency_leader, fsc (at least 2 per role)
- [ ] On successful login, JWT token is issued containing user ID and role
- [ ] User is redirected to the home screen with role-appropriate UI based on the JWT role claim
- [ ] Session persists across page refreshes via stored JWT; logout clears token
- [ ] Unauthenticated users are redirected to the login page
- [ ] Auth is designed so that swapping in Microsoft Entra ID later only requires changing the authentication provider, not the authorization logic
- [ ] npm run typecheck passes

---

### US-002: Role-based access control (flat hierarchy for MVP)
**Description:** As a platform administrator, I need the system to enforce role permissions so that users can only perform actions allowed for their role. (MVP: hierarchy is flat — no validation of who reports to whom. A mock API simulates the FSC-under-leader relationship for future integration.)

**Acceptance Criteria:**
- [ ] Four roles stored in the database: `brand_admin`, `district_leader`, `agency_leader`, `fsc`
- [ ] Middleware checks role on every protected route and API endpoint
- [ ] Brand Admin: full access to all features
- [ ] District/Agency Leader: can create My Projects + Team Projects, invite any FSC (no hierarchy validation in MVP), remix from Brand Library, cannot publish to library or edit brand kit
- [ ] FSC: can create My Projects, create artifacts in team projects they're invited to, browse/remix Brand Library, cannot create team projects or invite others
- [ ] Attempting a forbidden action returns 403 with a user-friendly message
- [ ] Mock endpoint `GET /api/hierarchy/{leader_id}/fscs` returns a list of FSCs (hardcoded data), ready to be swapped with real API later
- [ ] npm run typecheck passes

---

### US-003: Home screen — Creator mode (Internal staff)
**Description:** As an internal staff member, I want to see my projects, team projects, brand library management, and analytics when I open CRAFT so I can manage content operations from one screen.

**Acceptance Criteria:**
- [ ] Dark navbar with CRAFT logo, "Creator" badge, user avatar and name
- [ ] Four tabs: My Projects, Team Projects, Brand Library, Analytics
- [ ] My Projects tab: grid of personal project cards showing name, artifact count, status; "+ New project" button
- [ ] Team Projects tab: grid of team project cards showing name, artifact count, member count; "+ New team project" button
- [ ] Brand Library tab: list of library items with status (pending review / published), remix count, management actions
- [ ] Analytics tab: placeholder with key metrics (assets created, library remixes, compliance rate)
- [ ] Content inside each tab is scoped to what this user has access to
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: Home screen — Agent mode (FSC)
**Description:** As an FSC, I want a simplified home screen focused on quick content creation and remix so I can produce client materials fast.

**Acceptance Criteria:**
- [ ] Light navbar with CRAFT logo, "Agent" badge (green), user avatar and name
- [ ] Quick Create strip at top (above tabs): four buttons — Poster, WhatsApp, Reel, Card
- [ ] Three tabs: My Projects, Team Projects, Brand Library
- [ ] My Projects tab: grid of personal project cards; "+ New project" button
- [ ] Team Projects tab: projects the FSC has been added to, showing creator attribution ("by David L."); note: "Your leader can see everything you make here"
- [ ] Brand Library tab: browseable list with "Official + Compliant" badges and "Remix ->" action on each item
- [ ] Gamification strip at bottom: streak count, progress bar, points, ranking
- [ ] No analytics tab, no brand library management controls, no "+ New team project" button
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: Database schema — core entities
**Description:** As a developer, I need the foundational database schema so that all features have the correct data model to build on.

**Acceptance Criteria:**
- [ ] `users` table: id, name, email, role (brand_admin | district_leader | agency_leader | fsc), avatar_url, agent_id (nullable), created_at
- [ ] `projects` table: id, name, type (personal | team), purpose (product_launch | campaign | seasonal | agent_enablement), owner_id (FK users), product, target_audience, campaign_period, key_message, brand_kit_id (FK brand_kit), brief (JSON — additional brief data), status, created_at, updated_at
- [ ] `project_members` table: project_id, user_id, role (owner | member), joined_at
- [ ] `artifacts` table: id, project_id (FK projects), creator_id (FK users), type (poster | whatsapp_card | reel | story | video | deck | infographic | slide_deck), name, content (JSON), channel (instagram | whatsapp | print | social | internal), format (1:1 | 4:5 | 9:16 | A4 | 800x800), thumbnail_url, compliance_score, status (draft | ready | exported), version (int, default 1), created_at, updated_at
- [ ] `artifact_suggestions` table: id, project_id (FK projects), artifact_type, artifact_name, description, audience (internal | external | both), selected (bool), created_at — stores CRAFT's suggested artifacts for a project
- [ ] `brand_library_items` table: id, artifact_id (FK artifacts), published_by (FK users), status (pending_review | approved | published | rejected), remix_count, published_at
- [ ] `brand_kit` table: id, logo_url, primary_color, secondary_color, fonts (JSON), updated_by, updated_at
- [ ] `compliance_rules` table: id, rule_text, category, severity (error | warning), is_active, created_by, created_at
- [ ] `compliance_documents` table: id, title, content, embedding (vector), document_type (mas_regulation | product_fact_sheet | disclaimer), created_at
- [ ] Alembic migration runs successfully; schema matches all table definitions above
- [ ] `mypy` passes on all backend models; `npm run typecheck` passes on frontend

---

### US-006: Project creation wizard — master brief
**Description:** As any user, I want to create a project through a guided wizard that captures the campaign brief so that every artifact inside inherits the same context.

A project is a **campaign container**. It holds the master brief — product, audience, period, key message, brand kit — that is shared by every artifact inside it. You define the campaign once, not once per artifact.

**Acceptance Criteria:**
- [ ] "New project" button opens a multi-step wizard
- [ ] **Step 1 — Project type:** Four selectable cards:
  - Product launch — "New product to market — agents AND customers need content"
  - Campaign — "Promotional push on existing product — time-bound"
  - Seasonal / occasion — "Festive, national day, awareness month"
  - Agent enablement — "Training, onboarding, product knowledge — internal only"
- [ ] **Step 2 — Brief form:**
  - Project / campaign name (text input)
  - Product (dropdown from AIA products: PAA, HealthShield, AIA Vitality, PRUWealth, AIA Family Protect, SG60 Special, General/Other)
  - Primary audience (text input, e.g., "Young parents (28–35)")
  - Launch / campaign period (date range picker)
  - Key message (textarea, e.g., "Affordable protection for young parents — from $1.20/day")
- [ ] **Step 3 — Brand + compliance kit:**
  - Shows the active brand kit ("AIA Singapore — Brand Kit v3 · MAS rules active")
  - "Change" button to select a different brand kit version (if multiple exist)
  - Compliance kit is auto-linked based on the selected brand kit
- [ ] **Step 4 — CRAFT suggests artifacts** (see US-006b below)
- [ ] Project is created with type `personal` or `team` (based on context) and purpose type from step 1
- [ ] All brief fields are stored on the project and inherited by every artifact created inside
- [ ] Project appears in "My Projects" tab immediately after creation
- [ ] For personal projects: only the creator can see it
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-006b: CRAFT artifact suggestions
**Description:** As a user creating a project, I want the AI assistant (CRAFT) to suggest which artifacts I should create based on my project type so I don't have to figure out the right content mix myself.

**Acceptance Criteria:**
- [ ] After completing the brief, CRAFT generates a list of suggested artifacts based on project type
- [ ] Each suggestion shows: artifact type icon, name (e.g., "Agent training video (60s)"), audience label (Internal / External / Both), and a checkbox
- [ ] Suggestions vary by project type:
  - Product launch: agent training video, customer explainer video, Instagram launch poster, WhatsApp agent broadcast card, product fact sheet slide deck
  - Campaign: Instagram poster, WhatsApp card, campaign reel, social story
  - Seasonal: festive poster, greeting card (WA), social reel
  - Agent enablement: training video, product knowledge infographic, agent slide deck
- [ ] User can select/deselect which suggestions to keep
- [ ] Selected suggestions are saved to `artifact_suggestions` table
- [ ] After project creation, the project detail page shows selected suggestions as "to-do" cards the user can click to start creating
- [ ] Suggestions are generated via Gemini based on the brief context
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Create a team project and invite members
**Description:** As a Brand Admin or District/Agency Leader, I want to create a team project using the same wizard and then invite members so we can collaborate on campaign content.

**Acceptance Criteria:**
- [ ] "New team project" button opens the same project creation wizard (US-006) with an additional "Invite members" step at the end
- [ ] Only visible to brand_admin, district_leader, agency_leader roles
- [ ] After the wizard completes, an "Invite members" step allows searching and selecting users
- [ ] Brand Admin can invite anyone; District/Agency Leader can invite any FSC (flat hierarchy in MVP — no reports-to validation)
- [ ] Invited members receive the project in their "Team Projects" tab
- [ ] All members can view all artifacts inside the project and the master brief
- [ ] Project owner can see a member list and remove members
- [ ] FSCs cannot see the "New team project" button or access the creation endpoint
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-008: Project detail view with artifact grid
**Description:** As a project member, I want to view a project's brief and all artifacts inside it so I can see what's been created and add more.

**Acceptance Criteria:**
- [ ] Project detail page shows: project name, purpose type badge, brief summary (product, audience, period, key message), brand kit indicator, member list (team projects only), artifact grid
- [ ] **CRAFT suggestions section:** if the project has unstarted suggestions from the wizard, show them as "to-do" cards with a "Start creating" action. Completed artifacts hide the corresponding suggestion.
- [ ] Artifact grid displays cards with thumbnail, name, type icon, channel badge, creator name, compliance score badge, status, version number
- [ ] **Artifact types shown:** Video, Static poster, Social card, Infographic, Slide deck (with format labels: PNG/PDF, WA/IG, PPTX)
- [ ] "+ New artifact" button opens the artifact creation flow (pre-filled with project brief)
- [ ] For team projects: all members' artifacts are visible; each card shows who created it
- [ ] For personal projects: only the owner's artifacts are shown
- [ ] **Project-level assets panel:** shows shared approved imagery pool and approved taglines pool for this project
- [ ] Clicking an artifact card opens the artifact editor
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-009: Brand Library — browse and remix (FSC view)
**Description:** As an FSC, I want to browse the Brand Library and remix approved content into my own project so I can quickly create personalised, compliant materials.

**Acceptance Criteria:**
- [ ] Brand Library page shows a grid/list of published items
- [ ] Each item shows: thumbnail, name, format availability (1:1, 4:5, WA, 9:16), "Official + Compliant" badge
- [ ] Search/filter by product, format type, recency
- [ ] Clicking "Remix" on an item creates a new personal project automatically, pre-loaded with the item's brief and content as a starting point
- [ ] The remixed artifact is a copy — changes do not affect the original library item
- [ ] FSCs cannot see publish/manage/delete controls
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-010: Brand Library — publish and manage (Brand Admin view)
**Description:** As a Brand Admin, I want to publish artifacts to the Brand Library and manage existing items so FSCs have access to approved content.

**Acceptance Criteria:**
- [ ] "Publish to Library" action available on any artifact in a project the admin owns
- [ ] Publishing sends the item to a compliance review queue (status: `pending_review`)
- [ ] Admin can approve/reject items in the review queue with a reason
- [ ] Approved items become visible to all users in the Brand Library
- [ ] Published items show remix count and last remix date
- [ ] Admin can unpublish (remove) items from the library
- [ ] Non-admin users cannot access the publish or review endpoints
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-011: Artifact creation — poster
**Description:** As a user, I want to create a marketing poster by providing inputs and having AI generate a design so I can produce professional content without design skills.

**Acceptance Criteria:**
- [ ] Artifact creation flow for type "poster" within a project context
- [ ] User inputs: headline/tagline (or generate via AI), product, target audience, tone, optional photo upload
- [ ] AI generates poster image using Imagen 3 based on the brief + brand kit constraints
- [ ] Generated poster automatically applies brand kit (logo placement, brand colors, approved fonts)
- [ ] User can regenerate, adjust tone, or swap tagline and get a new version
- [ ] Multiple format outputs: 1:1 (Instagram), 4:5 (feed), 9:16 (story)
- [ ] Artifact is saved to the project with a thumbnail preview
- [ ] Compliance score is computed and displayed on the artifact
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-012: Artifact creation — WhatsApp card
**Description:** As a user, I want to create a WhatsApp-optimised card so I can share product information directly with clients.

**Acceptance Criteria:**
- [ ] Artifact creation flow for type "whatsapp_card"
- [ ] User inputs: message text, product, optional photo, tone
- [ ] AI generates an 800x800 card with the message, product info, and brand elements
- [ ] Card includes required disclaimers auto-inserted based on product type
- [ ] User can edit the message text and regenerate
- [ ] Compliance score is computed and displayed
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-013: Artifact creation — reel / short video
**Description:** As a user, I want to create a short video/reel so I can engage clients with dynamic content.

**Acceptance Criteria:**
- [ ] Artifact creation flow for type "reel"
- [ ] User inputs: topic, key message, product, tone, optional photo/headshot
- [ ] AI generates a storyboard (sequence of frames with text overlays and transitions)
- [ ] Preview renders the storyboard as an animated sequence
- [ ] Brand kit applied: logo watermark, brand colors on text overlays
- [ ] Output format: 9:16 vertical, up to 30 seconds
- [ ] Compliance score is computed and displayed
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-014: AI tagline generation
**Description:** As a user, I want AI to suggest taglines for my content so I can pick a compelling headline without copywriting skills.

**Acceptance Criteria:**
- [ ] "Generate taglines" button available in any artifact creation flow
- [ ] Takes context from the project brief (product, audience, tone) and generates 5 tagline options
- [ ] Each tagline is checked against MAS compliance rules before being shown
- [ ] User can pick a tagline, edit it, or regenerate
- [ ] Brand Admins can save taglines to an "approved tagline pool" that FSCs see as suggestions
- [ ] FSCs see approved taglines first, then can generate new ones or write their own
- [ ] npm run typecheck passes

---

### US-015: AI image generation (Imagen 3)
**Description:** As a user, I want AI to generate campaign imagery so I can create professional visuals without a designer.

**Acceptance Criteria:**
- [ ] Image generation integrated into artifact creation flows (poster, WhatsApp card, reel frames)
- [ ] Prompt is constructed from: project brief, brand kit constraints, artifact type, user-selected tone
- [ ] Imagen 3 API is called with the constructed prompt; result is displayed as a preview
- [ ] User can regenerate with adjusted parameters (tone, style, subject)
- [ ] Generated images respect brand colors and do not include competitor branding
- [ ] Photo compositing: if user uploads a headshot, it is composited onto the generated image in a designated region
- [ ] Generated images are stored in S3/R2 and linked to the artifact
- [ ] npm run typecheck passes

---

### US-016: MAS compliance rules engine
**Description:** As a Brand Admin, I want to manage MAS compliance rules so that all content generated by CRAFT is automatically checked for regulatory violations.

**Acceptance Criteria:**
- [ ] Admin UI to create, edit, activate/deactivate compliance rules
- [ ] Each rule has: rule text, category (e.g., "disclaimer required", "prohibited claim", "benefit illustration"), severity (error | warning)
- [ ] Admin can upload compliance documents (MAS regulations, product fact sheets) for RAG
- [ ] Uploaded documents are chunked, embedded (pgvector), and stored for retrieval
- [ ] Admin can upload/edit approved disclaimer blocks that are auto-inserted based on product type
- [ ] Rules and documents are versioned — changes don't retroactively affect published artifacts
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-017: Compliance scoring on artifacts
**Description:** As any user, I want every artifact to have a compliance score so I know whether my content meets MAS regulations before sharing it.

**Acceptance Criteria:**
- [ ] Every artifact is scored automatically when created or edited
- [ ] Scoring pipeline: extract text from artifact → run against compliance rules → RAG query against MAS documents for fact-checking → compute score
- [ ] Score displayed as a percentage badge on the artifact card (green >= 90%, amber 70-89%, red < 70%)
- [ ] Clicking the score shows a breakdown: which rules passed, which triggered warnings/errors, suggested fixes
- [ ] Errors block export — user must fix or acknowledge before exporting
- [ ] Warnings are informational and do not block export
- [ ] Required disclaimers are auto-inserted based on the product type; missing disclaimers are flagged as errors
- [ ] FSCs see the score and fix suggestions but NOT the raw compliance rules engine
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-018: Compliance review queue (Brand Admin)
**Description:** As a Brand Admin, I want to review flagged content and pending Brand Library submissions so nothing non-compliant reaches clients.

**Acceptance Criteria:**
- [ ] "Compliance review" section on the Brand Admin home / Brand Library management tab
- [ ] Queue shows: items pending Brand Library publication, artifacts with compliance score < 70% across all team projects
- [ ] Each item shows: thumbnail, creator name, compliance score, flagged rules
- [ ] Admin can approve (publish to library), reject with reason, or request changes
- [ ] Rejection sends a notification to the creator with the reason
- [ ] Every FSC export is logged with its compliance score for audit visibility
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-019: Brand kit management
**Description:** As a Brand Admin, I want to manage the AIA brand kit so that all generated content uses correct logos, colors, and fonts.

**Acceptance Criteria:**
- [ ] Brand kit settings page (Brand Admin only)
- [ ] Upload/replace logo (primary + secondary variants)
- [ ] Set primary color, secondary color, accent color (with hex input and preview)
- [ ] Upload/select approved fonts (up to 3: heading, body, accent)
- [ ] Preview panel shows how the brand kit looks on a sample poster
- [ ] All artifact generation pipelines pull from the current brand kit
- [ ] Changes to brand kit apply to newly created artifacts; existing artifacts are not retroactively changed
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-020: Export artifacts
**Description:** As a user, I want to export my artifacts in ready-to-share formats so I can distribute them to clients via WhatsApp, Instagram, or other channels.

**Acceptance Criteria:**
- [ ] "Export" button on any artifact with compliance score >= 70% (errors must be resolved first)
- [ ] Export format options based on artifact type:
  - Poster: PNG/JPG in 1:1, 4:5, 9:16
  - WhatsApp card: PNG 800x800
  - Reel: MP4 9:16
- [ ] Export applies watermark: "AIA Official" for Brand Library items, "Crafted with CRAFT" + agent name for personal artifacts
- [ ] Export is logged: artifact_id, user_id, format, compliance_score, timestamp
- [ ] Downloaded file is named meaningfully (e.g., "PAA_Young_Parents_poster_1x1.png")
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-021: FSC photo upload and compositing
**Description:** As an FSC, I want to upload my headshot and have it composited into generated content so my materials feel personal.

**Acceptance Criteria:**
- [ ] Photo upload in user profile settings (persists across projects)
- [ ] Photo can also be uploaded per-artifact during creation
- [ ] Uploaded photo is cropped/resized to a standard headshot format
- [ ] During artifact generation, the photo is composited into a designated region of the layout
- [ ] User's name is rendered alongside their photo in the artifact
- [ ] Photo is stored in S3/R2 and associated with the user record
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-022: Gamification — streaks, points, leaderboard
**Description:** As an FSC, I want to see my creative streak, points, and ranking so I'm motivated to create content regularly.

**Acceptance Criteria:**
- [ ] Gamification strip on the FSC home screen: streak count, progress bar, total points, percentile rank
- [ ] Streak: increments for each day the FSC creates or exports at least one artifact; resets after a missed day
- [ ] Points: awarded for actions — create artifact (+10), export (+20), remix from library (+15), 7-day streak bonus (+50)
- [ ] Leaderboard: district-level ranking; FSC sees their rank and top 10 in their district
- [ ] Leaderboard page accessible from the gamification strip
- [ ] Gamification is NOT shown to internal staff (Brand Admins, District Leaders)
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-023: Analytics dashboard (Brand Admin)
**Description:** As a Brand Admin, I want to see how FSCs are using CRAFT so I can make data-driven decisions about what content to produce.

**Acceptance Criteria:**
- [ ] Analytics tab on the Creator home screen (Brand Admin only)
- [ ] Key metrics: total assets created (this week/month), Brand Library remix count, compliance rate across all exports
- [ ] Top remixed library items: ranked list showing which published content gets remixed most
- [ ] Content gap signals: list of artifact types/products FSCs are creating that have NO corresponding Brand Library item
- [ ] Activity over time: chart showing daily/weekly creation and export volume
- [ ] Filter by: time period, district, product
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-024: Quick Create (FSC shortcut)
**Description:** As an FSC, I want to tap a format button and immediately start creating so I can produce content in minimal steps.

**Acceptance Criteria:**
- [ ] Quick Create strip on the FSC home screen with four buttons: Poster, WhatsApp, Reel, Card
- [ ] Tapping a button skips project creation — creates a new personal project automatically with a default brief
- [ ] Opens directly into the artifact creation flow for the selected format
- [ ] Project is named automatically (e.g., "Quick poster — Apr 2026")
- [ ] User can edit the brief later from the project detail view
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-025: District Leader — team oversight
**Description:** As a District/Agency Leader, I want to see all artifacts created by FSCs in my team projects so I can track output and provide feedback.

**Acceptance Criteria:**
- [ ] Team project detail view shows all artifacts from all members, grouped or filterable by creator
- [ ] Each artifact card shows: creator name, type, compliance score, creation date
- [ ] Leader can view any artifact's detail and leave comments (text feedback)
- [ ] Leader sees a summary: total artifacts in the project, breakdown by creator, breakdown by type
- [ ] Leader cannot edit FSC artifacts — only view and comment
- [ ] npm run typecheck passes
- [ ] Verify in browser using dev-browser skill

---

## Functional Requirements

- FR-1: The system must detect user role at login and render the appropriate UI mode (Creator or Agent) without manual switching
- FR-2: The system must support four roles — `brand_admin`, `district_leader`, `agency_leader`, `fsc` — each with distinct permissions for creating, publishing, and inviting
- FR-3: My Projects are private by default; only the owner can see them unless explicitly shared
- FR-4: Team Projects are visible to all members; only the project owner can manage membership
- FR-5: Brand Library items are visible to all authenticated users; only Brand Admins can publish or remove items
- FR-6: Every artifact must be scored against MAS compliance rules automatically on creation and edit
- FR-7: Artifacts with compliance errors (score < 70%) cannot be exported until errors are resolved
- FR-8: Required disclaimers must be auto-inserted based on the artifact's product type
- FR-9: AI image generation (Imagen 3) must respect brand kit constraints (colors, logo placement, fonts)
- FR-10: AI tagline generation must check suggestions against compliance rules before presenting them to the user
- FR-11: The remix flow must create a copy — changes to a remix never affect the original Brand Library item
- FR-12: Every export must be logged with: user, artifact, format, compliance score, timestamp
- FR-13: FSC gamification data (streak, points) must update in real time after qualifying actions
- FR-14: Analytics must surface content gap signals — artifact types being created by FSCs that have no Brand Library equivalent
- FR-15: (Deferred) District/Agency Leaders will only invite FSCs within their own hierarchy once the external hierarchy API is integrated. MVP: leaders can invite any FSC.

## Non-Goals (Out of Scope for MVP)

- Native mobile app — web-first, responsive design only
- Real-time collaboration — users work on their own artifacts; no simultaneous editing
- Automated content scheduling or social media posting — CRAFT generates and exports, distribution is manual
- Priority-based notifications or push alerts
- Multi-language content generation — English only for MVP
- Integration with AIA's CRM or policy management systems
- White-labeling or multi-tenant support — this is AIA Singapore only
- Video editing beyond storyboard-based generation — no timeline editor
- A/B testing of content variants
- Billing or usage-based pricing — internal tool, no monetisation

## Design Considerations

- **Color palette** — match the AIA brand: primary red `#D0103A`, dark `#1A1A18`, warm gray `#F0EDE6`, green accents `#1B9D74` for team/agent elements, purple `#534AB7` for library/brand items
- **Two visual modes** — Creator mode uses a dark navbar; Agent mode uses a light navbar with green "Agent" badge. This makes the mode instantly recognisable.
- **Information density** — Creator mode is denser (more tabs, analytics, management controls); Agent mode is sparser (quick create strip, larger touch targets, gamification)
- **Artifact cards** — consistent card component across all views: colored thumbnail header, name, meta line, compliance badge
- **Mobile responsiveness** — the FSC experience must work well on mobile browsers (many agents will use phones); Creator mode can be desktop-optimised

## Technical Considerations

- **Imagen 3 API** — rate limits and cost per generation need monitoring; implement a generation queue with retry logic; cache generated images aggressively
- **Compliance RAG pipeline** — chunk MAS documents at ~512 tokens, embed with a model compatible with pgvector, retrieve top-5 chunks per compliance check; latency target: under 3 seconds per artifact score. LangChain handles the chunking/embedding/retrieval pipeline.
- **Photo compositing** — use Pillow (Python) for server-side headshot compositing; define template regions where photos are placed
- **Brand-locking** — artifacts derived from Brand Library items inherit locked regions (logo position, disclaimer block, brand colors) that the FSC cannot modify; only unlocked regions (photo, name, tone, tagline) are editable
- **Hierarchy enforcement** — deferred for MVP. A mock endpoint (`GET /api/hierarchy/{leader_id}/fscs`) simulates the external system. When the real API is available, swap the mock with a call to AIA's hierarchy service. The `users` table will eventually need a `district_id` field.
- **Export pipeline** — poster/card exports rendered server-side via Pillow + CairoSVG; reel exports use FFmpeg (via ffmpeg-python) for frame-to-video conversion
- **API architecture** — FastAPI backend exposes a RESTful API consumed by the Next.js frontend; OpenAPI schema auto-generated for type-safe frontend API client (e.g., openapi-typescript-codegen)

## Success Metrics

- FSCs can create and export a personalised poster from a Brand Library remix in under 60 seconds
- 80% of FSC-created content achieves compliance score >= 90% without manual fixes
- Brand Library remix rate: at least 40% of FSC content originates from a library remix (vs. blank creation)
- Brand team publishes at least 5 new library items per product launch cycle
- 100% of exported artifacts have a logged compliance score (audit completeness)
- FSC weekly active usage reaches 30% of total FSC base within 3 months of launch

## Open Questions

- ~~What is the exact AIA SSO provider?~~ **Resolved:** Microsoft Entra ID (two AD forests — one for staff, one for agents). Hardcoded login for MVP; SSO integration when office network access is available.
- ~~How is the FSC-to-Leader hierarchy provided?~~ **Resolved:** External system exposes an API. Mock endpoint for MVP; real integration later.
- Are there specific MAS regulations (by document ID) that should be seeded into the compliance engine at launch, or will the compliance team upload these manually post-launch?
- What are the Imagen 3 API quotas and cost constraints? This affects whether we allow unlimited generation or need a per-user daily cap.
- Should the gamification leaderboard be visible to District Leaders (could create pressure), or strictly FSC-facing?
- ~~Is there an existing AIA asset library (DAM)?~~ **Resolved:** No external DAM. CRAFT's Brand Library is the system of record for all AIA marketing assets.
