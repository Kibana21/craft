"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ProjectPurpose } from "@/types/project";

const PURPOSE_OPTIONS: {
  key: ProjectPurpose;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    key: "product_launch",
    icon: "🚀",
    title: "Product launch",
    description: "New product to market — agents AND customers need content",
  },
  {
    key: "campaign",
    icon: "📣",
    title: "Campaign",
    description: "Promotional push on existing product — time-bound",
  },
  {
    key: "seasonal",
    icon: "🎉",
    title: "Seasonal / occasion",
    description: "Festive, national day, awareness month",
  },
  {
    key: "agent_enablement",
    icon: "📚",
    title: "Agent enablement",
    description: "Training, onboarding, product knowledge — internal only",
  },
];

interface StepPurposeTypeProps {
  value: ProjectPurpose | null;
  onChange: (purpose: ProjectPurpose) => void;
}

export function StepPurposeType({ value, onChange }: StepPurposeTypeProps) {
  return (
    <Box>
      <Typography
        component="h2"
        sx={{ fontSize: "1.75rem", fontWeight: 700, color: "#1F1F1F" }}
      >
        What are we launching?
      </Typography>
      <Typography sx={{ mt: 1, fontSize: "1rem", color: "#5F6368" }}>
        This sets the context for every artifact you'll create in this project
      </Typography>

      <Box
        sx={{
          mt: 5,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 3,
        }}
      >
        {PURPOSE_OPTIONS.map((option) => {
          const isSelected = value === option.key;

          return (
            <Box
              key={option.key}
              component="button"
              onClick={() => onChange(option.key)}
              sx={{
                borderRadius: "16px",
                border: `2px solid ${isSelected ? "#D0103A" : "#EBEBEB"}`,
                bgcolor: isSelected ? "#FFF0F3" : "#FFFFFF",
                p: 4,
                textAlign: "left",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                "&:hover": {
                  borderColor: isSelected ? "#D0103A" : "#DDDDDD",
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
                },
              }}
            >
              <Typography sx={{ fontSize: "2.25rem", lineHeight: 1 }}>
                {option.icon}
              </Typography>
              <Typography
                component="h3"
                sx={{
                  mt: 2,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: isSelected ? "#D0103A" : "#1F1F1F",
                }}
              >
                {option.title}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: "0.875rem", color: "#5F6368" }}>
                {option.description}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
