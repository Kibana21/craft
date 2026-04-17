"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface ContrastPairingProps {
  bgColor: string;
  textColor: string;
  label: string;
}

export function ContrastPairing({ bgColor, textColor, label }: ContrastPairingProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box
        sx={{
          width: 80,
          height: 28,
          borderRadius: "6px",
          backgroundColor: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: textColor }}>
          Aa
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: "#5F6368" }}>{label}</Typography>
    </Box>
  );
}
