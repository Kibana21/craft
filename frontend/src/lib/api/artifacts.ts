import { apiClient } from "@/lib/api-client";
import type { ArtifactDetail, ArtifactListResponse, ArtifactType, ArtifactChannel, ArtifactFormat } from "@/types/artifact";

export interface CreateArtifactData {
  type: ArtifactType;
  name: string;
  content?: Record<string, unknown>;
  channel?: ArtifactChannel;
  format?: ArtifactFormat;
}

export async function fetchProjectArtifacts(
  projectId: string,
  filters?: { creator_id?: string; type?: string },
  page = 1
): Promise<ArtifactListResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (filters?.creator_id) params.set("creator_id", filters.creator_id);
  if (filters?.type) params.set("type", filters.type);
  return apiClient.get<ArtifactListResponse>(`/api/projects/${projectId}/artifacts?${params}`);
}

export async function fetchArtifactDetail(id: string): Promise<ArtifactDetail> {
  return apiClient.get<ArtifactDetail>(`/api/artifacts/${id}`);
}

export async function createArtifact(
  projectId: string,
  data: CreateArtifactData
): Promise<ArtifactDetail> {
  return apiClient.post<ArtifactDetail>(`/api/projects/${projectId}/artifacts`, data);
}

export async function updateArtifact(
  id: string,
  data: Partial<CreateArtifactData>
): Promise<ArtifactDetail> {
  return apiClient.patch<ArtifactDetail>(`/api/artifacts/${id}`, data);
}

export async function deleteArtifact(id: string): Promise<void> {
  return apiClient.delete(`/api/artifacts/${id}`);
}
