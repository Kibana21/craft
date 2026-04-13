"use client";

// Consistent AI-assist button used across all poster wizard steps.
// Replaces the repeated inline button pattern in each step page.
//
// Usage:
//   <AiAssistChip onClick={handleGenerate} loading={isAiLoading}>
//     AI generate brief
//   </AiAssistChip>

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import type { ReactNode } from "react";

interface AiAssistChipProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  size?: "sm" | "md";
}

const SparkleIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" />
  </svg>
);

export function AiAssistChip({
  onClick,
  loading = false,
  disabled = false,
  children,
  size = "sm",
}: AiAssistChipProps) {
  const isDisabled = disabled || loading;
  const px = size === "md" ? 2 : 1.5;
  const py = size === "md" ? 0.75 : 0.6;
  const fontSize = size === "md" ? "13px" : "12px";

  return (
    <Box
      component="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px,
        py,
        borderRadius: "9999px",
        border: "1px solid #D0103A",
        bgcolor: "transparent",
        color: "#D0103A",
        fontSize,
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "background-color 0.15s",
        flexShrink: 0,
        "&:hover:not(:disabled)": { bgcolor: "#FFF1F4" },
      }}
    >
      {loading ? (
        <CircularProgress size={10} sx={{ color: "#D0103A" }} />
      ) : (
        <SparkleIcon />
      )}
      {children}
    </Box>
  );
}
