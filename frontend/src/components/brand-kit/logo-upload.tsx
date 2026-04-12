"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

interface LogoUploadProps {
  label: string;
  currentUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function LogoUpload({ label, currentUrl, onUpload, disabled }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const resolveUrl = (url: string) =>
    url.startsWith("http") ? url : `${API_BASE}${url}`;

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography
        component="label"
        sx={{ fontSize: 14, fontWeight: 500, color: "#484848" }}
      >
        {label}
      </Typography>

      <Box
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !disabled) handleFile(file);
        }}
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "12px",
          border: "2px dashed",
          borderColor: isDragging ? "#D0103A" : "#DDDDDD",
          backgroundColor: isDragging ? "#FFF0F3" : "#F7F7F7",
          p: 3,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color 0.2s, background-color 0.2s",
          "&:hover": disabled
            ? {}
            : {
                borderColor: "#AAAAAA",
              },
        }}
      >
        <Box
          component="input"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          disabled={disabled}
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          }}
          sx={{ display: "none" }}
        />

        {isUploading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <CircularProgress size={32} sx={{ color: "#D0103A" }} />
            <Typography sx={{ fontSize: 12, color: "#717171" }}>Uploading…</Typography>
          </Box>
        ) : currentUrl ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              component="img"
              src={resolveUrl(currentUrl)}
              alt={label}
              sx={{ height: 64, width: "auto", maxWidth: 140, objectFit: "contain" }}
            />
            <Typography sx={{ fontSize: 12, color: "#717171" }}>Click to replace</Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: "flex",
                height: 40,
                width: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                backgroundColor: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                fontSize: 20,
              }}
            >
              🖼
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#484848" }}>
              Upload logo
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#717171" }}>
              PNG, SVG, JPG, WebP · max 10 MB
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
