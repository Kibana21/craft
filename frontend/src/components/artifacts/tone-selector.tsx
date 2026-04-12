"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";

const TONES = [
  { key: "professional", label: "Professional", icon: "💼" },
  { key: "friendly", label: "Friendly", icon: "😊" },
  { key: "urgent", label: "Urgent", icon: "⚡" },
  { key: "inspirational", label: "Inspirational", icon: "✨" },
  { key: "festive", label: "Festive", icon: "🎉" },
];

interface ToneSelectorProps {
  value: string;
  onChange: (tone: string) => void;
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <Box>
      <Typography
        component="label"
        sx={{
          display: "block",
          mb: 1,
          fontSize: "14px",
          fontWeight: 500,
          color: "#484848",
        }}
      >
        Tone
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {TONES.map((tone) => (
          <ButtonBase
            key={tone.key}
            onClick={() => onChange(tone.key)}
            sx={{
              borderRadius: 9999,
              px: 2,
              py: 1,
              fontSize: "14px",
              fontWeight: 500,
              border: "1px solid",
              transition: "all 0.2s",
              ...(value === tone.key
                ? {
                    bgcolor: "#222222",
                    color: "#FFFFFF",
                    borderColor: "#222222",
                  }
                : {
                    bgcolor: "#FFFFFF",
                    color: "#484848",
                    borderColor: "#DDDDDD",
                    "&:hover": { borderColor: "#222222" },
                  }),
            }}
          >
            {tone.icon} {tone.label}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
