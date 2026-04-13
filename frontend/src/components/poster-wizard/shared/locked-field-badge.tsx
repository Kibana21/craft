"use client";

// Badge shown next to fields that are locked (subject.locked = true, doc 05).
// Prevents edits when the selected variant has been accepted and the field is frozen.
//
// Usage:
//   {subject.locked && <LockedFieldBadge />}

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface LockedFieldBadgeProps {
  tooltip?: string;
}

const LockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden
  >
    <path d="M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1zm-5-2a2 2 0 1 1 4 0v2H6V5zm2 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
  </svg>
);

export function LockedFieldBadge({
  tooltip = "This field is locked. Accept a variant to unlock edits.",
}: LockedFieldBadgeProps) {
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: "9999px",
          bgcolor: "#F7F7F7",
          border: "1px solid #E8EAED",
          cursor: "help",
        }}
        aria-label={tooltip}
      >
        <LockIcon />
        <Typography sx={{ fontSize: "11px", fontWeight: 600, color: "#9E9E9E" }}>
          Locked
        </Typography>
      </Box>
    </Tooltip>
  );
}
