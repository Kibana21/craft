import { apiClient } from "@/lib/api-client";
import type { ProjectListResponse, ProjectType } from "@/types/project";

export async function fetchProjects(
  type?: ProjectType,
  page = 1,
  perPage = 20
): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("page", String(page));
  params.set("per_page", String(perPage));

  return apiClient.get<ProjectListResponse>(`/api/projects?${params}`);
}
