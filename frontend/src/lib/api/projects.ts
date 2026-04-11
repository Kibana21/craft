import { apiClient } from "@/lib/api-client";
import type { ProjectListResponse, ProjectType } from "@/types/project";

export interface CreateProjectData {
  name: string;
  type: ProjectType;
  purpose: string;
  product?: string;
  target_audience?: string;
  campaign_period?: string;
  key_message?: string;
  brand_kit_id?: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  type: ProjectType;
  purpose: string;
  owner: { id: string; name: string; avatar_url: string | null };
  product: string | null;
  target_audience: string | null;
  campaign_period: string | null;
  key_message: string | null;
  brief: Record<string, unknown> | null;
  brand_kit_id: string | null;
  status: string;
  artifact_count: number;
  member_count: number;
  suggestion_count: number;
  created_at: string;
}

export async function fetchProjects(
  type?: ProjectType,
  status: "active" | "archived" = "active",
  page = 1,
  perPage = 20
): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("status", status);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  return apiClient.get<ProjectListResponse>(`/api/projects?${params}`);
}

export async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  return apiClient.get<ProjectDetail>(`/api/projects/${id}`);
}

export async function createProject(data: CreateProjectData): Promise<ProjectDetail> {
  return apiClient.post<ProjectDetail>("/api/projects", data);
}

export async function updateProject(
  id: string,
  data: Partial<CreateProjectData>
): Promise<ProjectDetail> {
  return apiClient.patch<ProjectDetail>(`/api/projects/${id}`, data);
}

export async function setProjectStatus(
  id: string,
  status: "active" | "archived"
): Promise<ProjectDetail> {
  return apiClient.patch<ProjectDetail>(`/api/projects/${id}/status`, { status });
}

export async function deleteProject(id: string): Promise<void> {
  return apiClient.delete(`/api/projects/${id}`);
}
