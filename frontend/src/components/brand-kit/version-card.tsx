"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { BrandKitVersionSummary, ZoneColorRole, ZoneRoles } from "@/types/brand-kit";

interface VersionCardProps {
  version: BrandKitVersionSummary;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}

const SECTION_LABEL_SX = {
  fontSize: 10,
  fontWeight: 700,
  color: "#9E9E9E",
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  mb: 1,
};

const ZONE_LABELS: Record<keyof ZoneRoles, string> = {
  poster_background: "Poster bg",
  cta_fill: "CTA fill",
  disclaimer_strip: "Disclaimer strip",
  badge_callout: "Badge",
  headline_text: "Headline text",
};

const ROLE_LABEL: Record<ZoneColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  white: "White",
};

function Swatch({ color, name, hex }: { color: string; name?: string; hex: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: "5px",
          backgroundColor: color,
          border: "1px solid rgba(0,0,0,0.08)",
          flexShrink: 0,
        }}
      />
      <Box>
        {name && (
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: "#1F1F1F", lineHeight: 1.1 }}>
            {name}
          </Typography>
        )}
        <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: "#9E9E9E", lineHeight: 1.2 }}>
          {hex}
        </Typography>
      </Box>
    </Box>
  );
}

function LogoThumb({ url, label }: { url: string; label: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const resolved = url.startsWith("http") ? url : `${apiUrl}${url}`;
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: "#9E9E9E", mb: 0.5 }}>{label}</Typography>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={label}
        style={{
          maxHeight: 32,
          maxWidth: 100,
          objectFit: "contain",
          display: "block",
          backgroundColor: "#F7F7F7",
          borderRadius: 4,
          padding: 4,
        }}
      />
    </Box>
  );
}

export function VersionCard({ version, onRestore, isRestoring }: VersionCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isActive = version.is_active;

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
  const cn = version.color_names ?? {};
  const zr = version.zone_roles ?? {};
  const hasLogos = !!(version.logo_url || version.secondary_logo_url);
  const hasZones = Object.keys(zr).length > 0;

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
              backgroundColor: isActive ? "#188038" : "#9E9E9E",
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
            pt: 1.5,
            borderTop: "1px solid #F0F0F0",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
            gap: 2.5,
          }}
        >
          {/* Col 1: Colours */}
          <Box>
            <Typography sx={SECTION_LABEL_SX}>Colours</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Swatch
                color={version.primary_color}
                name={cn.primary_name || "Primary"}
                hex={version.primary_color}
              />
              <Swatch
                color={version.secondary_color}
                name={cn.secondary_name || "Secondary"}
                hex={version.secondary_color}
              />
              <Swatch
                color={version.accent_color}
                name={cn.accent_name || "Accent"}
                hex={version.accent_color}
              />
            </Box>

            {/* Zone assignments */}
            {hasZones && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={SECTION_LABEL_SX}>Zone assignments</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {(Object.keys(ZONE_LABELS) as (keyof ZoneRoles)[]).map((key) => {
                    const role = zr[key] as ZoneColorRole | undefined;
                    if (!role) return null;
                    const swatchColor =
                      role === "primary" ? version.primary_color :
                      role === "secondary" ? version.secondary_color :
                      role === "accent" ? version.accent_color : "#FFFFFF";
                    return (
                      <Box key={key} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 11, color: "#5F6368" }}>{ZONE_LABELS[key]}</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: swatchColor,
                              border: role === "white" ? "1px solid #E8EAED" : "none",
                            }}
                          />
                          <Typography sx={{ fontSize: 11, color: "#1F1F1F" }}>{ROLE_LABEL[role]}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>

          {/* Col 2: Typography */}
          <Box>
            <Typography sx={SECTION_LABEL_SX}>Typography</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {headingFont ? (
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Heading</Typography>
                  <Typography sx={{ fontSize: 12, color: "#1F1F1F", fontWeight: 500 }}>{headingFont}</Typography>
                </Box>
              ) : (
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Heading</Typography>
                  <Typography sx={{ fontSize: 12, color: "#BDBDBD" }}>Not uploaded</Typography>
                </Box>
              )}
              {bodyFont ? (
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Body</Typography>
                  <Typography sx={{ fontSize: 12, color: "#1F1F1F", fontWeight: 500 }}>{bodyFont}</Typography>
                </Box>
              ) : (
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Body</Typography>
                  <Typography sx={{ fontSize: 12, color: "#BDBDBD" }}>Not uploaded</Typography>
                </Box>
              )}
              {disclaimerFont ? (
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Disclaimer</Typography>
                  <Typography sx={{ fontSize: 12, color: "#1F1F1F", fontWeight: 500 }}>{disclaimerFont}</Typography>
                </Box>
              ) : (
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Disclaimer</Typography>
                  <Typography sx={{ fontSize: 12, color: "#BDBDBD" }}>Not uploaded</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Col 3: Logos */}
          <Box>
            <Typography sx={SECTION_LABEL_SX}>Logos</Typography>
            {hasLogos ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {version.logo_url && <LogoThumb url={version.logo_url} label="Primary" />}
                {version.secondary_logo_url && <LogoThumb url={version.secondary_logo_url} label="Secondary" />}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 12, color: "#BDBDBD" }}>No logos uploaded</Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
