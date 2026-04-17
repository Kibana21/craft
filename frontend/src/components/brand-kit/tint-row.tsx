"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const STOPS = [
  { opacity: 0.1, label: "10%" },
  { opacity: 0.25, label: "25%" },
  { opacity: 0.5, label: "50%" },
  { opacity: 0.75, label: "75%" },
  { opacity: 1, label: "100%" },
];

interface TintRowProps {
  hex: string;
}

export function TintRow({ hex }: TintRowProps) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography sx={{ fontSize: 11, color: "#5F6368", mb: 0.75 }}>
        Derived tints for compositing
      </Typography>
      <Box sx={{ display: "flex", gap: 0.75 }}>
        {STOPS.map((s) => (
          <Box key={s.label} sx={{ textAlign: "center" }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "6px",
                backgroundColor: hex,
                opacity: s.opacity,
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            />
            <Typography sx={{ fontSize: 9, color: "#9E9E9E", mt: 0.25 }}>
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
