import { apiClient } from "@/lib/api-client";
import type { GamificationStats, LeaderboardResponse } from "@/types/gamification";

export async function fetchMyGamification(): Promise<GamificationStats> {
  return apiClient.get<GamificationStats>("/api/gamification/me");
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  return apiClient.get<LeaderboardResponse>("/api/gamification/leaderboard");
}
