"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchScoreBreakdown } from "@/lib/api/compliance";
import { ErrorBanner } from "@/components/common/error-banner";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";

interface ScoreBreakdownProps {
  artifactId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScoreBreakdown({ artifactId, isOpen, onClose }: ScoreBreakdownProps) {
  const query = useQuery({
    queryKey: ["compliance", "score", artifactId] as const,
    queryFn: () => fetchScoreBreakdown(artifactId),
    enabled: isOpen && !!artifactId,
  });

  const data = query.data;
  const isLoading = query.isPending;
  const isRefetchError = query.isError && query.data !== undefined;

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Modal panel */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          mx: 2,
          maxHeight: "80vh",
          width: "100%",
          maxWidth: 512,
          overflowY: "auto",
          borderRadius: "16px",
          border: "1px solid #F0F0F0",
          bgcolor: "#FFFFFF",
          p: 3,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        {/* Modal header */}
        <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#1F1F1F" }}>
            Compliance Score
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              borderRadius: "8px",
              color: "#5F6368",
              "&:hover": { bgcolor: "#F8F9FA", color: "#1F1F1F" },
            }}
          >
            ✕
          </IconButton>
        </Box>

        {isRefetchError && (
          <ErrorBanner
            compact
            message="Couldn't refresh the score."
            isStale
            isRetrying={query.isFetching}
            onRetry={() => query.refetch()}
          />
        )}

        {isLoading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={48} sx={{ borderRadius: "16px" }} />
            ))}
          </Box>
        ) : data ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Overall score */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#fff",
                  bgcolor:
                    data.score >= 90
                      ? "#188038"
                      : data.score >= 70
                      ? "#B45309"
                      : "#D0103A",
                }}
              >
                {Math.round(data.score)}
              </Box>
            </Box>

            {/* Rules checked */}
            {data.breakdown.rules && data.breakdown.rules.length > 0 && (
              <Box>
                <Typography sx={{ mb: 1.5, fontSize: "0.875rem", fontWeight: 600, color: "#5F6368" }}>
                  Rules checked
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {data.breakdown.rules.map((rule, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        borderRadius: "16px",
                        p: 1.5,
                        bgcolor: rule.passed ? "#E6F4EA" : "#FCE8E6",
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          mt: 0.5,
                          fontSize: "0.875rem",
                          color: rule.passed ? "#188038" : "#C5221F",
                        }}
                      >
                        {rule.passed ? "✓" : "✗"}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>
                          {rule.rule_text}
                        </Typography>
                        {rule.details && (
                          <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#C5221F" }}>
                            {rule.details}
                          </Typography>
                        )}
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          borderRadius: 9999,
                          px: 1,
                          py: 0.25,
                          fontSize: "0.625rem",
                          fontWeight: 600,
                          ...(rule.severity === "error"
                            ? { bgcolor: "#FCE8E6", color: "#C5221F" }
                            : { bgcolor: "#FEF7E0", color: "#B45309" }),
                        }}
                      >
                        {rule.severity}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Required disclaimers */}
            {data.breakdown.disclaimers && data.breakdown.disclaimers.length > 0 && (
              <Box>
                <Typography sx={{ mb: 1.5, fontSize: "0.875rem", fontWeight: 600, color: "#5F6368" }}>
                  Required disclaimers
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {data.breakdown.disclaimers.map((d, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        borderRadius: "16px",
                        p: 1.5,
                        bgcolor: d.present ? "#E6F4EA" : "#FCE8E6",
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          mt: 0.5,
                          fontSize: "0.875rem",
                          color: d.present ? "#188038" : "#C5221F",
                        }}
                      >
                        {d.present ? "✓" : "✗"}
                      </Typography>
                      <Typography sx={{ flex: 1, fontSize: "0.75rem", color: "#5F6368" }}>
                        {d.disclaimer}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Suggestions */}
            {data.suggestions.length > 0 && (
              <Box>
                <Typography sx={{ mb: 1.5, fontSize: "0.875rem", fontWeight: 600, color: "#5F6368" }}>
                  Suggestions
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {data.suggestions.map((s, i) => (
                    <Box key={i} sx={{ borderRadius: "16px", bgcolor: "#FEF7E0", p: 1.5 }}>
                      <Typography sx={{ fontSize: "0.875rem", color: "#B45309" }}>{s}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Typography sx={{ textAlign: "center", fontSize: "0.875rem", color: "#9E9E9E" }}>
            Failed to load score breakdown
          </Typography>
        )}
      </Box>
    </Box>
  );
}
