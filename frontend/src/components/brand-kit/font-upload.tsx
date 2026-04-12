"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

interface FontUploadProps {
  slot: "heading" | "body" | "accent";
  currentFontName: string | undefined;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const SLOT_LABELS: Record<string, string> = {
  heading: "Heading font",
  body: "Body font",
  accent: "Accent font",
};

const SAMPLE_FONT_SX: Record<string, object> = {
  heading: { fontSize: "1.5rem", fontWeight: 700 },
  body: { fontSize: "1rem" },
  accent: { fontSize: "0.875rem", fontStyle: "italic" },
};

export function FontUpload({ slot, currentFontName, onUpload, disabled }: FontUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: "12px",
        border: "1px solid #DDDDDD",
        bgcolor: "#FFFFFF",
        p: 2,
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#AAAAAA",
          }}
        >
          {SLOT_LABELS[slot]}
        </Typography>

        {currentFontName ? (
          <Typography
            sx={{
              color: "#222222",
              ...SAMPLE_FONT_SX[slot],
            }}
          >
            {currentFontName.replace(/\.[^.]+$/, "")}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: "0.875rem", color: "#AAAAAA" }}>
            No font uploaded
          </Typography>
        )}

        <Typography sx={{ mt: 0.25, fontSize: "0.75rem", color: "#717171" }}>
          The quick brown fox jumps over the lazy dog
        </Typography>
      </Box>

      <Box>
        <input
          ref={inputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          style={{ display: "none" }}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled || isUploading}
          sx={{
            borderRadius: "8px",
            border: "1px solid #DDDDDD",
            bgcolor: "#FFFFFF",
            color: "#484848",
            fontSize: "0.875rem",
            fontWeight: 500,
            textTransform: "none",
            px: 2,
            py: 1,
            transition: "border-color 0.15s, color 0.15s",
            "&:hover": {
              borderColor: "#222222",
              color: "#222222",
              bgcolor: "#FFFFFF",
            },
            "&:disabled": {
              cursor: "not-allowed",
              opacity: 0.5,
            },
          }}
        >
          {isUploading ? "Uploading…" : currentFontName ? "Replace" : "Upload"}
        </Button>
      </Box>
    </Box>
  );
}
