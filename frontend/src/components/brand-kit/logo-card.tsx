"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { LogoUpload } from "./logo-upload";

interface LogoCardProps {
  label: string;
  subLabel: string;
  currentUrl: string | null;
  specs: string;
  isEditMode: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function LogoCard({ label, subLabel, currentUrl, specs, isEditMode, onUpload }: LogoCardProps) {
  const [darkBg, setDarkBg] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const resolvedUrl =
    currentUrl && !currentUrl.startsWith("http")
      ? `${apiUrl}${currentUrl}`
      : currentUrl;

  return (
    <Box
      sx={{
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        p: 2.5,
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 11, color: "#5F6368", mt: 0.25 }}>
        {subLabel}
      </Typography>

      <Box
        sx={{
          mt: 2,
          borderRadius: "8px",
          backgroundColor: darkBg ? "#1A1A2E" : "#F7F7F7",
          minHeight: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          border: "1px solid #E8EAED",
        }}
      >
        {resolvedUrl ? (
          <Box
            component="img"
            src={resolvedUrl}
            alt={label}
            sx={{ maxHeight: 64, maxWidth: "80%", objectFit: "contain" }}
          />
        ) : (
          <Typography sx={{ fontSize: 12, color: "#9E9E9E" }}>No logo uploaded</Typography>
        )}
        <IconButton
          onClick={() => setDarkBg(!darkBg)}
          size="small"
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            backgroundColor: darkBg ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
            "&:hover": { backgroundColor: darkBg ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)" },
            width: 24,
            height: 24,
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: darkBg
                ? "linear-gradient(135deg, #FFF 50%, #1A1A2E 50%)"
                : "linear-gradient(135deg, #1A1A2E 50%, #FFF 50%)",
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          />
        </IconButton>
      </Box>

      <Typography sx={{ mt: 1.5, fontSize: 11, color: "#9E9E9E" }}>{specs}</Typography>

      {isEditMode && (
        <Box sx={{ mt: "auto", pt: 2 }}>
          <LogoUpload
            label={`Replace ${label.toLowerCase()}`}
            currentUrl={null}
            onUpload={onUpload}
            disabled={false}
          />
        </Box>
      )}
    </Box>
  );
}
