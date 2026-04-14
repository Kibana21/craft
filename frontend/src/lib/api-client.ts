// Use the Next.js proxy (/api/* → http://localhost:8000/api/*) so all requests
// are same-origin — eliminates all CORS issues in development.
// Set NEXT_PUBLIC_API_URL to an explicit base (e.g. https://api.example.com) in production.
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ApiError {
  detail: string;
  status: number;
}

// Single-flight token refresh: if multiple requests fire in parallel after
// the access token expires, we only want ONE refresh roundtrip. The first
// 401 starts the refresh and stashes the promise; subsequent 401s during
// the same window await it instead of stampeding /api/auth/refresh.
let refreshInflight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshInflight = (async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: "include",
      });
      if (!resp.ok) return false;
      const data = (await resp.json()) as {
        access_token: string;
        refresh_token: string;
      };
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      // Allow the next 401 (after a future expiry) to attempt a new refresh.
      // Keep the resolved value memoised briefly via a microtask delay so
      // requests that started racing this one still see the latest result.
      setTimeout(() => {
        refreshInflight = null;
      }, 0);
    }
  })();
  return refreshInflight;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return getAccessToken();
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      // First-attempt 401 → try a refresh and replay ONCE. If refresh
      // succeeds, the replay uses the new access token. If refresh fails
      // (or this WAS the retry already), redirect to login.
      if (!isRetry) {
        const ok = await tryRefresh();
        if (ok) {
          return this.request<T>(path, options, /* isRetry */ true);
        }
      }
      if (typeof window !== "undefined") {
        clearTokens();
        window.location.href = "/login";
      }
      throw { detail: "Unauthorized", status: 401 } as ApiError;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "An error occurred",
      }));
      throw { detail: error.detail, status: response.status } as ApiError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });

    if (response.status === 401) {
      const ok = await tryRefresh();
      if (ok) {
        // Retry once with the new token.
        const newToken = this.getToken();
        if (newToken) headers["Authorization"] = `Bearer ${newToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers,
          body: formData,
          credentials: "include",
        });
        if (retry.ok) return retry.json();
      }
      if (typeof window !== "undefined") {
        clearTokens();
        window.location.href = "/login";
      }
      throw { detail: "Unauthorized", status: 401 } as ApiError;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Upload failed",
      }));
      throw { detail: error.detail, status: response.status } as ApiError;
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
