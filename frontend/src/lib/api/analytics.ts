import { apiClient } from "@/lib/api-client";
import type {
  ActivityResponse,
  ContentGapResponse,
  OverviewMetrics,
  TopRemixedResponse,
} from "@/types/analytics";

export interface AnalyticsFilters {
  period?: "week" | "month" | "quarter";
  district?: string;
}

export async function fetchOverview(filters?: AnalyticsFilters): Promise<OverviewMetrics> {
  const params = new URLSearchParams();
  if (filters?.period) params.set("period", filters.period);
  if (filters?.district) params.set("district", filters.district);
  return apiClient.get<OverviewMetrics>(`/api/analytics/overview?${params}`);
}

export async function fetchTopRemixed(limit = 10): Promise<TopRemixedResponse> {
  return apiClient.get<TopRemixedResponse>(`/api/analytics/top-remixed?limit=${limit}`);
}

export async function fetchContentGaps(): Promise<ContentGapResponse> {
  return apiClient.get<ContentGapResponse>("/api/analytics/content-gaps");
}

export async function fetchActivity(
  period: "week" | "month" | "quarter" = "month",
  granularity: "day" | "week" = "day"
): Promise<ActivityResponse> {
  return apiClient.get<ActivityResponse>(
    `/api/analytics/activity?period=${period}&granularity=${granularity}`
  );
}
