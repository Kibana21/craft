"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function ComplianceReviewPage() {
  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1F1F1F", fontSize: "28px" }}>
          Review Queue
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: "1rem", color: "#5F6368" }}>
          Pending Brand Library items and low-compliance artifacts
        </Typography>
      </Box>

      {/* Empty state */}
      <Box sx={{ mt: 6, textAlign: "center" }}>
        <Box
          sx={{
            mx: "auto",
            width: 64,
            height: 64,
            borderRadius: "50%",
            bgcolor: "#F8F9FA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.875rem",
          }}
        >
          ✅
        </Box>
        <Typography sx={{ mt: 2, fontSize: "1.125rem", fontWeight: 600, color: "#1F1F1F" }}>
          All clear
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: "0.875rem", color: "#5F6368" }}>
          No items requiring review right now. Check the Brand Library for pending publications.
        </Typography>
      </Box>
    </Box>
  );
}
