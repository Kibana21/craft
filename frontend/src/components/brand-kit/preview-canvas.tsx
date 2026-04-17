"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { BrandKit, BrandKitTemplate, TemplateZone } from "@/types/brand-kit";

interface PreviewCanvasProps {
  kit: BrandKit;
  template?: BrandKitTemplate | null;
}

const BASE = 1080;

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`;
}

function scaleZone(zone: TemplateZone) {
  return {
    left: `${(zone.x / BASE) * 100}%`,
    top: `${(zone.y / BASE) * 100}%`,
    width: `${(zone.width / BASE) * 100}%`,
    height: `${(zone.height / BASE) * 100}%`,
  };
}

const DEFAULT_ZONES: TemplateZone[] = [
  { name: "creative", x: 0, y: 0, width: 594, height: 1080 },
  { name: "logo", x: 650, y: 54, width: 380, height: 120 },
  { name: "headline", x: 620, y: 240, width: 420, height: 320 },
  { name: "disclaimer", x: 0, y: 1006, width: 1080, height: 74 },
];

function findZone(zones: TemplateZone[], name: string): TemplateZone | undefined {
  return zones.find((z) => z.name === name);
}

export function PreviewCanvas({ kit, template }: PreviewCanvasProps) {
  const zones = template?.zones ?? DEFAULT_ZONES;
  const creativeZone = findZone(zones, "creative");
  const logoZone = findZone(zones, "logo");
  const headlineZone = findZone(zones, "headline");
  const bodyZone = findZone(zones, "body");
  const disclaimerZone = findZone(zones, "disclaimer");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const logoSrc =
    kit.logo_url && !kit.logo_url.startsWith("http")
      ? `${apiUrl}${kit.logo_url}`
      : kit.logo_url;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 260,
        aspectRatio: "4 / 5",
        borderRadius: "12px",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${kit.primary_color}, ${darken(kit.primary_color, 0.3)})`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
      }}
    >
      {/* AI scene zone */}
      {creativeZone && (
        <Box
          sx={{
            position: "absolute",
            ...scaleZone(creativeZone),
            backgroundColor: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>
              AI scene
            </Typography>
            <Typography sx={{ fontSize: 7, color: "rgba(255,255,255,0.4)", mt: 0.25 }}>
              Gemini output
            </Typography>
          </Box>
        </Box>
      )}

      {/* Logo */}
      {logoZone && (
        <Box
          sx={{
            position: "absolute",
            ...scaleZone(logoZone),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {logoSrc ? (
            <Box
              component="img"
              src={logoSrc}
              alt="Logo"
              sx={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }}
            />
          ) : (
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: "4px",
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "1px dashed rgba(255,255,255,0.4)",
              }}
            >
              <Typography sx={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>LOGO</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Headline */}
      {headlineZone && (
        <Box
          sx={{
            position: "absolute",
            ...scaleZone(headlineZone),
            display: "flex",
            alignItems: "flex-start",
            p: "4%",
          }}
        >
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.2,
              fontFamily: kit.fonts?.heading || "inherit",
            }}
          >
            Protect what matters most
          </Typography>
        </Box>
      )}

      {/* Body */}
      {bodyZone && (
        <Box
          sx={{
            position: "absolute",
            ...scaleZone(bodyZone),
            display: "flex",
            alignItems: "flex-start",
            p: "4%",
          }}
        >
          <Typography
            sx={{
              fontSize: 8,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.4,
              fontFamily: kit.fonts?.body || "inherit",
            }}
          >
            Life coverage starting from $8/month. MAS-regulated.
          </Typography>
        </Box>
      )}

      {/* CTA */}
      <Box
        sx={{
          position: "absolute",
          bottom: "12%",
          right: "6%",
          px: 1.25,
          py: 0.3,
          borderRadius: 9999,
          backgroundColor: "#FFFFFF",
        }}
      >
        <Typography sx={{ fontSize: 7, fontWeight: 600, color: kit.primary_color }}>
          Learn more
        </Typography>
      </Box>

      {/* Disclaimer */}
      {disclaimerZone && (
        <Box
          sx={{
            position: "absolute",
            ...scaleZone(disclaimerZone),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: "3%",
          }}
        >
          <Typography
            sx={{
              fontSize: 5,
              color: "rgba(255,255,255,0.45)",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            This ad has not been reviewed by MAS. Protected by SDIC.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
