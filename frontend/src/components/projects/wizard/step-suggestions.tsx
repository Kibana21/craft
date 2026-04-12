"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ProjectPurpose } from "@/types/project";

const TYPE_ICONS: Record<string, string> = {
  video:         "▶",
  poster:        "◻",
  whatsapp_card: "✉",
  reel:          "▶",
  story:         "◻",
  infographic:   "📊",
  slide_deck:    "📋",
};

const TYPE_BG: Record<string, string> = {
  video:         "#059669",
  poster:        "#7c3aed",
  whatsapp_card: "#dc2626",
  reel:          "#059669",
  story:         "#d97706",
  infographic:   "#0891b2",
  slide_deck:    "#334155",
};

const AUDIENCE_LABELS: Record<string, { text: string; bg: string; color: string }> = {
  internal: { text: "Internal", bg: "#F1F3F4", color: "#5F6368" },
  external: { text: "External", bg: "#EFF6FF", color: "#1d4ed8" },
  both:     { text: "Both",     bg: "#F5F3FF", color: "#6d28d9" },
};

const PURPOSE_LABELS: Record<string, string> = {
  product_launch:   "a product launch",
  campaign:         "a campaign",
  seasonal:         "a seasonal occasion",
  agent_enablement: "agent enablement",
};

interface Suggestion {
  type: string;
  name: string;
  description: string;
  audience: string;
  selected: boolean;
}

interface StepSuggestionsProps {
  purpose: ProjectPurpose;
  suggestions: Suggestion[];
  onToggle: (index: number) => void;
}

export function StepSuggestions({ purpose, suggestions, onToggle }: StepSuggestionsProps) {
  const selectedCount = suggestions.filter((s) => s.selected).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 18, fontWeight: 600, color: "#1F1F1F" }}>
            CRAFT suggests
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 13, color: "#9E9E9E" }}>
            Artifacts for {PURPOSE_LABELS[purpose] || "your project"} · select what you need
          </Typography>
        </Box>
        <Typography sx={{ flexShrink: 0, fontSize: 13, fontWeight: 500, color: "#5F6368" }}>
          {selectedCount} of {suggestions.length} selected
        </Typography>
      </Box>

      {/* Suggestion rows */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {suggestions.map((suggestion, index) => {
          const icon     = TYPE_ICONS[suggestion.type] || "◻";
          const bgColor  = TYPE_BG[suggestion.type] || "#7c3aed";
          const audience = AUDIENCE_LABELS[suggestion.audience] || AUDIENCE_LABELS.external;

          return (
            <Box
              key={index}
              component="button"
              onClick={() => onToggle(index)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                borderRadius: "12px",
                border: suggestion.selected ? "1px solid #D0103A" : "1px solid #E8EAED",
                bgcolor: suggestion.selected ? "#FFF8F9" : "#FFFFFF",
                px: 1.75,
                py: 1.25,
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
                transition: "all 0.15s",
                "&:hover": suggestion.selected
                  ? {}
                  : { borderColor: "#DADCE0", bgcolor: "#F8F9FA" },
              }}
            >
              {/* Checkbox */}
              <Box
                sx={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "4px",
                  border: suggestion.selected ? "none" : "1px solid #DADCE0",
                  bgcolor: suggestion.selected ? "#D0103A" : "#FFFFFF",
                  color: "#FFFFFF",
                  transition: "all 0.15s",
                }}
              >
                {suggestion.selected && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Box>

              {/* Type icon badge */}
              <Box
                sx={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "8px",
                  bgcolor: bgColor,
                  color: "#FFFFFF",
                  fontSize: 14,
                }}
              >
                {icon}
              </Box>

              {/* Name + description */}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  noWrap
                  sx={{ fontSize: 13, fontWeight: 500, color: "#1F1F1F" }}
                >
                  {suggestion.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: 12, color: "#9E9E9E" }}>
                  {suggestion.description}
                </Typography>
              </Box>

              {/* Audience badge */}
              <Box
                sx={{
                  flexShrink: 0,
                  borderRadius: 9999,
                  px: 1.25,
                  py: 0.25,
                  bgcolor: audience.bg,
                  color: audience.color,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {audience.text}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
