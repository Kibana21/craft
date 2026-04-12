"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ContentGap } from "@/types/analytics";

interface ContentGapsProps {
  gaps: ContentGap[];
  isLoading?: boolean;
}

export function ContentGaps({ gaps, isLoading }: ContentGapsProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              height: 48,
              borderRadius: "12px",
              bgcolor: "#F7F7F7",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </Box>
    );
  }

  if (gaps.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 96,
          borderRadius: "12px",
          border: "1px dashed #E8EAED",
          fontSize: 14,
          color: "#9E9E9E",
        }}
      >
        No content gaps detected
      </Box>
    );
  }

  return (
    <Box
      sx={{
        overflow: "hidden",
        borderRadius: "12px",
        border: "1px solid #F0F0F0",
      }}
    >
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <Box component="thead">
          <Box
            component="tr"
            sx={{ borderBottom: "1px solid #F0F0F0", bgcolor: "#F7F7F7" }}
          >
            {["Product", "Type", "FSC Creates", "Action"].map((heading, idx) => (
              <Box
                key={heading}
                component="th"
                sx={{
                  px: 2,
                  py: 1.5,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#5F6368",
                  textAlign: idx >= 2 ? "right" : "left",
                }}
              >
                {heading}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {gaps.map((gap, i) => (
            <Box
              key={i}
              component="tr"
              sx={{
                borderBottom: i < gaps.length - 1 ? "1px solid #F0F0F0" : "none",
                bgcolor: "#FFFFFF",
                transition: "background-color 0.15s",
                "&:hover": { bgcolor: "#F8F9FA" },
              }}
            >
              <Box
                component="td"
                sx={{ px: 2, py: 1.5, fontWeight: 500, color: "#1F1F1F" }}
              >
                {gap.product || "—"}
              </Box>
              <Box component="td" sx={{ px: 2, py: 1.5, color: "#5F6368" }}>
                {gap.artifact_type.replace(/_/g, " ")}
              </Box>
              <Box
                component="td"
                sx={{ px: 2, py: 1.5, textAlign: "right", fontWeight: 600, color: "#D0103A" }}
              >
                {gap.fsc_count}
              </Box>
              <Box component="td" sx={{ px: 2, py: 1.5, textAlign: "right" }}>
                <Typography
                  component="button"
                  onClick={() => router.push("/brand-library")}
                  sx={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#1B9D74",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    p: 0,
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Publish template →
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
