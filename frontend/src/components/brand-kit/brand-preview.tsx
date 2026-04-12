"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { BrandKit } from "@/types/brand-kit";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BrandPreviewProps {
  brandKit: BrandKit;
}

export function BrandPreview({ brandKit }: BrandPreviewProps) {
  const logoUrl = brandKit.logo_url
    ? brandKit.logo_url.startsWith("http")
      ? brandKit.logo_url
      : `${API_BASE}${brandKit.logo_url}`
    : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography
        sx={{ fontSize: 14, fontWeight: 600, color: "#484848" }}
      >
        Live Preview
      </Typography>

      {/* Poster mockup */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          background: `linear-gradient(160deg, ${brandKit.secondary_color} 0%, ${brandKit.primary_color}88 100%)`,
          aspectRatio: "9 / 16",
          maxHeight: 460,
        }}
      >
        {/* Background texture */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.1,
            backgroundImage: `radial-gradient(circle at 30% 40%, ${brandKit.accent_color} 0%, transparent 60%)`,
          }}
        />

        {/* Logo */}
        <Box sx={{ position: "absolute", top: 16, right: 16 }}>
          {logoUrl ? (
            <Box
              component="img"
              src={logoUrl}
              alt="Brand logo"
              sx={{ height: 32, width: "auto", maxWidth: 80, objectFit: "contain" }}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                px: 1,
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                opacity: 0.8,
                backgroundColor: brandKit.primary_color,
              }}
            >
              LOGO
            </Box>
          )}
        </Box>

        {/* Content area */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            p: 3,
          }}
        >
          {/* Color accent bar */}
          <Box
            sx={{
              mb: 2,
              height: 4,
              width: 48,
              borderRadius: 9999,
              backgroundColor: brandKit.accent_color,
            }}
          />

          {/* Headline */}
          <Typography
            component="h2"
            sx={{
              mb: 1,
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.25,
              color: "#fff",
              fontFamily: brandKit.fonts?.heading,
            }}
          >
            Protect what matters most
          </Typography>

          {/* Tagline */}
          <Typography
            sx={{
              mb: 2,
              fontSize: 14,
              color: "rgba(255,255,255,0.8)",
              fontFamily: brandKit.fonts?.body,
            }}
          >
            AIA HealthShield — comprehensive coverage for you and your family.
          </Typography>

          {/* CTA */}
          <Box
            component="span"
            sx={{
              display: "inline-block",
              borderRadius: 9999,
              px: 2,
              py: 0.75,
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              backgroundColor: brandKit.accent_color,
            }}
          >
            Learn more →
          </Box>

          {/* Disclaimer */}
          <Typography
            sx={{ mt: 2, fontSize: 9, color: "rgba(255,255,255,0.4)" }}
          >
            This advertisement has not been reviewed by the Monetary Authority of Singapore.
          </Typography>
        </Box>

        {/* Version badge */}
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            borderRadius: 9999,
            backgroundColor: "rgba(0,0,0,0.3)",
            px: 1,
            py: 0.25,
            fontSize: 10,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          v{brandKit.version}
        </Box>
      </Box>

      {/* Color swatches */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {[
          { label: "Primary", color: brandKit.primary_color },
          { label: "Secondary", color: brandKit.secondary_color },
          { label: "Accent", color: brandKit.accent_color },
        ].map(({ label, color }) => (
          <Box
            key={label}
            sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}
          >
            <Box
              sx={{
                height: 32,
                width: 32,
                borderRadius: "50%",
                border: "1px solid #DDDDDD",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                backgroundColor: color,
              }}
            />
            <Typography sx={{ fontSize: 10, color: "#717171" }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
