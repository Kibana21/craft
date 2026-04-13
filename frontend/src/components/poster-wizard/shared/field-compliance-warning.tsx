"use client";

// Per-field compliance warning card (doc 08).
// Shows amber warnings and red errors; each flag is dismissible for the session.
// Re-appears if the offending text reappears (handled in useFieldCompliance).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ComplianceFlag } from "@/lib/api/poster-wizard";

interface FieldComplianceWarningProps {
  flags: ComplianceFlag[];
  onDismiss?: (flag: ComplianceFlag) => void;
}

export function FieldComplianceWarning({ flags, onDismiss }: FieldComplianceWarningProps) {
  if (flags.length === 0) return null;

  return (
    <Box sx={{ mt: 0.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {flags.map((flag, i) => {
        const isError = flag.severity === "ERROR";
        return (
          <Box
            key={i}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.75,
              px: 1.5,
              py: 1,
              borderRadius: "8px",
              bgcolor: isError ? "rgba(208, 16, 58, 0.06)" : "rgba(245, 159, 0, 0.08)",
              border: `1px solid ${isError ? "#F5C6D0" : "#F59F00"}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "13px",
                fontWeight: 700,
                lineHeight: 1.4,
                color: isError ? "#D0103A" : "#B45309",
                flexShrink: 0,
                mt: "1px",
              }}
            >
              {isError ? "✕" : "⚠"}
            </Typography>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Main flag message */}
              <Typography sx={{ fontSize: "12px", fontWeight: 600, color: isError ? "#D0103A" : "#B45309", lineHeight: 1.4 }}>
                {flag.matched_phrase
                  ? `"${flag.matched_phrase}" may breach ${flag.mas_basis ?? "MAS regulations"}.`
                  : `${flag.pattern_type.replace(/_/g, " ").toLowerCase()} — ${flag.mas_basis ?? "MAS regulations"}.`}
              </Typography>

              {/* Suggestion */}
              {flag.suggestion && (
                <Typography sx={{ mt: 0.25, fontSize: "12px", color: "#5F6368", lineHeight: 1.4 }}>
                  Consider: {flag.suggestion}
                </Typography>
              )}
            </Box>

            {/* Dismiss button */}
            {onDismiss && (
              <Box
                component="button"
                onClick={() => onDismiss(flag)}
                aria-label="Dismiss compliance warning"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  p: 0,
                  flexShrink: 0,
                  color: "#9E9E9E",
                  "&:hover": { color: "#484848" },
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
