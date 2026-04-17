"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ColourCard } from "../colour-card";
import { ContrastPairing } from "../contrast-pairing";
import type { BrandKit, ColorNames, ZoneRoles, ZoneColorRole } from "@/types/brand-kit";

interface ColoursTabProps {
  kit: BrandKit;
  draftColors: { primary: string; secondary: string; accent: string };
  draftColorNames: ColorNames;
  draftZoneRoles: ZoneRoles;
  isAdmin: boolean;
  onColorChange: (role: "primary" | "secondary" | "accent", hex: string) => void;
  onColorNameChange: (field: keyof ColorNames, value: string) => void;
  onZoneRoleChange: (zone: keyof ZoneRoles, role: ZoneColorRole) => void;
}

const GUIDANCE_BULLETS = [
  "AI generation receives mood direction only — not hex codes",
  "Exact hex values applied by the compositing layer after generation",
  "Derived tints used as overlay washes on AI-generated scenes",
  "Primary colour feeds poster background; accent feeds CTA button fill",
];

const ZONE_ROWS: { label: string; key: keyof ZoneRoles }[] = [
  { label: "Poster background", key: "poster_background" },
  { label: "CTA button fill",   key: "cta_fill" },
  { label: "Disclaimer strip",  key: "disclaimer_strip" },
  { label: "Badge / callout",   key: "badge_callout" },
  { label: "Headline text",     key: "headline_text" },
];

const ROLE_OPTIONS: { value: ZoneColorRole; label: string }[] = [
  { value: "primary",   label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent",    label: "Accent" },
  { value: "white",     label: "White" },
];

export function ColoursTab({
  kit,
  draftColors,
  draftColorNames,
  draftZoneRoles,
  isAdmin,
  onColorChange,
  onColorNameChange,
  onZoneRoleChange,
}: ColoursTabProps) {
  const cn = draftColorNames;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, gap: 4 }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <ColourCard
          role="primary"
          hex={draftColors.primary}
          name={cn.primary_name || ""}
          usage={cn.primary_usage || ""}
          isAdmin={isAdmin}
          showTints
          onHexChange={(hex) => onColorChange("primary", hex)}
          onNameChange={(v) => onColorNameChange("primary_name", v)}
          onUsageChange={(v) => onColorNameChange("primary_usage", v)}
        />
        <ColourCard
          role="secondary"
          hex={draftColors.secondary}
          name={cn.secondary_name || ""}
          usage={cn.secondary_usage || ""}
          isAdmin={isAdmin}
          onHexChange={(hex) => onColorChange("secondary", hex)}
          onNameChange={(v) => onColorNameChange("secondary_name", v)}
          onUsageChange={(v) => onColorNameChange("secondary_usage", v)}
        />
        <ColourCard
          role="accent"
          hex={draftColors.accent}
          name={cn.accent_name || ""}
          usage={cn.accent_usage || ""}
          isAdmin={isAdmin}
          onHexChange={(hex) => onColorChange("accent", hex)}
          onNameChange={(v) => onColorNameChange("accent_name", v)}
          onUsageChange={(v) => onColorNameChange("accent_usage", v)}
        />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* Zone → Colour assignment table */}
        <Box sx={{ border: "1px solid #E8EAED", borderRadius: "12px", overflow: "hidden" }}>
          <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: "1px solid #E8EAED", backgroundColor: "#F7F7F7" }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
              Zone colour assignments
            </Typography>
          </Box>
          {/* Read-mode: compact table with header */}
          {!isAdmin && (
            <Box sx={{ px: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: "1px solid #F0F0F0" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Zone role
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Colour
                </Typography>
              </Box>
              {ZONE_ROWS.map(({ label, key }, i) => {
                const role: ZoneColorRole = draftZoneRoles[key] ?? "primary";
                const swatchColor =
                  role === "primary"   ? draftColors.primary :
                  role === "secondary" ? draftColors.secondary :
                  role === "accent"    ? draftColors.accent :
                  "#FFFFFF";
                return (
                  <Box
                    key={key}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.25,
                      borderBottom: i < ZONE_ROWS.length - 1 ? "1px solid #F0F0F0" : "none",
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: "#1F1F1F" }}>{label}</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: swatchColor,
                          border: role === "white" ? "1px solid #E8EAED" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontSize: 13, color: "#5F6368" }}>
                        {ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Edit-mode: stacked label + pill row per zone */}
          {isAdmin && (
            <Box sx={{ px: 2.5, py: 1 }}>
              {ZONE_ROWS.map(({ label, key }, i) => {
                const role: ZoneColorRole = draftZoneRoles[key] ?? "primary";
                return (
                  <Box
                    key={key}
                    sx={{
                      py: 1.25,
                      borderBottom: i < ZONE_ROWS.length - 1 ? "1px solid #F0F0F0" : "none",
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: "#5F6368", mb: 0.75 }}>{label}</Typography>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {ROLE_OPTIONS.map((opt) => {
                        const isSelected = role === opt.value;
                        const optSwatch =
                          opt.value === "primary"   ? draftColors.primary :
                          opt.value === "secondary" ? draftColors.secondary :
                          opt.value === "accent"    ? draftColors.accent :
                          "#FFFFFF";
                        return (
                          <Box
                            key={opt.value}
                            component="button"
                            onClick={() => onZoneRoleChange(key, opt.value)}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              px: 1.25,
                              py: 0.4,
                              borderRadius: 9999,
                              border: "1.5px solid",
                              borderColor: isSelected ? "#1F1F1F" : "#E8EAED",
                              backgroundColor: isSelected ? "#1F1F1F" : "#FFFFFF",
                              color: isSelected ? "#FFFFFF" : "#5F6368",
                              fontSize: 12,
                              fontWeight: isSelected ? 600 : 400,
                              cursor: "pointer",
                              transition: "all 0.1s",
                              "&:hover": { borderColor: "#1F1F1F", color: isSelected ? "#FFFFFF" : "#1F1F1F" },
                            }}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: optSwatch,
                                border: opt.value === "white" ? "1px solid #DADCE0" : "none",
                                flexShrink: 0,
                              }}
                            />
                            {opt.label}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Box
          sx={{
            border: "1px solid #E8EAED",
            borderRadius: "12px",
            p: 2.5,
            backgroundColor: "#F7F7F7",
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5 }}>
            How these colours are applied
          </Typography>
          {GUIDANCE_BULLETS.map((b) => (
            <Box key={b} sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#5F6368", mt: 0.8, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: "#5F6368", lineHeight: 1.5 }}>{b}</Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            border: "1px solid #E8EAED",
            borderRadius: "12px",
            p: 2.5,
            backgroundColor: "#F7F7F7",
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5 }}>
            Text on brand colours
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <ContrastPairing
              bgColor={draftColors.primary}
              textColor="#FFFFFF"
              label="White text on Primary — headlines, CTAs"
            />
            <ContrastPairing
              bgColor={draftColors.secondary}
              textColor="#FFFFFF"
              label="White text on Secondary — body copy"
            />
            <ContrastPairing
              bgColor={draftColors.accent}
              textColor="#1F1F1F"
              label="Dark text on Accent — badges only"
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
