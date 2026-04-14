// Shared QueryClient config for TanStack Query.
//
// Philosophy:
// - Aggressive retries on transient errors (network blips, backend --reload,
//   Vertex AI warmup on first call) — the main reason we adopted this lib.
// - Stale-while-revalidate: keep showing last-known data while a refetch runs,
//   so a transient failure never flips the UI to an empty state.
// - Auto-refetch on window focus so a demo laptop sleeping or switching tabs
//   comes back to fresh data without a manual refresh.
// - Don't retry 4xx — that's client error, not flakiness.

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 30 s cache before a re-open triggers refetch. Shorter than typical
        // (60 s) because CRAFT data changes fast: AI generation adds rows,
        // teammates edit artifacts, etc.
        staleTime: 30_000,
        // Keep data around 5 min even after all components unmount so
        // returning to a page renders instantly from cache, then refetches.
        gcTime: 5 * 60_000,
        // 2 extra attempts on transient errors (total 3). 4xx responses are
        // NOT retried — treated as permanent by the shape api-client throws.
        retry: (failureCount, error) => {
          const apiErr = error as { status?: number } | undefined;
          const status = apiErr?.status;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 2 ** attemptIndex, 8000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Mutations almost always map to user-initiated actions — one retry is
        // fine to cover a first-call backend blip, more is confusing.
        retry: 1,
      },
    },
  });
}
