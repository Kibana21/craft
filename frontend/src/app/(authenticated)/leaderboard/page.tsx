"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 5 }}>
        <Typography
          variant="h5"
          sx={{ fontSize: "1.75rem", fontWeight: 700, color: "#1F1F1F" }}
        >
          Leaderboard
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.5, color: "#5F6368" }}>
          Top creators in CRAFT this month
        </Typography>
      </Box>

      {/* My stats card */}
      {stats && (
        <Box
          sx={{
            mb: 4,
            borderRadius: "16px",
            border: "1px solid #E8EAED",
            bgcolor: "#FFFFFF",
            p: 3,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 2,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#9E9E9E",
            }}
          >
            Your progress
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <StreakDisplay streak={stats.current_streak} size="lg" />
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#1F1F1F" }}>
                #{stats.rank ?? "—"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#5F6368" }}>
                {stats.percentile !== null
                  ? `Top ${stats.percentile.toFixed(0)}%`
                  : ""}
              </Typography>
            </Box>
          </Box>

          <PointsProgress
            points={stats.total_points}
            nextMilestone={stats.next_milestone}
            currentLevel={stats.current_level}
          />
        </Box>
      )}

      {/* Leaderboard table */}
      {isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Box
              key={i}
              sx={{
                height: 64,
                borderRadius: "12px",
                bgcolor: "#F7F7F7",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.4 },
                },
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </Box>
      ) : leaderboard ? (
        <>
          <Box
            sx={{
              mb: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="caption" sx={{ color: "#5F6368" }}>
              Top {leaderboard.entries.length} creators
            </Typography>
            <Typography variant="caption" sx={{ color: "#5F6368" }}>
              {leaderboard.total_members} total members
            </Typography>
          </Box>
          <LeaderboardTable
            entries={leaderboard.entries}
            userEntry={leaderboard.user_entry}
            userRank={leaderboard.user_rank}
          />
        </>
      ) : (
        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Typography variant="body2" sx={{ color: "#5F6368" }}>
            No leaderboard data yet
          </Typography>
        </Box>
      )}

      {/* Points guide */}
      <Box
        sx={{
          mt: 5,
          borderRadius: "16px",
          bgcolor: "#F7F7F7",
          p: 3,
        }}
      >
        <Typography
          variant="body2"
          sx={{ mb: 2, fontWeight: 600, color: "#1F1F1F" }}
        >
          How to earn points
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[
            { action: "Create an artifact", points: "+10" },
            { action: "Export an artifact", points: "+20" },
            { action: "Remix from Brand Library", points: "+15" },
            { action: "7-day streak bonus", points: "+50" },
          ].map((item) => (
            <Box
              key={item.action}
              sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="body2" sx={{ color: "#1F1F1F" }}>
                {item.action}
              </Typography>
              <Box
                component="span"
                sx={{
                  borderRadius: 9999,
                  bgcolor: "#D0103A",
                  px: 1.25,
                  py: 0.25,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#FFFFFF",
                }}
              >
                {item.points}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
