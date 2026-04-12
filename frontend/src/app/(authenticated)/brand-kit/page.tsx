"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useAuth } from "@/components/providers/auth-provider";
import { BrandPreview } from "@/components/brand-kit/brand-preview";
import { ColorPicker } from "@/components/brand-kit/color-picker";
import { FontUpload } from "@/components/brand-kit/font-upload";
import { LogoUpload } from "@/components/brand-kit/logo-upload";
import {
  fetchBrandKit,
  updateBrandKit,
  uploadFont,
  uploadLogo,
} from "@/lib/api/brand-kit";
import type { BrandKit } from "@/types/brand-kit";

export default function BrandKitPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [kit, setKit] = useState<BrandKit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local edits (colors only — logos/fonts save immediately on upload)
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    fetchBrandKit()
      .then((data) => {
        setKit(data);
        setPrimaryColor(data.primary_color);
        setSecondaryColor(data.secondary_color);
        setAccentColor(data.accent_color);
      })
      .catch(() => setError("Failed to load brand kit"))
      .finally(() => setIsLoading(false));
  }, []);

  // Live preview — merge local edits into kit object
  const previewKit: BrandKit | null = kit
    ? {
        ...kit,
        primary_color: primaryColor || kit.primary_color,
        secondary_color: secondaryColor || kit.secondary_color,
        accent_color: accentColor || kit.accent_color,
      }
    : null;

  const hasColorChanges =
    kit &&
    (primaryColor !== kit.primary_color ||
      secondaryColor !== kit.secondary_color ||
      accentColor !== kit.accent_color);

  async function handleSaveColors() {
    if (!hasColorChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateBrandKit({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
      });
      setKit(updated);
      setSavedAt(new Date());
    } catch {
      setError("Failed to save colors");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoUpload(file: File, variant: "primary" | "secondary") {
    setError(null);
    try {
      const updated = await uploadLogo(file, variant);
      setKit(updated);
      setSavedAt(new Date());
    } catch {
      setError("Failed to upload logo");
    }
  }

  async function handleFontUpload(file: File, slot: "heading" | "body" | "accent") {
    setError(null);
    try {
      const updated = await uploadFont(file, slot);
      setKit(updated);
      setSavedAt(new Date());
    } catch {
      setError("Failed to upload font");
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                height: 80,
                borderRadius: "12px",
                backgroundColor: "#F7F7F7",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.4 },
                },
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  if (!kit || !previewKit) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
        <Typography sx={{ fontSize: 14, color: "#717171" }}>
          Brand kit not available.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          mb: 5,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{ fontSize: 28, fontWeight: 700, color: "#1F1F1F" }}
          >
            Brand Kit
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 16, color: "#5F6368" }}>
            {isAdmin
              ? "Manage AIA brand assets — logos, colors, and typography"
              : "View the current AIA brand kit used across all content"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
          <Box
            component="span"
            sx={{
              borderRadius: 9999,
              backgroundColor: "#F7F7F7",
              px: 1.5,
              py: 0.5,
              fontSize: 12,
              color: "#717171",
            }}
          >
            Version {kit.version}
          </Box>
          {savedAt && (
            <Typography sx={{ fontSize: 12, color: "#1B9D74" }}>
              Saved {savedAt.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>

      {error && (
        <Box
          sx={{
            mb: 3,
            borderRadius: "12px",
            backgroundColor: "#FFF0F3",
            px: 2,
            py: 1.5,
            fontSize: 14,
            color: "#D0103A",
          }}
        >
          {error}
        </Box>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 280px" },
          gap: 4,
        }}
      >
        {/* Left: settings */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {/* Logos */}
          <Box component="section">
            <Typography
              component="h2"
              sx={{ mb: 2.5, fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}
            >
              Logos
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2.5,
              }}
            >
              <LogoUpload
                label="Primary logo"
                currentUrl={kit.logo_url}
                onUpload={(file) => handleLogoUpload(file, "primary")}
                disabled={!isAdmin}
              />
              <LogoUpload
                label="Secondary logo (optional)"
                currentUrl={kit.secondary_logo_url}
                onUpload={(file) => handleLogoUpload(file, "secondary")}
                disabled={!isAdmin}
              />
            </Box>
          </Box>

          {/* Colors */}
          <Box component="section">
            <Typography
              component="h2"
              sx={{ mb: 2.5, fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}
            >
              Brand colors
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2.5,
              }}
            >
              <ColorPicker
                label="Primary"
                value={primaryColor}
                onChange={setPrimaryColor}
                disabled={!isAdmin}
              />
              <ColorPicker
                label="Secondary"
                value={secondaryColor}
                onChange={setSecondaryColor}
                disabled={!isAdmin}
              />
              <ColorPicker
                label="Accent"
                value={accentColor}
                onChange={setAccentColor}
                disabled={!isAdmin}
              />
            </Box>
            {isAdmin && (
              <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Button
                  onClick={handleSaveColors}
                  disabled={!hasColorChanges || isSaving}
                  disableElevation
                  variant="contained"
                  sx={{
                    borderRadius: 9999,
                    textTransform: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    px: 2.5,
                    py: 1.25,
                    backgroundColor: "#D0103A",
                    "&:hover": { backgroundColor: "#B80E33" },
                    "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
                  }}
                >
                  {isSaving ? "Saving…" : "Save colors"}
                </Button>
                {hasColorChanges && (
                  <Button
                    onClick={() => {
                      setPrimaryColor(kit.primary_color);
                      setSecondaryColor(kit.secondary_color);
                      setAccentColor(kit.accent_color);
                    }}
                    variant="text"
                    disableElevation
                    sx={{
                      borderRadius: 9999,
                      textTransform: "none",
                      fontSize: 14,
                      color: "#717171",
                      "&:hover": { color: "#1F1F1F", backgroundColor: "transparent" },
                    }}
                  >
                    Discard changes
                  </Button>
                )}
              </Box>
            )}
          </Box>

          {/* Fonts */}
          <Box component="section">
            <Typography
              component="h2"
              sx={{ mb: 2.5, fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}
            >
              Typography
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {(["heading", "body", "accent"] as const).map((slot) => (
                <FontUpload
                  key={slot}
                  slot={slot}
                  currentFontName={kit.fonts?.[slot]}
                  onUpload={(file) => handleFontUpload(file, slot)}
                  disabled={!isAdmin}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Right: live preview */}
        <Box sx={{ position: { lg: "sticky" }, top: { lg: 96 }, alignSelf: { lg: "flex-start" } }}>
          <BrandPreview brandKit={previewKit} />
        </Box>
      </Box>
    </Box>
  );
}
