"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

export function StepBrandKit() {
  return (
    <Box>
      <Typography
        variant="h5"
        sx={{ fontSize: 28, fontWeight: 700, color: "#1F1F1F" }}
      >
        Brand + compliance kit
      </Typography>
      <Typography sx={{ mt: 1, fontSize: 16, color: "#5F6368" }}>
        Your project will use these brand assets and compliance rules
      </Typography>

      <Box sx={{ mt: 5 }}>
        {/* Active brand kit row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "16px",
            border: "1px solid #F0F0F0",
            bgcolor: "#FFFFFF",
            p: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "#F0FFF0",
              }}
            >
              <Typography sx={{ fontSize: 18, color: "#008A05", lineHeight: 1 }}>
                ●
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}>
                AIA Singapore — Brand Kit v1
              </Typography>
              <Typography sx={{ mt: 0.25, fontSize: 14, color: "#5F6368" }}>
                MAS compliance rules active · 5 rules loaded
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#1F1F1F",
              color: "#1F1F1F",
              fontSize: 14,
              fontWeight: 600,
              px: 2,
              py: 1,
              "&:hover": { bgcolor: "#F7F7F7", borderColor: "#1F1F1F" },
            }}
          >
            Change
          </Button>
        </Box>

        {/* Brand asset tiles */}
        <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
          {/* Colours */}
          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #F0F0F0",
              bgcolor: "#FFFFFF",
              p: 2,
            }}
          >
            <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 20, height: 20, borderRadius: "4px", bgcolor: "#D0103A" }} />
              <Box sx={{ width: 20, height: 20, borderRadius: "4px", bgcolor: "#1A1A18" }} />
              <Box sx={{ width: 20, height: 20, borderRadius: "4px", bgcolor: "#1B9D74" }} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "#5F6368" }}>
              Brand colours
            </Typography>
          </Box>

          {/* Typography */}
          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #F0F0F0",
              bgcolor: "#FFFFFF",
              p: 2,
            }}
          >
            <Typography sx={{ mb: 1, fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}>
              Aa
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "#5F6368" }}>
              Inter font family
            </Typography>
          </Box>

          {/* Compliance */}
          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #F0F0F0",
              bgcolor: "#FFFFFF",
              p: 2,
            }}
          >
            <Typography sx={{ mb: 1, fontSize: 16 }}>🛡️</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "#5F6368" }}>
              MAS compliant
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
