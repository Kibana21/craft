"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { LeaderboardEntry } from "@/types/gamification";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userRank: number | null;
}

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardTable({ entries, userEntry, userRank }: LeaderboardTableProps) {
  const showUserSeparate =
    userEntry && !entries.some((e) => e.is_current_user);

  return (
    <Box
      sx={{
        overflow: "hidden",
        borderRadius: "16px",
        border: "1px solid #E8EAED",
        bgcolor: "#FFFFFF",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "40px 1fr 80px 80px",
          gap: 2,
          borderBottom: "1px solid #E8EAED",
          px: 3,
          py: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9E9E9E" }}>
          #
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9E9E9E" }}>
          Agent
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9E9E9E", textAlign: "right" }}>
          Points
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9E9E9E", textAlign: "right" }}>
          Streak
        </Typography>
      </Box>

      {entries.map((entry) => (
        <LeaderboardRow key={entry.user_id} entry={entry} />
      ))}

      {/* Current user outside top N */}
      {showUserSeparate && userEntry && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 1,
            }}
          >
            <Typography variant="caption" sx={{ color: "#9E9E9E" }}>
              · · ·
            </Typography>
          </Box>
          <LeaderboardRow entry={userEntry} />
        </>
      )}
    </Box>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const rankIcon = RANK_ICONS[entry.rank];
  const initials = entry.user_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 80px 80px",
        alignItems: "center",
        gap: 2,
        px: 3,
        py: 2,
        bgcolor: entry.is_current_user ? "#FFF0F3" : "#FFFFFF",
        transition: "background-color 150ms ease",
        "&:hover": {
          bgcolor: entry.is_current_user ? "#FFF0F3" : "#F7F7F7",
        },
      }}
    >
      {/* Rank */}
      <Typography
        sx={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: entry.rank <= 3 ? "1.125rem" : "0.875rem",
          color: entry.rank <= 3 ? "inherit" : "#5F6368",
        }}
      >
        {rankIcon || entry.rank}
      </Typography>

      {/* User */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {entry.user_avatar ? (
          <Box
            component="img"
            src={entry.user_avatar}
            alt={entry.user_name}
            sx={{
              height: 32,
              width: 32,
              flexShrink: 0,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            sx={{
              display: "flex",
              height: 32,
              width: 32,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              bgcolor: "#1F1F1F",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#FFFFFF" }}>
              {initials}
            </Typography>
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: entry.is_current_user ? "#D0103A" : "#1F1F1F",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.user_name}
            {entry.is_current_user && (
              <Typography
                component="span"
                sx={{ ml: 0.75, fontSize: "0.75rem", fontWeight: 400, color: "#D0103A" }}
              >
                (you)
              </Typography>
            )}
          </Typography>
        </Box>
      </Box>

      {/* Points */}
      <Typography sx={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 700, color: "#1F1F1F" }}>
        {entry.points.toLocaleString()}
      </Typography>

      {/* Streak */}
      <Typography sx={{ textAlign: "right", fontSize: "0.875rem", color: "#5F6368" }}>
        {entry.streak > 0 ? `🔥 ${entry.streak}` : "—"}
      </Typography>
    </Box>
  );
}
