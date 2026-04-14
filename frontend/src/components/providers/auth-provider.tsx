"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@/types";
import { apiClient } from "@/lib/api-client";
import { setTokens, clearTokens, getAccessToken, TOKEN_STORAGE_KEYS } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// Retries /api/auth/me up to `maxAttempts` times with exponential backoff on
// transient failures (network blip, backend --reload restart). ONLY clears
// tokens on 401 (real auth failure). Everything else keeps the session.
async function fetchMeWithRetry(maxAttempts = 3): Promise<User> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await apiClient.get<User>("/api/auth/me");
    } catch (err: unknown) {
      const e = err as { status?: number } | undefined;
      // 401 is unambiguous — token is bad, stop trying.
      if (e?.status === 401) throw err;
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        const delay = 500 * 2 ** attempt; // 500ms → 1s → 2s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Check for existing session on mount.
  // Previously a single transient failure silently cleared the session; now
  // we retry 3× and only clear on actual 401. A network blip no longer logs
  // the user out.
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchMeWithRetry()
        .then(setUser)
        .catch((err: unknown) => {
          const e = err as { status?: number } | undefined;
          if (e?.status === 401) {
            clearTokens();
          }
          // On other failures (network unreachable after 3 retries), leave
          // the session intact — the user can hit Retry on the error banner
          // or navigate to re-trigger a check. Tokens stay valid.
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.post<TokenResponse>("/api/auth/login", {
        email,
        password,
      });
      setTokens(response.access_token, response.refresh_token);
      setUser(response.user);
      router.push("/home");
    },
    [router]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    // Wipe the query cache so a user who logs in next on the same browser
    // doesn't briefly see the previous user's projects / artifacts / studio
    // images while fresh queries race to refetch.
    queryClient.clear();
    router.push("/login");
  }, [router, queryClient]);

  // Cross-tab logout: localStorage `storage` events fire in OTHER tabs when
  // a key is set/removed. If tab A clears the access token (logout), tab B
  // sees the event and follows along — no more "logged in here, logged out
  // there" demo confusion.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_STORAGE_KEYS.access) return;
      if (e.newValue === null) {
        // Token was cleared in another tab → mirror logout here.
        setUser(null);
        queryClient.clear();
        router.push("/login");
      } else if (e.oldValue === null && e.newValue) {
        // Token appeared (login in another tab) → re-sync user.
        // The next render's effect-on-mount path would normally pick it up,
        // but since this provider is already mounted, force a refetch via
        // an immediate /me call.
        fetchMeWithRetry().then(setUser).catch(() => {/* leave as-is */});
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router, queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
