"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import { createProject } from "@/lib/api/projects";

const QUICK_CREATE_OPTIONS = [
  { label: "Poster", icon: "◻", type: "poster" },
  { label: "WhatsApp", icon: "✉", type: "whatsapp_card" },
  { label: "Reel", icon: "▶", type: "reel" },
  { label: "Card", icon: "📋", type: "story" },
];

export function QuickCreateStrip() {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  const handleQuickCreate = async (artifactType: string) => {
    setCreating(artifactType);
    try {
      const now = new Date();
      const month = now.toLocaleString("default", { month: "short" });
      const project = await createProject({
        name: `Quick ${artifactType.replace("_", " ")} — ${month} ${now.getFullYear()}`,
        type: "personal",
        purpose: "campaign",
      });
      router.push(`/projects/${project.id}/artifacts/new?type=${artifactType}`);
    } catch {
      setCreating(null);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        borderBottom: "1px solid #EBEBEB",
        px: 3,
        py: 3,
      }}
    >
      <Box sx={{ mx: "auto", maxWidth: "48rem" }}>
        <Typography
          sx={{
            mb: 2,
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#717171",
          }}
        >
          Quick create
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {QUICK_CREATE_OPTIONS.map((option) => (
            <ButtonBase
              key={option.type}
              onClick={() => handleQuickCreate(option.type)}
              disabled={creating !== null}
              sx={{
                flex: 1,
                borderRadius: "12px",
                border: "1px solid #E8E8E8",
                bgcolor: "#FFFFFF",
                px: 2,
                py: 1.5,
                textAlign: "center",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#222222",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: "#D0103A",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                },
                "&:disabled": {
                  opacity: 0.5,
                },
              }}
            >
              {creating === option.type ? "Creating..." : `${option.icon} ${option.label}`}
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
