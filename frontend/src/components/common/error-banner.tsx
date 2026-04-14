"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface ErrorBannerProps {
  /** Human-friendly error message. */
  message?: string;
  /** If true, shows "Showing cached data" hint — fetched data is stale. */
  isStale?: boolean;
  /** If true, spinner on retry button. */
  isRetrying?: boolean;
  /** Retry handler. If omitted, no retry button is rendered. */
  onRetry?: () => void;
  /** Compact variant for inline use inside cards. */
  compact?: boolean;
}

// Used when a list-page fetch fails but we still have cached data to show.
// Design: subtle amber, not alarming red — a refetch failure is not a crash.
export function ErrorBanner({
  message = "Couldn't refresh. You're seeing the last known data.",
  isStale = true,
  isRetrying = false,
  onRetry,
  compact = false,
}: ErrorBannerProps) {
  return (
    <Box
      role="alert"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: compact ? 1.25 : 2,
        py: compact ? 0.75 : 1.25,
        mb: compact ? 1 : 1.5,
        borderRadius: "10px",
        border: "1px solid #FDE68A",
        bgcolor: "#FFFBEB",
        color: "#92400E",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <Typography sx={{ fontSize: compact ? "12px" : "13px", flex: 1, lineHeight: 1.4 }}>
        {message}
        {isStale && (
          <Box
            component="span"
            sx={{
              ml: 0.75,
              fontSize: compact ? "11px" : "12px",
              color: "#A16207",
              fontStyle: "italic",
            }}
          >
            · cached
          </Box>
        )}
      </Typography>
      {onRetry && (
        <Button
          size="small"
          variant="outlined"
          disabled={isRetrying}
          onClick={onRetry}
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            fontSize: "12px",
            borderColor: "#FDE68A",
            color: "#92400E",
            "&:hover": { bgcolor: "#FEF3C7", borderColor: "#FBBF24" },
          }}
        >
          {isRetrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </Box>
  );
}
