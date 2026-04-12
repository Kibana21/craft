"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ExportAspectRatio, ExportFormat } from "@/types/export";

interface ExportOption {
  format: ExportFormat;
  aspectRatio?: ExportAspectRatio;
  label: string;
  description: string;
  icon: string;
}

const POSTER_OPTIONS: ExportOption[] = [
  { format: "png", aspectRatio: "1:1", label: "Square PNG", description: "1080 × 1080 px", icon: "◻" },
  { format: "png", aspectRatio: "4:5", label: "Portrait PNG", description: "1080 × 1350 px", icon: "▭" },
  { format: "png", aspectRatio: "9:16", label: "Story PNG", description: "1080 × 1920 px", icon: "📱" },
  { format: "jpg", aspectRatio: "1:1", label: "Square JPG", description: "1080 × 1080 px · smaller file", icon: "◻" },
  { format: "jpg", aspectRatio: "4:5", label: "Portrait JPG", description: "1080 × 1350 px · smaller file", icon: "▭" },
];

const WHATSAPP_OPTIONS: ExportOption[] = [
  { format: "png", aspectRatio: "800x800", label: "WhatsApp Card", description: "800 × 800 px PNG", icon: "💬" },
];

const REEL_OPTIONS: ExportOption[] = [
  { format: "mp4", aspectRatio: "9:16", label: "Reel MP4", description: "1080 × 1920 · H.264 · 30fps", icon: "🎬" },
];

type ArtifactType = "poster" | "whatsapp_card" | "reel" | string;

interface ExportFormatOptionsProps {
  artifactType: ArtifactType;
  selected: { format: ExportFormat; aspectRatio?: ExportAspectRatio } | null;
  onSelect: (format: ExportFormat, aspectRatio?: ExportAspectRatio) => void;
}

function getOptions(artifactType: ArtifactType): ExportOption[] {
  if (artifactType === "whatsapp_card") return WHATSAPP_OPTIONS;
  if (artifactType === "reel") return REEL_OPTIONS;
  return POSTER_OPTIONS;
}

export function ExportFormatOptions({ artifactType, selected, onSelect }: ExportFormatOptionsProps) {
  const options = getOptions(artifactType);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        gap: 1,
      }}
    >
      {options.map((opt) => {
        const isSelected =
          selected?.format === opt.format && selected?.aspectRatio === opt.aspectRatio;

        return (
          <Box
            key={`${opt.format}-${opt.aspectRatio}`}
            component="button"
            type="button"
            onClick={() => onSelect(opt.format, opt.aspectRatio)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderRadius: "12px",
              border: `1px solid ${isSelected ? "#D0103A" : "#DDDDDD"}`,
              bgcolor: isSelected ? "#FFF0F3" : "#FFFFFF",
              boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              p: 2,
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color 0.15s, background-color 0.15s",
              "&:hover": {
                borderColor: isSelected ? "#D0103A" : "#AAAAAA",
              },
            }}
          >
            <Typography sx={{ fontSize: "1.5rem", lineHeight: 1 }}>{opt.icon}</Typography>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: isSelected ? "#D0103A" : "#222222",
                }}
              >
                {opt.label}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#717171" }}>
                {opt.description}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
