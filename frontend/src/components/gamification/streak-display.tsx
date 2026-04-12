"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface StreakDisplayProps {
  streak: number;
  size?: "sm" | "md" | "lg";
}

const ICON_FONT_SIZE: Record<string, string> = {
  sm: "1rem",
  md: "1.25rem",
  lg: "1.875rem",
};

const TEXT_FONT_SIZE: Record<string, string> = {
  sm: "0.875rem",
  md: "1rem",
  lg: "1.5rem",
};

const LABEL_FONT_SIZE: Record<string, string> = {
  sm: "0.75rem",
  md: "0.875rem",
  lg: "0.875rem",
};

export function StreakDisplay({ streak, size = "md" }: StreakDisplayProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Typography sx={{ fontSize: ICON_FONT_SIZE[size], lineHeight: 1 }}>
        {streak > 0 ? "🔥" : "💤"}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          color: "#222222",
          fontSize: TEXT_FONT_SIZE[size],
          lineHeight: 1,
        }}
      >
        {streak}
      </Typography>
      <Typography
        sx={{
          color: "#717171",
          fontSize: LABEL_FONT_SIZE[size],
          lineHeight: 1,
        }}
      >
        day streak
      </Typography>
    </Box>
  );
}
