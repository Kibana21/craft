"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const MILESTONES = [
  { threshold: 0, label: "Bronze Creator", color: "#CD7F32" },
  { threshold: 500, label: "Silver Creator", color: "#C0C0C0" },
  { threshold: 2000, label: "Gold Creator", color: "#FFD700" },
  { threshold: 5000, label: "Platinum Creator", color: "#E5E4E2" },
  { threshold: 10000, label: "Diamond Creator", color: "#B9F2FF" },
];

interface PointsProgressProps {
  points: number;
  nextMilestone: number;
  currentLevel: string;
  compact?: boolean;
}

export function PointsProgress({
  points,
  nextMilestone,
  currentLevel,
  compact = false,
}: PointsProgressProps) {
  const current = MILESTONES.find((m) => m.label === currentLevel) || MILESTONES[0];
  const progress =
    nextMilestone > current.threshold
      ? Math.min(100, ((points - current.threshold) / (nextMilestone - current.threshold)) * 100)
      : 100;

  if (compact) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                transition: "width 500ms ease",
                width: `${progress}%`,
                bgcolor: current.color,
              }}
            />
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: "#5F6368", whiteSpace: "nowrap" }}>
          {points.toLocaleString()} / {nextMilestone.toLocaleString()}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              height: 12,
              width: 12,
              borderRadius: "50%",
              bgcolor: current.color,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, color: "#1F1F1F" }}>
            {currentLevel}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: "#5F6368" }}>
          {points.toLocaleString()} pts
        </Typography>
      </Box>

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
            transition: "width 700ms ease",
            width: `${progress}%`,
            bgcolor: current.color,
          }}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: "#5F6368" }}>
          {points.toLocaleString()}
        </Typography>
        <Typography variant="caption" sx={{ color: "#5F6368" }}>
          {nextMilestone.toLocaleString()} for next level
        </Typography>
      </Box>
    </Box>
  );
}
