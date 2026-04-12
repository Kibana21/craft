"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";

interface AnalyticsFiltersProps {
  period: "week" | "month" | "quarter";
  onPeriodChange: (p: "week" | "month" | "quarter") => void;
}

const PERIODS = [
  { value: "week" as const, label: "7 days" },
  { value: "month" as const, label: "30 days" },
  { value: "quarter" as const, label: "90 days" },
];

export function AnalyticsFilters({ period, onPeriodChange }: AnalyticsFiltersProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 14, color: "#717171" }}>Period:</Typography>
      <Box
        sx={{
          display: "flex",
          borderRadius: "8px",
          border: "1px solid #DDDDDD",
          bgcolor: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        {PERIODS.map((p) => (
          <ButtonBase
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            sx={{
              px: 2,
              py: 1,
              fontSize: 14,
              fontWeight: 500,
              transition: "background-color 0.15s, color 0.15s",
              ...(period === p.value
                ? {
                    bgcolor: "#1F1F1F",
                    color: "#FFFFFF",
                  }
                : {
                    color: "#6B6B6B",
                    "&:hover": {
                      bgcolor: "#F7F7F7",
                    },
                  }),
            }}
          >
            {p.label}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
