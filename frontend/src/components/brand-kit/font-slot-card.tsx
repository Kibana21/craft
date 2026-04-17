"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FontUpload } from "./font-upload";

const SLOT_CONFIG = {
  heading: {
    label: "Heading font",
    sub: "Poster titles, video title cards, WhatsApp card headers",
    preview: "Protect what matters",
    previewSize: 22,
    previewWeight: 700,
  },
  body: {
    label: "Body font",
    sub: "Supporting copy, sublines, bullet points on posters",
    preview: "Your future. Your family. Secured.",
    previewSize: 14,
    previewWeight: 400,
  },
  disclaimer: {
    label: "Disclaimer font",
    sub: "MAS-required disclaimers at bottom of every asset",
    preview: "This advertisement has not been reviewed by MAS. Protected up to specified limits by SDIC.",
    previewSize: 10,
    previewWeight: 400,
  },
} as const;

interface FontSlotCardProps {
  slot: "heading" | "body" | "disclaimer";
  fontName: string | undefined;
  fontUrl: string | undefined;
  isEditMode: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function FontSlotCard({ slot, fontName, fontUrl, isEditMode, onUpload }: FontSlotCardProps) {
  const config = SLOT_CONFIG[slot];

  return (
    <Box
      sx={{
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        p: 2.5,
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
        {config.label}
      </Typography>
      <Typography sx={{ fontSize: 11, color: "#5F6368", mt: 0.25 }}>
        {config.sub}
      </Typography>

      <Box
        sx={{
          mt: 2,
          p: 2,
          borderRadius: "8px",
          backgroundColor: "#F7F7F7",
          minHeight: 56,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: config.previewSize,
            fontWeight: config.previewWeight,
            color: slot === "disclaimer" ? "#5F6368" : "#1F1F1F",
            lineHeight: 1.4,
          }}
        >
          {config.preview}
        </Typography>
      </Box>

      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {fontName && (
          <Box
            sx={{
              px: 1, py: 0.25, borderRadius: 9999, backgroundColor: "#F7F7F7",
              fontSize: 11, color: "#5F6368",
            }}
          >
            {fontName}
          </Box>
        )}
        {slot === "disclaimer" && (
          <Box
            sx={{
              px: 1, py: 0.25, borderRadius: 9999, backgroundColor: "#FFF3E0",
              fontSize: 11, color: "#B45309",
            }}
          >
            8px fixed
          </Box>
        )}
        <Box
          sx={{
            px: 1, py: 0.25, borderRadius: 9999, backgroundColor: "#F7F7F7",
            fontSize: 11, color: "#5F6368",
          }}
        >
          {fontUrl ? ".woff2 uploaded" : "No file uploaded"}
        </Box>
      </Box>

      {slot === "disclaimer" && (
        <Box
          sx={{
            mt: 1.5, p: 1.5, borderRadius: "8px", backgroundColor: "#FFF8E1",
            fontSize: 11, color: "#B45309", lineHeight: 1.4,
          }}
        >
          Disclaimer font size is fixed at 8px minimum to satisfy MAS legibility requirements. Cannot be overridden by project settings.
        </Box>
      )}

      {isEditMode && (
        <Box sx={{ mt: 2 }}>
          <FontUpload
            slot={slot}
            currentFontName={fontName}
            onUpload={onUpload}
            disabled={false}
          />
        </Box>
      )}
    </Box>
  );
}
