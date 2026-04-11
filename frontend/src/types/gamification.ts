export interface GamificationStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  rank: number | null;
  percentile: number | null;
  current_level: string;
  next_milestone: number;
  last_activity_date: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  points: number;
  streak: number;
  is_current_user: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  user_rank: number | null;
  user_entry: LeaderboardEntry | null;
  total_members: number;
}
