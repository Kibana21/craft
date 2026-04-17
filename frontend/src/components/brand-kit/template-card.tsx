"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { BrandKitTemplate, TemplateZone } from "@/types/brand-kit";

const ZONE_COLORS: Record<string, string> = {
  creative: "#4A90D9",
  logo: "#D0103A",
  headline: "#188038",
  body: "#F5A623",
  disclaimer: "#9E9E9E",
};

const ZONE_LABELS: Record<string, string> = {
  creative: "SCENE",
  logo: "LOGO",
  headline: "HEAD",
  body: "BODY",
  disclaimer: "DISC",
};

const BASE = 1080;

interface TemplateCardProps {
  template: BrandKitTemplate;
  isSelected: boolean;
  onClick: () => void;
}

function ZoneRect({ zone }: { zone: TemplateZone }) {
  const color = ZONE_COLORS[zone.name] || "#CCC";
  const label = ZONE_LABELS[zone.name] || zone.name;

  return (
    <Box
      sx={{
        position: "absolute",
        left: `${(zone.x / BASE) * 100}%`,
        top: `${(zone.y / BASE) * 100}%`,
        width: `${(zone.width / BASE) * 100}%`,
        height: `${(zone.height / BASE) * 100}%`,
        backgroundColor: color,
        opacity: 0.75,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Typography
        sx={{
          fontSize: 8,
          fontWeight: 700,
          color: "#FFFFFF",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        border: isSelected ? "2px solid #D0103A" : "1px solid #E8EAED",
        borderRadius: "12px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s",
        "&:hover": { borderColor: isSelected ? "#D0103A" : "#DADCE0" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          backgroundColor: "#F0F0F0",
        }}
      >
        {template.zones.map((zone) => (
          <ZoneRect key={zone.name} zone={zone} />
        ))}
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#1F1F1F", mb: 0.75 }}>
          {template.name}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {template.zones.map((z) => (
            <Box
              key={z.name}
              sx={{
                px: 0.75,
                py: 0.15,
                borderRadius: 9999,
                backgroundColor: "#F7F7F7",
                fontSize: 9,
                color: "#5F6368",
              }}
            >
              {z.name}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
