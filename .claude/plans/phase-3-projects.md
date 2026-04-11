# Phase 3: Projects (Personal + Team + Detail View + Creation Wizard)

**Goal:** Multi-step project creation wizard with purpose type selection, master brief, brand kit linking, CRAFT artifact suggestions. Plus team project invites and project detail view with artifact grid.

**User stories:** US-006 (project wizard + brief), US-006b (CRAFT suggestions), US-007 (team project + invite), US-008 (detail view), US-025 (leader oversight)

**Dependencies:** Phase 2

**Wireframes:** `.claude/specs/project-model-wireframe.png`, `.claude/specs/project-wizard-wireframe.png`

---

## Core concept: Project as campaign container

A project holds the **master brief** — product, audience, period, key message, brand kit — that is shared by every artifact inside it. You define the campaign once, not once per artifact. Artifacts inherit the brief.

**What lives at PROJECT level:**
- Campaign name + period
- Product / programme
- Target audience
- Key message
- Brand kit (logo, colours)
- Compliance kit (MAS rules, RAG)
- Shared approved imagery
- Approved taglines pool

**What lives at ARTIFACT level:**
- Output type (video, poster, card, infographic, slide deck)
- Format (1:1, 9:16, A4, 800x800...)
- Specific headline + copy
- Hero image for this asset
- Tone (emotional, bold, professional...)
- Channel (IG, WA, print...)
- Version history
- Export files

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/projects.py` (extend) | `POST /api/projects` (create via wizard), `GET /api/projects/{id}` (detail), `PATCH /api/projects/{id}` (update brief), `DELETE /api/projects/{id}` (soft delete) |
| `backend/app/api/project_members.py` | `POST /api/projects/{id}/members` (invite), `DELETE /api/projects/{id}/members/{user_id}` (remove), `GET /api/projects/{id}/members` (list) |
| `backend/app/api/users.py` | `GET /api/users/search?q=...&role=fsc` — search users for invite flow |
| `backend/app/api/artifacts.py` | `GET /api/projects/{id}/artifacts` — list artifacts in project. Filters: `creator_id`, `type`, `page`. |
| `backend/app/api/suggestions.py` | `POST /api/projects/{id}/suggestions/generate` — CRAFT generates artifact suggestions based on project brief + type. `GET /api/projects/{id}/suggestions` — list suggestions. `PATCH /api/projects/{id}/suggestions/{sid}` — toggle selected. |
| `backend/app/models/artifact_suggestion.py` | `ArtifactSuggestion`: id, project_id (FK), artifact_type, artifact_name, description, audience (internal/external/both), selected (bool), created_at |
| `backend/app/schemas/project.py` (extend) | `CreateProjectRequest(name, type, purpose, product, target_audience, campaign_period, key_message, brand_kit_id)`, `UpdateProjectRequest(...)`, `ProjectPurpose` enum |
| `backend/app/schemas/project_member.py` | `InviteMemberRequest(user_id)`, `ProjectMemberResponse(user_id, user_name, user_role, joined_at)` |
| `backend/app/schemas/suggestion.py` | `ArtifactSuggestionResponse(id, artifact_type, artifact_name, description, audience, selected)`, `GenerateSuggestionsRequest(project_id)` |
| `backend/app/schemas/artifact.py` | `ArtifactResponse(id, project_id, creator, type, name, channel, format, thumbnail_url, compliance_score, status, version, created_at)` |
| `backend/app/schemas/user.py` | `UserSearchResponse(id, name, email, role, avatar_url)` |
| `backend/app/services/project_service.py` (extend) | `create_project(user, data)` — creates project with purpose, links brand kit, creates owner membership. `get_project(user, project_id)` — checks access, returns with suggestion count. |
| `backend/app/services/project_member_service.py` | `invite_member`, `remove_member`, `list_members` |
| `backend/app/services/suggestion_service.py` | `generate_suggestions(project)` — calls Gemini with project brief + purpose type, returns structured artifact suggestions. `list_suggestions(project_id)`. `toggle_suggestion(suggestion_id, selected)`. |
| `backend/app/services/artifact_service.py` | `list_project_artifacts(user, project_id, filters)` |

## Frontend files

| File | Purpose |
|---|---|
| **Wizard** | |
| `frontend/src/app/(authenticated)/projects/new/page.tsx` | Multi-step wizard container — manages step state, progress indicator |
| `frontend/src/components/projects/wizard/step-purpose-type.tsx` | **Step 1:** Four selectable cards — Product launch, Campaign, Seasonal/occasion, Agent enablement. Each with icon, title, description. Red border on selected. |
| `frontend/src/components/projects/wizard/step-brief.tsx` | **Step 2:** Brief form — project name, product dropdown, primary audience, campaign period (date range), key message textarea |
| `frontend/src/components/projects/wizard/step-brand-kit.tsx` | **Step 3:** Shows active brand kit (name, version, MAS rules status). "Change" button to select different version. |
| `frontend/src/components/projects/wizard/step-aria-suggestions.tsx` | **Step 4:** "CRAFT suggests — artifacts for a [purpose type]". List of suggested artifacts with checkboxes, type icons, audience labels (Internal/External/Both). Select/deselect toggle. |
| `frontend/src/components/projects/wizard/step-invite-members.tsx` | **Step 5 (team only):** User search + invite. Only shown when creating team projects. |
| `frontend/src/components/projects/wizard/wizard-progress.tsx` | Step indicator bar (dots or numbered steps) |
| **Detail page** | |
| `frontend/src/app/(authenticated)/projects/[id]/page.tsx` | Project detail: purpose badge, brief summary, brand kit indicator, CRAFT suggestions to-do list, member list (team), artifact grid |
| `frontend/src/app/(authenticated)/projects/[id]/members/page.tsx` | Member management (owner only) |
| `frontend/src/components/projects/project-brief-panel.tsx` | Read-only brief display: product, audience, period, key message, brand kit |
| `frontend/src/components/projects/project-purpose-badge.tsx` | Badge showing purpose type with icon (rocket for launch, megaphone for campaign, etc.) |
| `frontend/src/components/projects/aria-suggestions-panel.tsx` | To-do list of CRAFT suggestions: unstarted items as clickable cards ("Start creating →"), completed items checked off |
| `frontend/src/components/projects/artifact-grid.tsx` | Grid of artifact cards. Each shows type icon, channel badge, format label. |
| `frontend/src/components/projects/member-list.tsx` | Members with avatars, owner badge, remove action |
| `frontend/src/components/projects/invite-member-dialog.tsx` | Search + invite dialog |
| `frontend/src/components/projects/project-summary-stats.tsx` | Leader oversight: artifact count by creator/type |
| `frontend/src/components/projects/project-assets-panel.tsx` | Shared assets: approved imagery grid, approved taglines list |
| **Cards** | |
| `frontend/src/components/cards/artifact-card.tsx` | Type-colored header, name, channel badge, creator, compliance badge, status, version |
| `frontend/src/components/cards/suggestion-card.tsx` | Unstarted suggestion: type icon, name, audience label, "Start creating →" |
| **UI** | |
| `frontend/src/components/ui/dialog.tsx` | shadcn Dialog |
| `frontend/src/components/ui/input.tsx` | shadcn Input |
| `frontend/src/components/ui/select.tsx` | shadcn Select |
| `frontend/src/components/ui/textarea.tsx` | shadcn Textarea |
| `frontend/src/components/ui/date-range-picker.tsx` | Date range picker for campaign period |
| `frontend/src/components/ui/checkbox.tsx` | shadcn Checkbox (for CRAFT suggestions) |
| **API + Types** | |
| `frontend/src/lib/api/projects.ts` (extend) | `createProject(data)`, `updateProject(id, data)`, `deleteProject(id)`, `fetchProjectDetail(id)` |
| `frontend/src/lib/api/suggestions.ts` | `generateSuggestions(projectId)`, `fetchSuggestions(projectId)`, `toggleSuggestion(id, selected)` |
| `frontend/src/lib/api/members.ts` | `inviteMember(projectId, userId)`, `removeMember(projectId, userId)`, `fetchMembers(projectId)` |
| `frontend/src/lib/api/users.ts` | `searchUsers(query, role?)` |
| `frontend/src/lib/api/artifacts.ts` | `fetchProjectArtifacts(projectId, filters)` |
| `frontend/src/types/project.ts` | `Project`, `ProjectPurpose`, `CreateProjectRequest` types |
| `frontend/src/types/artifact.ts` | `Artifact`, `ArtifactType` (poster, whatsapp_card, reel, story, video, deck, infographic, slide_deck), `ArtifactStatus`, `Channel`, `Format` |
| `frontend/src/types/suggestion.ts` | `ArtifactSuggestion`, `SuggestionAudience` types |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/projects` | Any | Create project (wizard data) |
| GET | `/api/projects/{id}` | Member/Admin | Get project detail |
| PATCH | `/api/projects/{id}` | Owner/Admin | Update project brief |
| DELETE | `/api/projects/{id}` | Owner/Admin | Soft-delete project |
| GET | `/api/projects/{id}/artifacts` | Member/Admin | List artifacts |
| POST | `/api/projects/{id}/suggestions/generate` | Owner/Admin | Generate CRAFT suggestions |
| GET | `/api/projects/{id}/suggestions` | Member/Admin | List suggestions |
| PATCH | `/api/projects/{id}/suggestions/{sid}` | Owner/Admin | Toggle selected |
| POST | `/api/projects/{id}/members` | Owner/Admin | Invite member |
| GET | `/api/projects/{id}/members` | Member/Admin | List members |
| DELETE | `/api/projects/{id}/members/{uid}` | Owner/Admin | Remove member |
| GET | `/api/users/search` | leader+ | Search users for invite |

## Project purpose types

| Type | Icon | Description | Typical CRAFT suggestions |
|---|---|---|---|
| Product launch | 🚀 | New product to market — agents AND customers need content | Agent training video, customer explainer, Instagram poster, WhatsApp card, product fact sheet deck |
| Campaign | 📣 | Promotional push on existing product — time-bound | Instagram poster, WhatsApp card, campaign reel, social story |
| Seasonal / occasion | 🎉 | Festive, national day, awareness month | Festive poster, greeting card (WA), social reel |
| Agent enablement | 📚 | Training, onboarding, product knowledge — internal only | Training video, product knowledge infographic, agent slide deck |

## Artifact types (expanded)

| Type | Format | Status |
|---|---|---|
| Video | MP4 | Already in plan |
| Static poster | PNG / PDF | Already in plan |
| Social card | WA / IG (800x800, 1:1) | Already in plan (whatsapp_card) |
| Infographic | PNG / PDF (steps/guide) | **New — add to plan** |
| Slide deck | PPTX | **New — add to plan** |

## CRAFT suggestion generation (Gemini prompt)

```
You are CRAFT, AIA Singapore's content planning assistant.

The user is creating a {purpose_type} project:
- Product: {product}
- Audience: {target_audience}
- Period: {campaign_period}
- Key message: {key_message}

Suggest 4-6 artifacts they should create for this project.
For each artifact, provide:
- type: one of (video, poster, whatsapp_card, reel, story, infographic, slide_deck)
- name: descriptive name with format hint (e.g., "Instagram launch poster (1:1)")
- description: one sentence on what this artifact is for
- audience: "internal" (agents/staff only), "external" (customers), or "both"

Return as JSON array.
```

## AIA product dropdown options

- PAA (PRUActive Aspire)
- HealthShield
- AIA Vitality
- PRUWealth
- AIA Family Protect
- SG60 Special
- General/Other

## Key implementation details

- **Wizard state management:** Use React state (or URL params per step) to manage the multi-step flow. Final submission sends all data in one `POST /api/projects` call.
- **Purpose type affects the entire project:** stored on the project, determines CRAFT suggestions, shown as a badge on the project card and detail page.
- **Brand kit linking:** projects have `brand_kit_id` FK. All artifact generation pulls from this specific brand kit. Default: the active/latest brand kit.
- **CRAFT suggestions are generated once** at project creation, then stored. Users can toggle selection. Unstarted suggestions appear as to-do cards on the project detail page.
- **Brief inheritance:** when creating an artifact inside a project, the artifact creation form is pre-filled with the project's product, audience, and key message.
- **Team project creation:** same wizard + extra step for member invites. Enforced server-side (403 for FSCs).
- **New artifact types:** `infographic` and `slide_deck` added to the ArtifactType enum. Infographic generation in Phase 5; slide deck generation may need python-pptx.
- **Project-level shared assets:** `project_images` and `project_taglines` tables (or JSON fields on project) for shared approved imagery and tagline pool.

## Verification

- Create project → wizard flows through all 4 steps → project created with purpose type
- CRAFT suggests artifacts based on purpose → checkboxes work → suggestions saved
- Project detail shows purpose badge, brief, CRAFT to-do list
- Clicking a suggestion card navigates to artifact creation (pre-filled)
- Login as FSC → wizard shows only personal project option
- Login as District Leader → wizard includes "Invite members" step
- FSC cannot POST team project (403)
- Team project detail shows member list, leader sees summary stats
- Brand kit indicator shown on project detail
- `npm run typecheck` passes
- `pytest` passes
