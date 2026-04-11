import { apiClient } from "@/lib/api-client";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  return apiClient.get<Notification[]>("/api/notifications");
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return apiClient.patch<Notification>(`/api/notifications/${id}/read`);
}
