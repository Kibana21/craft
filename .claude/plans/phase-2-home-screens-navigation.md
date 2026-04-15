# Phase 2: Home Screens + Navigation Shell

**Goal:** Two navigation shells (dark Creator nav, light Agent nav) + tabbed home screen per role.

**User stories:** US-003 (Creator home), US-004 (Agent home)

**Dependencies:** Phase 1

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/api/projects.py` | `GET /api/projects` — returns current user's projects. Query params: `type` (personal/team), `page`, `per_page`. Personal: where owner_id = current_user. Team: where user is in project_members. Brand_admin: all projects. |
| `backend/app/api/brand_library.py` | `GET /api/brand-library` — returns published library items. Query params: `search`, `product`, `format`, `page`, `per_page`. Published items for non-admins; all statuses for brand_admin. |
| `backend/app/schemas/project.py` | `ProjectResponse(id, name, type, owner, artifact_count, member_count, status, brief, created_at)`, `ProjectListResponse(items, total, page)` |
| `backend/app/schemas/brand_library.py` | `BrandLibraryItemResponse(id, artifact, published_by, status, remix_count, published_at)`, `BrandLibraryListResponse(items, total, page)` |
| `backend/app/services/project_service.py` | `list_user_projects(user, type, page)` — query logic with role-based scoping |
| `backend/app/services/brand_library_service.py` | `list_library_items(user, filters, page)` — query logic |

## Frontend files

| File | Purpose |
|---|---|
| `frontend/src/app/(authenticated)/layout.tsx` | Authenticated layout wrapper: checks auth, renders CreatorNav or AgentNav based on role |
| `frontend/src/app/(authenticated)/home/page.tsx` | Detects role, renders CreatorHome or AgentHome component |
| `frontend/src/components/nav/creator-nav.tsx` | Dark navbar (`bg-[#1A1A18]`): CRAFT logo (red on dark), "Creator" badge (`bg-red-900/30 text-red-400`), user avatar + name. Links: Home, Brand Kit (admin only), Analytics (admin only). |
| `frontend/src/components/nav/agent-nav.tsx` | Light navbar (`bg-white border-b`): CRAFT logo, "Agent" badge (`bg-emerald-50 text-emerald-700 border-emerald-300`), user avatar + name. Minimal links. |
| `frontend/src/components/home/creator-home.tsx` | Tabbed layout with 4 tabs: My Projects, Team Projects, Brand Library, Analytics |
| `frontend/src/components/home/agent-home.tsx` | Quick Create strip at top, 3 tabs (My Projects, Team Projects, Brand Library), gamification strip at bottom |
| `frontend/src/components/home/quick-create-strip.tsx` | Four buttons: Poster, WhatsApp, Reel, Card. Each triggers quick create flow (wired in Phase 5). Pink background (`bg-[#FFF0F3]`), red buttons (`bg-[#D0103A]`). |
| `frontend/src/components/home/gamification-strip.tsx` | Streak icon + count, progress bar, points, percentile rank. Amber background (`bg-[#FFFBF0]`). Placeholder data until Phase 8. |
| `frontend/src/components/home/tabs/my-projects-tab.tsx` | Grid of project cards + "+ New project" button. Fetches `GET /api/projects?type=personal`. |
| `frontend/src/components/home/tabs/team-projects-tab.tsx` | Grid of team project cards. Creator: + "New team project" button. Agent: no create button, shows "by {owner}" attribution, note "Your leader can see everything you make here". |
| `frontend/src/components/home/tabs/brand-library-tab.tsx` | List of library items. Creator: shows status badges, "Review" action for pending, "Manage" for published. Agent: "Official + Compliant" badge, "Remix →" button. |
| `frontend/src/components/home/tabs/analytics-tab.tsx` | Placeholder with static metrics. Real data wired in Phase 8. |
| `frontend/src/components/cards/project-card.tsx` | Reusable: colored thumbnail header (color derived from project name hash), name, artifact count, member count (team only), status pill. Team cards get green border accent. |
| `frontend/src/components/cards/library-item-card.tsx` | Reusable: thumbnail, name, format availability chips, official badge, action button (Remix or Manage). |
| `frontend/src/components/ui/tabs.tsx` | shadcn Tabs component |
| `frontend/src/components/ui/badge.tsx` | shadcn Badge component |
| `frontend/src/components/ui/avatar.tsx` | shadcn Avatar component |
| `frontend/src/components/ui/card.tsx` | shadcn Card component |
| `frontend/src/lib/api/projects.ts` | `fetchProjects(type, page)`, `fetchProject(id)` — typed API calls |
| `frontend/src/lib/api/brand-library.ts` | `fetchLibraryItems(filters, page)` — typed API call |

## Visual design reference

Wireframes in `.claude/specs/craft_fsc_home_fixed.html` and `.claude/specs/craft_two_audiences.html` define:

- **Creator nav:** Dark `#1A1A18` background, CRAFT logo in `#D0103A`, "Creator" badge in translucent red
- **Agent nav:** White background with bottom border, CRAFT logo, "Agent" badge in green `#1B9D74`
- **Quick Create strip:** Pink `#FFF0F3` background, red `#D0103A` buttons
- **Gamification strip:** Amber `#FFFBF0` background, flame emoji, progress bar
- **Project cards:** Colored thumbnail headers, white card body, team cards have green `#9FE1CB` border
- **Library items:** Purple `#534AB7` accents for official items, "Official + Compliant" badge

## Key implementation details

- The `(authenticated)` route group wraps all protected pages. Layout checks for valid JWT, redirects to `/login` if missing.
- Tabs use URL search params (`?tab=my-projects`) so the active tab persists across navigation and can be deep-linked.
- The project card component handles both personal and team variants. Team cards show green border accent and member count badge.
- Use `Suspense` boundaries around each tab panel for streaming loading states.
- The home page should feel fast — project listing should support pagination but load first page immediately.https://www.youtube.com/

## Verification

- Login as `sarah@example.com` → dark navbar with "Creator" badge, 4 tabs
- Login as `maya@agent.example.com` → light navbar with "Agent" badge, Quick Create strip, 3 tabs, gamification strip
- Tabs switch correctly, URL updates with `?tab=` param
- Empty states render gracefully (no projects yet)
- `npm run typecheck` passes
