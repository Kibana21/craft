import { apiClient } from "@/lib/api-client";

export interface CommentUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface Comment {
  id: string;
  user: CommentUser;
  text: string;
  created_at: string;
}

export async function fetchComments(artifactId: string): Promise<Comment[]> {
  return apiClient.get<Comment[]>(`/api/artifacts/${artifactId}/comments`);
}

export async function addComment(artifactId: string, text: string): Promise<Comment> {
  return apiClient.post<Comment>(`/api/artifacts/${artifactId}/comments`, { text });
}
