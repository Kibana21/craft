import { apiClient } from "@/lib/api-client";
import type { ArtifactSuggestion } from "@/types/suggestion";

export async function fetchSuggestions(
  projectId: string
): Promise<ArtifactSuggestion[]> {
  return apiClient.get<ArtifactSuggestion[]>(
    `/api/projects/${projectId}/suggestions`
  );
}

export async function generateSuggestions(
  projectId: string
): Promise<ArtifactSuggestion[]> {
  return apiClient.post<ArtifactSuggestion[]>(
    `/api/projects/${projectId}/suggestions/generate`
  );
}

export async function toggleSuggestion(
  projectId: string,
  suggestionId: string,
  selected: boolean
): Promise<ArtifactSuggestion> {
  return apiClient.patch<ArtifactSuggestion>(
    `/api/projects/${projectId}/suggestions/${suggestionId}`,
    { selected }
  );
}
