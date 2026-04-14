"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "@/lib/query-client";

// Client-side provider. useState lazy-init so the QueryClient instance is
// stable across renders but DIFFERENT per request — preventing cross-user
// cache bleed if the app is ever SSR'd on a shared server.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
