import { apiClient } from "@/lib/api-client";

export interface ProjectMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  user_avatar_url: string | null;
  role: string;
  joined_at: string;
}

export async function fetchMembers(projectId: string): Promise<ProjectMember[]> {
  return apiClient.get<ProjectMember[]>(`/api/projects/${projectId}/members`);
}

export async function inviteMember(
  projectId: string,
  userId: string
): Promise<ProjectMember> {
  return apiClient.post<ProjectMember>(`/api/projects/${projectId}/members`, {
    user_id: userId,
  });
}

export async function removeMember(
  projectId: string,
  userId: string
): Promise<void> {
  return apiClient.delete(`/api/projects/${projectId}/members/${userId}`);
}
