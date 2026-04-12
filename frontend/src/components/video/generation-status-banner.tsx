"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function GenerationStatusBanner() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 3,
        py: 2,
        borderRadius: 2,
        bgcolor: "#FFF7ED",
        border: "1.5px solid #FED7AA",
        mb: 3,
      }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: "#F97316",
          flexShrink: 0,
          animation: "pulse 1.5s ease-in-out infinite",
          "@keyframes pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.4 },
          },
        }}
      />
      <Typography variant="body2" sx={{ color: "#9A3412" }}>
        <strong>A video is already being generated for this project.</strong>{" "}
        Wait for it to finish before starting a new one.
      </Typography>
    </Box>
  );
}
