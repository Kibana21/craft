"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { LeaderboardTable } from "@/components/gamification/leaderboard-table";
import { PointsProgress } from "@/components/gamification/points-progress";
import { StreakDisplay } from "@/components/gamification/streak-display";
import { fetchLeaderboard } from "@/lib/api/gamification";
import { fetchMyGamification } from "@/lib/api/gamification";
import type { LeaderboardResponse } from "@/types/gamification";
import type { GamificationStats } from "@/types/gamification";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchLeaderboard(), fetchMyGamification()])
      .then(([lb, s]) => {
        setLeaderboard(lb);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-[28px] font-bold text-[#222222]">Leaderboard</h1>
        <p className="mt-1 text-base text-[#717171]">
          Top creators in CRAFT this month
        </p>
      </div>

      {/* My stats card */}
      {stats && (
        <div className="mb-8 rounded-2xl border border-[#EBEBEB] bg-white p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#AAAAAA]">
            Your progress
          </p>
          <div className="mb-4 flex items-center justify-between">
            <StreakDisplay streak={stats.current_streak} size="lg" />
            <div className="text-right">
              <p className="text-2xl font-bold text-[#222222]">
                #{stats.rank ?? "—"}
              </p>
              <p className="text-xs text-[#717171]">
                {stats.percentile !== null
                  ? `Top ${stats.percentile.toFixed(0)}%`
                  : ""}
              </p>
            </div>
          </div>
          <PointsProgress
            points={stats.total_points}
            nextMilestone={stats.next_milestone}
            currentLevel={stats.current_level}
          />
        </div>
      )}

      {/* Leaderboard table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F7F7F7]" />
          ))}
        </div>
      ) : leaderboard ? (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-[#717171]">
            <span>Top {leaderboard.entries.length} creators</span>
            <span>{leaderboard.total_members} total members</span>
          </div>
          <LeaderboardTable
            entries={leaderboard.entries}
            userEntry={leaderboard.user_entry}
            userRank={leaderboard.user_rank}
          />
        </>
      ) : (
        <div className="mt-12 text-center">
          <p className="text-sm text-[#717171]">No leaderboard data yet</p>
        </div>
      )}

      {/* Points guide */}
      <div className="mt-10 rounded-2xl bg-[#F7F7F7] p-6">
        <h3 className="mb-4 text-sm font-semibold text-[#222222]">How to earn points</h3>
        <div className="space-y-2">
          {[
            { action: "Create an artifact", points: "+10" },
            { action: "Export an artifact", points: "+20" },
            { action: "Remix from Brand Library", points: "+15" },
            { action: "7-day streak bonus", points: "+50" },
          ].map((item) => (
            <div key={item.action} className="flex items-center justify-between">
              <span className="text-sm text-[#484848]">{item.action}</span>
              <span className="rounded-full bg-[#D0103A] px-2.5 py-0.5 text-xs font-semibold text-white">
                {item.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
