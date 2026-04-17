// Typed query-key factory.
//
// Centralised so mutations can invalidate the exact right queries without
// copy-pasting string arrays. Using a factory + `as const` also gives
// TanStack's dev-time inspector better key rendering.

export const queryKeys = {
  // Projects
  projects: (type?: string, status?: string) =>
    ["projects", { type, status }] as const,
  projectDetail: (projectId: string) => ["project", projectId] as const,
  projectArtifacts: (projectId: string) => ["project", projectId, "artifacts"] as const,
  projectMembers: (projectId: string) => ["project", projectId, "members"] as const,
  projectSuggestions: (projectId: string) => ["project", projectId, "suggestions"] as const,

  // Brand library
  brandLibrary: (filters?: Record<string, unknown>) =>
    ["brand-library", filters ?? {}] as const,

  // Analytics
  analyticsOverview: (period: string) =>
    ["analytics", "overview", period] as const,
  analyticsActivity: (period: string, granularity: string) =>
    ["analytics", "activity", period, granularity] as const,
  analyticsContentGaps: () => ["analytics", "content-gaps"] as const,

  // Gamification
  myGamification: () => ["gamification", "me"] as const,
  leaderboard: () => ["leaderboard"] as const,

  // My Studio
  studioImages: (filters?: Record<string, unknown>) =>
    ["studio", "images", filters ?? {}] as const,
  studioImage: (imageId: string) => ["studio", "image", imageId] as const,
  studioRunStatus: (runId: string) =>
    ["studio", "run-status", runId] as const,
  studioRecentRuns: () => ["studio", "recent-runs"] as const,

  // Brand Kit
  brandKit: () => ["brand-kit"] as const,
  brandKitVersions: () => ["brand-kit", "versions"] as const,
  brandKitTemplates: () => ["brand-kit", "templates"] as const,

  // Auth
  currentUser: () => ["auth", "me"] as const,
} as const;

// Invalidation helpers — common groups of keys to invalidate after mutations.
export const invalidationGroups = {
  allProjects: ["projects"] as const,
  projectTree: (projectId: string) => ["project", projectId] as const,
  allStudio: ["studio"] as const,
  allBrandLibrary: ["brand-library"] as const,
  allBrandKit: ["brand-kit"] as const,
} as const;
