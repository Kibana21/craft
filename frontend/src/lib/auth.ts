import type { User } from "@/types";

const ACCESS_TOKEN_KEY = "craft_access_token";
const REFRESH_TOKEN_KEY = "craft_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

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
