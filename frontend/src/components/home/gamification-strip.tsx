"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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
    <Box
      sx={{
        borderTop: "1px solid #EBEBEB",
        bgcolor: "#FFFFFF",
        px: 3,
        py: 1.5,
      }}
    >
      <Box
        sx={{
          mx: "auto",
          display: "flex",
          maxWidth: "48rem",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography
          component="span"
          sx={{ fontSize: "1.25rem" }}
          title={`${streak}-day streak`}
        >
          {streak > 0 ? "🔥" : "💤"}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#222222" }}
        >
          {streak}-day streak
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              height: 8,
              overflow: "hidden",
              borderRadius: 9999,
              bgcolor: "#EBEBEB",
            }}
          >
            <Box
              sx={{
                height: "100%",
                borderRadius: 9999,
                bgcolor: "#D0103A",
                transition: "width 0.5s ease",
                width: stats ? `${progress}%` : "0%",
              }}
            />
          </Box>
        </Box>
        <Typography
          component="span"
          sx={{ whiteSpace: "nowrap", fontSize: "0.875rem", color: "#717171" }}
        >
          {points.toLocaleString()} pts
          {percentile !== null && ` · Top ${percentile.toFixed(0)}%`}
        </Typography>
      </Box>
    </Box>
  );
}
