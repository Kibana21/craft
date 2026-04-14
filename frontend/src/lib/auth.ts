import type { User } from "@/types";

const ACCESS_TOKEN_KEY = "craft_access_token";
const REFRESH_TOKEN_KEY = "craft_refresh_token";

// Both tokens live in localStorage so a second tab opened during an active
// session inherits the login. Previous design (access in sessionStorage) broke
// multi-tab demos: opening the app in a new tab showed the login screen even
// though the user was authenticated. localStorage `storage` events propagate
// cross-tab so logout in tab A lands in tab B too (see auth-provider).
//
// The XSS exposure is the same as before — sessionStorage is also readable by
// any script in the origin. Threat model unchanged; UX significantly improved.

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  // Backwards compat: if a previous session left a token in sessionStorage,
  // promote it to localStorage on first read so the user doesn't get logged
  // out by the migration.
  const ls = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (ls) return ls;
  const ss = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (ss) {
    localStorage.setItem(ACCESS_TOKEN_KEY, ss);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    return ss;
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Also clear any leftover sessionStorage tokens from the old layout.
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Stable export so consumers (auth-provider) can subscribe to cross-tab
// changes without hard-coding the literal key name.
export const TOKEN_STORAGE_KEYS = {
  access: ACCESS_TOKEN_KEY,
  refresh: REFRESH_TOKEN_KEY,
} as const;

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getUserFromToken(): User | null {
  const token = getAccessToken();
  if (!token) return null;

  const payload = decodeTokenPayload(token);
  if (!payload) return null;

  // Check expiry
  const exp = payload.exp as number;
  if (Date.now() >= exp * 1000) {
    clearTokens();
    return null;
  }

  // We don't have full user data in the token — just sub and role.
  // The full user is fetched via /api/auth/me and stored in context.
  return null;
}

export function isCreatorRole(role: string): boolean {
  return ["brand_admin", "district_leader", "agency_leader"].includes(role);
}

export function isAgentRole(role: string): boolean {
  return role === "fsc";
}
