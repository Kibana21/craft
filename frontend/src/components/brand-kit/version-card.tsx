"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { BrandKitVersionSummary } from "@/types/brand-kit";

interface VersionCardProps {
  version: BrandKitVersionSummary;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: "6px",
          backgroundColor: color,
          border: "1px solid rgba(0,0,0,0.08)",
          flexShrink: 0,
        }}
      />
      <Box>
        <Typography sx={{ fontSize: 11, color: "#9E9E9E", lineHeight: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontFamily: "monospace", color: "#1F1F1F" }}>{color}</Typography>
      </Box>
    </Box>
  );
}

export function VersionCard({ version, onRestore, isRestoring }: VersionCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isActive = version.is_active;
  const dotColor = isActive ? "#188038" : "#9E9E9E";

  const formattedDate = version.activated_at
    ? new Date(version.activated_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const fonts = version.fonts ?? {};
  const headingFont = fonts.heading as string | undefined;
  const bodyFont = fonts.body as string | undefined;
  const disclaimerFont = fonts.disclaimer as string | undefined;

  return (
    <Box
      sx={{
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        mb: 1.5,
        overflow: "hidden",
        backgroundColor: isActive ? "#FAFFFE" : "#FFFFFF",
      }}
    >
      {/* Header row */}
      <Box sx={{ p: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", minWidth: 0 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: dotColor,
              mt: 0.6,
              flexShrink: 0,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
              v{version.version} — {version.name}
            </Typography>
            <Typography
              sx={{
                fontSize: 12,
                color: "#5F6368",
                mt: 0.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {version.activated_by_info && `Activated by ${version.activated_by_info.name}`}
              {formattedDate && ` · ${formattedDate}`}
              {version.changelog && ` · ${version.changelog}`}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {/* Preview toggle */}
          {!isActive && (
            <Box
              component="button"
              onClick={() => setPreviewOpen((v) => !v)}
              sx={{
                fontSize: 12,
                color: previewOpen ? "#D0103A" : "#5F6368",
                border: "1px solid",
                borderColor: previewOpen ? "#D0103A" : "#E8EAED",
                borderRadius: 9999,
                px: 1.5,
                py: 0.25,
                cursor: "pointer",
                background: "none",
                whiteSpace: "nowrap",
                "&:hover": { borderColor: "#D0103A", color: "#D0103A" },
              }}
            >
              {previewOpen ? "Hide" : "Preview"}
            </Box>
          )}

          {isActive ? (
            <Box
              sx={{
                px: 1.5,
                py: 0.25,
                borderRadius: 9999,
                backgroundColor: "#E8F5E9",
                fontSize: 12,
                fontWeight: 600,
                color: "#188038",
                whiteSpace: "nowrap",
              }}
            >
              Active
            </Box>
          ) : (
            <Button
              onClick={() => onRestore(version.id)}
              disabled={isRestoring}
              variant="outlined"
              size="small"
              startIcon={
                isRestoring ? <CircularProgress size={12} sx={{ color: "#5F6368" }} /> : undefined
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                fontSize: 12,
                borderColor: "#E8EAED",
                color: "#5F6368",
                px: 1.5,
                py: 0.25,
                minWidth: 0,
                "&:hover": { borderColor: "#DADCE0" },
              }}
            >
              Restore
            </Button>
          )}
        </Box>
      </Box>

      {/* Expandable preview */}
      <Collapse in={previewOpen}>
        <Box
          sx={{
            px: 2,
            pb: 2,
            pt: 0.5,
            borderTop: "1px solid #F0F0F0",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          {/* Colours */}
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", mb: 1, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Colours
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <ColorSwatch color={version.primary_color} label="Primary" />
              <ColorSwatch color={version.secondary_color} label="Secondary" />
              <ColorSwatch color={version.accent_color} label="Accent" />
            </Box>
          </Box>

          {/* Fonts + Logo */}
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", mb: 1, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Fonts
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {headingFont && (
                <Typography sx={{ fontSize: 12, color: "#1F1F1F" }}>
                  <span style={{ color: "#9E9E9E" }}>Heading · </span>{headingFont}
                </Typography>
              )}
              {bodyFont && (
                <Typography sx={{ fontSize: 12, color: "#1F1F1F" }}>
                  <span style={{ color: "#9E9E9E" }}>Body · </span>{bodyFont}
                </Typography>
              )}
              {disclaimerFont && (
                <Typography sx={{ fontSize: 12, color: "#1F1F1F" }}>
                  <span style={{ color: "#9E9E9E" }}>Disclaimer · </span>{disclaimerFont}
                </Typography>
              )}
              {!headingFont && !bodyFont && !disclaimerFont && (
                <Typography sx={{ fontSize: 12, color: "#9E9E9E" }}>No fonts uploaded</Typography>
              )}
            </Box>

            {version.logo_url && (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Logo
                </Typography>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={version.logo_url}
                  alt="Logo"
                  style={{ maxHeight: 40, maxWidth: 120, objectFit: "contain" }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
