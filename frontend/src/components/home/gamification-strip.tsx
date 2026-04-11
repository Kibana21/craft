"use client";

import { useEffect, useState } from "react";
import { fetchMyGamification } from "@/lib/api/gamification";
import type { GamificationStats } from "@/types/gamification";

export function GamificationStrip() {
  const [stats, setStats] = useState<GamificationStats | null>(null);

  useEffect(() => {
    fetchMyGamification()
      .then(setStats)
      .catch(() => {});
  }, []);

  const streak = stats?.current_streak ?? 0;
  const points = stats?.total_points ?? 0;
  const percentile = stats?.percentile ?? null;
  const nextMilestone = stats?.next_milestone ?? 500;
  const currentLevelThreshold = (() => {
    const milestones = [0, 500, 2000, 5000, 10000];
    let prev = 0;
    for (const t of milestones) {
      if (points >= t) prev = t;
      else break;
    }
    return prev;
  })();
  const progress =
    nextMilestone > currentLevelThreshold
      ? Math.min(100, ((points - currentLevelThreshold) / (nextMilestone - currentLevelThreshold)) * 100)
      : 100;

  return (
    <div className="border-t border-[#EBEBEB] bg-white px-6 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        <span className="text-xl" title={`${streak}-day streak`}>
          {streak > 0 ? "🔥" : "💤"}
        </span>
        <span className="text-sm font-semibold text-[#222222]">
          {streak}-day streak
        </span>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-[#EBEBEB]">
            <div
              className="h-full rounded-full bg-[#D0103A] transition-all duration-500"
              style={{ width: stats ? `${progress}%` : "0%" }}
            />
          </div>
        </div>
        <span className="whitespace-nowrap text-sm text-[#717171]">
          {points.toLocaleString()} pts
          {percentile !== null && ` · Top ${percentile.toFixed(0)}%`}
        </span>
      </div>
    </div>
  );
}
