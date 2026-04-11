import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";

export async function searchUsers(
  query: string,
  role?: string
): Promise<User[]> {
  const params = new URLSearchParams({ q: query });
  if (role) params.set("role", role);
  return apiClient.get<User[]>(`/api/users/search?${params}`);
}
