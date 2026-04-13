# Frontend — CLAUDE.md

Next.js 16 (App Router) + React 19 + TypeScript + MUI v9 frontend for the CRAFT platform.

---

## Commands

```bash
# Dev server (from repo root)
make frontend             # cd frontend && npm run dev  (http://localhost:3000)

# Type check
make test-frontend        # npm run typecheck

# Build
npm run build
```

---

## Project Structure

```
frontend/src/
├── app/                            # Next.js App Router pages
│   ├── layout.tsx                  # Root layout (fonts, providers)
│   ├── page.tsx                    # Redirect → /home
│   ├── login/page.tsx              # Login (hardcoded demo accounts)
│   └── (authenticated)/            # Protected route group
│       ├── layout.tsx              # Auth guard + nav rendering
│       ├── home/page.tsx           # Creator/Agent home (tabs)
│       ├── brand-kit/page.tsx
│       ├── brand-library/
│       ├── leaderboard/page.tsx
│       ├── compliance/rules|documents|review/
│       └── projects/
│           ├── new/page.tsx        # 5-step project creation wizard
│           ├── [id]/page.tsx       # Project detail
│           └── [id]/artifacts/
│               ├── new/page.tsx         # Artifact type selector + creator
│               ├── [artifactId]/page.tsx
│               ├── [artifactId]/video/  # 5-step video wizard
│               │   ├── layout.tsx  # VideoWizardContext + step indicator
│               │   ├── brief/page.tsx
│               │   ├── presenter/page.tsx
│               │   ├── script/page.tsx
│               │   ├── storyboard/page.tsx
│               │   └── generate/page.tsx
│               └── new-poster/          # 5-step poster wizard (Phase A–D shipped)
│                   ├── layout.tsx  # PosterWizardContext + clickable step indicator + auto-resume to deepest step
│                   ├── brief/page.tsx
│                   ├── subject/page.tsx
│                   ├── copy/page.tsx
│                   ├── compose/page.tsx
│                   ├── generate/page.tsx      # canvas + thumb strip + chat + merged-prompt disclosure + history dialog
│                   └── _hooks/               # use-variant-generation, use-chat-refinement, etc.
├── components/
│   ├── nav/                        # CreatorNav, AgentNav
│   ├── home/                       # CreatorHome, AgentHome, tab components
│   ├── providers/                  # AuthProvider, MuiThemeProvider
│   ├── projects/wizard/            # WizardProgress (shared)
│   ├── artifacts/create/           # WhatsAppCreator, older inline creators
│   ├── video/                      # All video wizard components
│   ├── poster-wizard/              # Phase D: ChatPanel, InpaintOverlay, shared (AI assist chip, locked badge, field compliance warning)
│   ├── brand-kit/                  # Color/logo/font editors
│   ├── gamification/               # Leaderboard, streak, points
│   ├── analytics/                  # Charts, metrics cards
│   ├── compliance/                 # ScoreBreakdown
│   └── cards/                      # ProjectCard, etc.
├── hooks/
│   └── useVideoPolling.ts          # 5s polling while video renders
├── lib/
│   ├── api-client.ts               # HTTP client class (singleton)
│   ├── auth.ts                     # Token storage + JWT decode utilities
│   ├── theme.ts                    # MUI theme (all design tokens)
│   └── api/                        # One module per backend domain
└── types/                          # TypeScript interfaces (one file per domain)
```

---

## Key Conventions

- **`"use client"` on every page and component.** All data-fetching is client-side via `useEffect`. No server components, no RSC data-fetching patterns.
- **MUI `sx` prop only.** No Tailwind utility classes for new code. No CSS modules. Tailwind is present but unused for component styling.
- **No form library.** Use `useState` per field. Validate in `handleSubmit` / Continue guard.
- **No Redux / Zustand.** Global state via React Context (`AuthProvider`, `VideoWizardContext`). Local UI state via `useState`.
- **Every page route** under `(authenticated)/` gets the auth guard automatically from the group layout.
- **Path alias `@/`** maps to `src/`. Use `@/lib/...`, `@/types/...`, etc. everywhere.
- **API base URL**: in dev, set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` so the browser calls the backend directly. The Next.js `rewrites()` proxy still exists in `next.config.ts` as a fallback, but going direct avoids a Node undici ↔ uvicorn HTTP keep-alive race that produced random `socket hang up / ECONNRESET` errors. CORS for `localhost:3000` is allow-listed in the backend (`backend/app/main.py`).

---

## Design Tokens (from `src/lib/theme.ts`)

| Token | Value | Use |
|---|---|---|
| Primary red | `#D0103A` | Buttons, active states, AIA brand accent |
| Primary dark red | `#A00D2E` | Hover on primary red |
| Secondary | `#1F1F1F` | Body text, headings |
| Success | `#188038` | Completed steps, positive states |
| Warning | `#B45309` | Amber warnings |
| Border | `#E8EAED` | Card borders, dividers |
| Hover border | `#DADCE0` | Hover on bordered elements |
| Surface | `#F7F7F7` | Pill backgrounds, subtle fills |
| Muted text | `#5F6368` | Secondary labels |
| Faint text | `#9E9E9E` | Disabled / placeholder |

**Typography**: Geist Sans. Buttons: 14px, weight 500, border-radius 9999px (fully rounded).

**MUI Component defaults:**
- Buttons: `disableElevation`, `textTransform: "none"`, `borderRadius: 9999`
- Cards: `border: "1px solid #E8EAED"`, `borderRadius: "16px"`, white background
- TextField focus: `borderColor: "#D0103A"`, `borderWidth: 1`
- Chip: `borderRadius: 9999`

---

## Auth & Token Handling (`src/lib/auth.ts`)

| Function | Notes |
|---|---|
| `getAccessToken()` | Reads from `sessionStorage` |
| `getRefreshToken()` | Reads from `localStorage` |
| `setTokens(access, refresh)` | Writes both stores |
| `clearTokens()` | Clears both stores |
| `isAuthenticated()` | Checks for access token presence |
| `getUserFromToken()` | Decodes JWT payload, returns user or `null` if expired |
| `isCreatorRole(role)` | `true` for `brand_admin`, `district_leader`, `agency_leader` |
| `isAgentRole(role)` | `true` for `fsc` |

**AuthProvider** (`src/components/providers/auth-provider.tsx`):
- On mount: reads token → fetches `/api/auth/me` → sets user in context
- `login(email, password)` → POST `/api/auth/login` → stores tokens → redirects `/home`
- `logout()` → clears tokens → redirects `/login`
- 401 from any API call → `ApiClient` auto-redirects to `/login`

**Nav selection**: `(authenticated)/layout.tsx` checks `isCreatorRole(user.role)` → renders `CreatorNav` or `AgentNav`.

---

## HTTP Client (`src/lib/api-client.ts`)

Singleton `apiClient` used by all API modules.

```typescript
// All API modules import this
import apiClient from "@/lib/api-client";

// Usage
const data = await apiClient.get<ResponseType>("/api/path");
const result = await apiClient.post<ResponseType>("/api/path", body);
await apiClient.patch<ResponseType>("/api/path", body);
await apiClient.delete("/api/path");
const uploaded = await apiClient.upload<ResponseType>("/api/path", formData);
```

- Injects `Authorization: Bearer <token>` automatically.
- `204 No Content` responses return `undefined`.
- Non-2xx throws `{ detail: string, status: number }`.
- 401 → immediate redirect to `/login`.

---

## API Modules (`src/lib/api/`)

One file per backend domain. All functions are `async`, return typed values.

### `projects.ts`
```typescript
fetchProjects(type?, status?, page?, perPage?) → ProjectListResponse
fetchProjectDetail(id) → ProjectDetail
createProject(data: CreateProjectData) → ProjectDetail
updateProject(id, data) → ProjectDetail
setProjectStatus(id, status) → ProjectDetail
deleteProject(id) → void
```

### `artifacts.ts`
```typescript
fetchProjectArtifacts(projectId, filters?, page?) → ArtifactListResponse
fetchArtifactDetail(id) → ArtifactDetail
createArtifact(projectId, data: CreateArtifactData) → ArtifactDetail
updateArtifact(id, data) → ArtifactDetail
deleteArtifact(id) → void
```

`CreateArtifactData`: `{ type, name, content?, channel?, format?, target_duration_seconds? }`

### `video-sessions.ts`
```typescript
fetchVideoSession(sessionId) → VideoSession
assignPresenter(sessionId, data) → VideoSession
getScript(sessionId) → Script
updateScript(sessionId, content) → Script
draftScript(sessionId, overrides?) → Script
rewriteScript(sessionId, tone) → Script
listScriptVersions(sessionId) → ScriptVersion[]
restoreScriptVersion(sessionId, versionId) → Script
generateScenes(sessionId) → Scene[]
regenerateScenes(sessionId) → Scene[]
listScenes(sessionId) → SceneListResponse
triggerGeneration(sessionId) → GeneratedVideo
listGeneratedVideos(sessionId) → GeneratedVideoListResponse
draftBrief(sessionId) → { key_message, target_audience, tone, cta_text }
improveBriefField(sessionId, data: BriefImproveRequest) → { value }
```

### `scenes.ts`
```typescript
updateScene(sceneId, data) → Scene
deleteScene(sceneId) → void
insertScene(sessionId, data) → Scene
refineSceneDialogue(sceneId) → string
suggestSceneSetting(sceneId) → string
```

### `presenters.ts`
```typescript
fetchPresenters() → Presenter[]
createPresenter(data) → Presenter
updatePresenter(id, data) → Presenter
deletePresenter(id) → void
generateAppearanceDescription(keywords, style) → string
suggestAppearanceKeywords(name, ageRange, style) → string
```

### `brand-kit.ts`
```typescript
fetchBrandKit() → BrandKit
updateBrandKit(data) → BrandKit
uploadLogo(file, variant: "primary"|"secondary") → BrandKit
uploadFont(file, slot: "heading"|"body"|"accent") → BrandKit
```

### `brand-library.ts`
```typescript
fetchLibraryItems(filters?, page?, perPage?) → BrandLibraryListResponse
fetchLibraryItemDetail(id) → BrandLibraryDetailItem
publishToLibrary(artifactId) → BrandLibraryDetailItem
reviewLibraryItem(id, action, reason?) → BrandLibraryDetailItem
remixLibraryItem(id) → { project_id, artifact_id }
```

### `compliance.ts`
```typescript
fetchRules(activeOnly?) → ComplianceRule[]
createRule(data) → ComplianceRule
updateRule(id, data) → ComplianceRule
deleteRule(id) → void
fetchDocuments() → ComplianceDocument[]
uploadDocument(data) → ComplianceDocument
deleteDocument(id) → void
scoreArtifact(artifactId) → ComplianceScore
fetchScoreBreakdown(artifactId) → ComplianceScore
```

### `ai.ts`
```typescript
generateTaglines(product, audience, tone, count) → string[]
generateImage(context, artifactType, tone, aspectRatio) → GenerateImageResponse
generateStoryboard(topic, keyMessage, product, tone) → GenerateStoryboardResponse
```

### `exports.ts`
```typescript
exportArtifact(artifactId, format, aspectRatio?) → ExportResponse
checkExportStatus(exportId) → ExportStatusResponse
getDownloadUrl(exportId) → string
```

### `gamification.ts`
```typescript
fetchMyGamification() → GamificationStats
fetchLeaderboard() → LeaderboardResponse
```

### `analytics.ts`
```typescript
fetchOverview(filters?) → OverviewMetrics
fetchTopRemixed(limit?) → TopRemixedResponse
fetchContentGaps() → ContentGapResponse
fetchActivity(period, granularity) → ActivityResponse
```

### `suggestions.ts`
```typescript
fetchSuggestions(projectId) → ArtifactSuggestion[]
generateSuggestions(projectId) → ArtifactSuggestion[]
toggleSuggestion(projectId, suggestionId, selected) → ArtifactSuggestion
```

### `members.ts`
```typescript
fetchMembers(projectId) → ProjectMember[]
inviteMember(projectId, userId) → ProjectMember
removeMember(projectId, userId) → void
```

### `users.ts`
```typescript
searchUsers(query, role?) → User[]
```

### `notifications.ts`
```typescript
fetchNotifications() → Notification[]
markNotificationRead(id) → Notification
```

### `generated-videos.ts`
```typescript
staticVideoUrl(fileUrl) → string    // builds /uploads/... URL for <video> src
deleteVideo(videoId) → void
```

### `poster-wizard.ts` (Phase B / C / D / E — client for `/api/ai/poster/*` and related)
```typescript
// Phase B — text AI
generateBrief(params)                                            → { brief, generation_id }
generateAppearanceParagraph(params)                              → { paragraph, word_count }
generateSceneDescription(params)                                 → { description }
copyDraftAll(params)                                             → { headline, subheadline, body, cta_text }
copyDraftField(params)                                           → { value }
toneRewrite({ rewrite_tone, current_copy })                      → { rewritten: CopyValues }
classifyStructuralChange(message)                                → { is_structural, target, confidence }

// Phase C — image generation
generateCompositionPrompt(params)                                → { merged_prompt, style_sentence }
generateVariants(params)                                         → { job_id, status: "QUEUED" }        // 202
getVariantJobStatus(jobId)                                       → { status, variants, partial_failure, error }  // poll 2s
retryVariant(params)                                             → { variant }
uploadReferenceImage(file, artifactId?)                          → { id, storage_url, expires_at }
deleteReferenceImage(imageId)                                    → void

// Phase D — refinement + history
refineChat({ artifact_id, variant_id, user_message,
             change_history, original_merged_prompt })           → { turn_id, ai_response, change_description,
                                                                     new_image_url, action_type, redirect_target,
                                                                     turn_index }
inpaintRegion(artifactId, variantId, description,
              originalMergedPrompt, maskPng)                     → { turn_id, new_image_url, change_description }
saveAsVariant(artifactId, variantId)                             → { new_variant: GeneratedVariant }
listVariantTurns(artifactId, variantId)                          → { turns: VariantTurnItem[] }
restoreVariantTurn(artifactId, variantId, turnId)                → { image_url }

// Phase E
upscaleVariant(artifactId, variantId)                            → { image_url, width, height }
checkField(params)                                               → { flags, cached }
```

### Poster Wizard surface notes
- **Routes:** `src/app/(authenticated)/projects/[id]/artifacts/new-poster/{brief,subject,copy,compose,generate}/page.tsx`. Common state lives in `new-poster/layout.tsx` (`usePosterWizard()`).
- **Deep-link resume:** `layout.tsx` fetches the artifact on mount and, when the user lands on `/brief`, auto-replaces to the deepest step that already has data.
- **Step indicator is clickable** via `onStepClick` — the layout wires it so users can jump between any step.
- **Hook:** `new-poster/_hooks/use-variant-generation.ts` owns the variant list for Step 5; dispatches generation, polls, retries, appends. Seed persisted variants via its `initialVariants` option when re-opening an existing poster (the generate page maps `generation.variants` to `GeneratedVariant[]` and passes them).
- **Step 5 components:** `components/poster-wizard/chat/chat-panel.tsx` (messages + 6-turn counter + change-log pills + undo + turn-limit nudge + redirect notice), `chat/inpaint-overlay.tsx` (mask drag-box + coverage calc). Error mapping: 429 + `error_code=TURN_LIMIT_REACHED` → "Save as variant" prompt; 501 → "still in development".
- **History dialog** on the generate page fetches `listVariantTurns()` for the selected variant and offers per-row Restore.

---

## TypeScript Types (`src/types/`)

### `index.ts`
```typescript
type UserRole = "brand_admin" | "district_leader" | "agency_leader" | "fsc";
interface User { id, name, email, role: UserRole, avatar_url, agent_id }
```

### `project.ts`
```typescript
type ProjectType = "personal" | "team";
type ProjectPurpose = "product_launch" | "campaign" | "seasonal" | "agent_enablement";
interface Project { id, name, type, purpose, owner, product, target_audience, campaign_period, key_message, status, artifact_count, member_count, created_at }
interface ProjectDetail extends Project { brief, brand_kit_id, suggestion_count }
```

### `artifact.ts`
```typescript
type ArtifactType = "poster" | "whatsapp_card" | "reel" | "story" | "video" | "deck" | "infographic" | "slide_deck";
type ArtifactChannel = "instagram" | "whatsapp" | "print" | "social" | "internal";
type ArtifactFormat = "1:1" | "4:5" | "9:16" | "A4" | "800x800";
type ArtifactStatus = "draft" | "ready" | "exported";
interface Artifact { id, project_id, creator, type, name, channel, format, thumbnail_url, compliance_score, status, version, created_at }
interface ArtifactDetail extends Artifact { content: Record<string,unknown>|null, locks: string[]|null, video_session_id: string|null }
```

### `presenter.ts`
```typescript
type SpeakingStyle = "authoritative" | "conversational" | "enthusiastic" | "empathetic";
interface Presenter { id, name, age_range, appearance_keywords, full_appearance_description, speaking_style, is_library, created_by_id, created_at }
interface VideoSession { id, artifact_id, current_step: "presenter"|"script"|"storyboard"|"generation", target_duration_seconds, presenter_id, created_at }
```

### `video-script.ts`
```typescript
type ScriptAction = "draft" | "warm" | "professional" | "shorter" | "stronger_cta" | "manual";
interface Script { id, video_session_id, content, word_count, estimated_duration_seconds, updated_at }
interface ScriptVersion { id, video_session_id, action: ScriptAction, preview, created_at }
```

### `scene.ts`
```typescript
type CameraFraming = "wide_shot" | "medium_shot" | "close_up" | "over_the_shoulder" | "two_shot" | "aerial" | "pov";
interface Scene { id, video_session_id, sequence, name, dialogue, setting, camera_framing, merged_prompt_present, created_at, updated_at }
interface SceneListResponse { scenes: Scene[], scenes_script_version_id, current_script_version_id }
```

### `generated-video.ts`
```typescript
type VideoStatus = "queued" | "rendering" | "ready" | "failed";
interface GeneratedVideo { id, video_session_id, version, status, progress_percent, current_scene, file_url, error_message, created_at, completed_at }
interface GeneratedVideoListResponse { videos: GeneratedVideo[], any_active: boolean }
```

### `gamification.ts`
```typescript
interface GamificationStats { total_points, current_streak, longest_streak, rank, percentile, current_level, next_milestone, last_activity_date }
interface LeaderboardEntry { rank, user_id, user_name, user_avatar, points, streak, is_current_user }
```

### `brand-kit.ts`
```typescript
interface BrandKit { id, name, logo_url, secondary_logo_url, primary_color, secondary_color, accent_color, fonts, version, updated_by, updated_at }
```

### `brand-library.ts`
```typescript
type LibraryItemStatus = "pending_review" | "approved" | "published" | "rejected";
interface BrandLibraryItem { id, artifact, published_by, status, remix_count, published_at, created_at }
```

### `export.ts`
```typescript
type ExportFormat = "png" | "jpg" | "mp4";
type ExportAspectRatio = "1:1" | "4:5" | "9:16" | "800x800";
type ExportStatus = "processing" | "ready" | "failed";
```

---

## Shared Components

### `WizardProgress` — `src/components/projects/wizard/wizard-progress.tsx`
```tsx
<WizardProgress
  steps={["Brief", "Subject", "Copy"]}
  currentStep={1}
  onStepClick={(i) => router.push(urlForStep(i))}  // optional — makes circles/labels clickable
  clickableSteps="all"                              // or "completed-and-current"
/>
```
Renders numbered circles (red = current, green = completed, grey = pending) + a segmented progress bar. Used for any multi-step wizard. `onStepClick` is opt-in; omit it for display-only progress (as in `projects/new`).

### `VideoWizardContext` — `src/app/(authenticated)/projects/[id]/artifacts/[artifactId]/video/layout.tsx`
```tsx
const { artifact, videoSession, refreshSession } = useVideoWizard();
```
Provides artifact + session to all steps. Call `refreshSession()` after mutating the session.

### `useVideoPolling` — `src/hooks/useVideoPolling.ts`
Polls `listGeneratedVideos(sessionId)` every 5s while `any_active` is true. Pauses when the tab is hidden. Returns `{ videos, isPolling }`.

---

## Standard Page Patterns

### Data-fetching page
```tsx
"use client";
export default function SomePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DataType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSomething(id)
      .then(setData)
      .catch(() => router.push("/home"))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <CircularProgress />;
  if (!data) return null;
  return <Box>...</Box>;
}
```

### Form with AI button
```tsx
const [isAiLoading, setIsAiLoading] = useState(false);

const handleAiGenerate = async () => {
  setIsAiLoading(true);
  try {
    const result = await generateSomething(inputs);
    setFieldValue(result);
  } catch {
    setError("AI generation failed. Please try again.");
  } finally {
    setIsAiLoading(false);
  }
};

// AI button style (consistent across app)
<Box
  component="button"
  onClick={handleAiGenerate}
  disabled={isAiLoading}
  sx={{
    display: "inline-flex", alignItems: "center", gap: 0.5,
    px: 1.25, py: 0.4, borderRadius: "9999px",
    border: "1px solid #D0103A", bgcolor: "transparent", color: "#D0103A",
    fontSize: "11px", fontWeight: 600, cursor: "pointer",
    opacity: isAiLoading ? 0.6 : 1,
    "&:hover:not(:disabled)": { bgcolor: "#FFF1F4" },
  }}
>
  {isAiLoading ? <CircularProgress size={10} sx={{ color: "#D0103A" }} /> : <SparkleIcon />}
  AI
</Box>
```

### Chip selector (single-select)
```tsx
{OPTIONS.map((opt) => {
  const isSelected = value === opt.key;
  return (
    <Box key={opt.key} component="button" onClick={() => setValue(opt.key)} sx={{
      px: 2, py: 0.75, borderRadius: "9999px", border: "1.5px solid",
      borderColor: isSelected ? "#D0103A" : "#E5E5E5",
      bgcolor: isSelected ? "#D0103A" : "#FFFFFF",
      color: isSelected ? "#FFFFFF" : "#484848",
      fontSize: "0.875rem", fontWeight: isSelected ? 600 : 500, cursor: "pointer",
      "&:hover": { borderColor: "#D0103A", bgcolor: isSelected ? "#A00D2E" : "#FFF1F4" },
    }}>
      {opt.label}
    </Box>
  );
})}
```

### Shared TextField style
```tsx
const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.9375rem",
    "& fieldset": { borderColor: "#E5E5E5" },
    "&:hover fieldset": { borderColor: "#ABABAB" },
    "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
  },
};
```

### Continue / Back footer
```tsx
<Box sx={{ mt: 5, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
  <Button onClick={handleBack} variant="outlined" sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}>
    Back
  </Button>
  <Button
    variant="contained" disabled={!isValid || isSaving} onClick={handleContinue}
    startIcon={isSaving ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
    sx={{ textTransform: "none", bgcolor: "#D0103A", color: "white", fontWeight: 600, px: 4, py: 1.25, borderRadius: 2, "&:hover": { bgcolor: "#A00D2E" }, "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" } }}
  >
    {isSaving ? "Saving…" : "Continue"}
  </Button>
</Box>
```

---

## Video Wizard Architecture

Route: `/projects/[id]/artifacts/[artifactId]/video/[step]`

The layout (`video/layout.tsx`) is the context provider. It:
1. Fetches `ArtifactDetail` + `VideoSession` on mount.
2. Provides them via `VideoWizardContext`.
3. Renders breadcrumb + `WizardStepIndicator`.
4. Exposes `refreshSession()` for steps that mutate session state.

Step routing is via `router.push(...)` — each step navigates explicitly. `VideoSessionStep` DB field tracks progress; `layout.tsx` derives `currentStep` from it.

Step order: `brief → presenter → script → storyboard → generate`

Video rendering: `triggerGeneration(sessionId)` → backend creates QUEUED record + dispatches Celery task → frontend polls `listGeneratedVideos` via `useVideoPolling` until `status === "ready"`.

---

## Adding a New Wizard Step Page

Follow the video wizard pattern:

1. Create `page.tsx` in the correct folder with `"use client"`.
2. Use `useParams` to get route params; use `useVideoWizard()` (or the equivalent context) for shared state.
3. Fetch step-specific data in `useEffect` with dependency on the ID param.
4. Save on Continue: call the relevant `updateArtifact`/`updateScript`/etc. API, then `router.push(nextStep)`.
5. Add the step to the `WizardStepIndicator` props in the layout.

---

## Role-Gated UI

```tsx
const { user } = useAuth();
const isAdmin = user?.role === "brand_admin";
const isCreator = isCreatorRole(user?.role);  // brand_admin | district_leader | agency_leader

// Conditionally render admin actions
{isAdmin && <Button>Manage rules</Button>}
```

`CreatorNav` is shown for creator roles; `AgentNav` for FSC. The authenticated layout handles this.

---

## File Upload Pattern

```tsx
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("variant", "primary");
  const result = await apiClient.upload<BrandKit>("/api/brand-kit/logo", formData);
  setBrandKit(result);
};
```

---

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # used by ApiClient (optional; defaults to localhost:8000)
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` for dev — the browser then hits the backend directly (recommended, avoids a Node proxy keep-alive race). The Next.js `rewrites()` in `next.config.ts` maps `/api/*` → `http://localhost:8000/api/*` but is only used if `NEXT_PUBLIC_API_URL` is unset.
