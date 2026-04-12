"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import type { OverviewMetrics } from "@/types/analytics";

interface OverviewMetricsProps {
  data: OverviewMetrics;
  isLoading?: boolean;
}

const METRICS = [
  {
    key: "assets_created_week" as const,
    label: "Created this week",
    icon: "✏️",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "assets_created_month" as const,
    label: "Created this month",
    icon: "📅",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "total_remixes" as const,
    label: "Total remixes",
    icon: "🔄",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "compliance_rate" as const,
    label: "Compliance rate",
    icon: "✅",
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  {
    key: "active_fscs" as const,
    label: "Active FSCs",
    icon: "👥",
    format: (v: number) => v.toLocaleString(),
  },
];

export function OverviewMetrics({ data, isLoading }: OverviewMetricsProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          lg: "repeat(5, 1fr)",
        },
        gap: 2,
      }}
    >
      {METRICS.map((m) => (
        <Box
          key={m.key}
          sx={{
            borderRadius: "12px",
            border: "1px solid #EBEBEB",
            bgcolor: "#FFFFFF",
            p: 2.5,
          }}
        >
          <Typography sx={{ fontSize: 24, mb: 1.5, lineHeight: 1 }}>
            {m.icon}
          </Typography>
          {isLoading ? (
            <Skeleton
              variant="rectangular"
              width={64}
              height={28}
              sx={{ borderRadius: "6px", bgcolor: "#F7F7F7" }}
            />
          ) : (
            <Typography
              sx={{
                fontSize: 24,
                fontWeight: 700,
                color: "#222222",
                lineHeight: 1,
              }}
            >
              {m.format(data[m.key])}
            </Typography>
          )}
          <Typography sx={{ mt: 0.75, fontSize: 12, color: "#717171" }}>
            {m.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
