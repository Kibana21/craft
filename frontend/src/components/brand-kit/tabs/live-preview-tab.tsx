"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { fetchTemplates } from "@/lib/api/brand-kit";
import { queryKeys } from "@/lib/query-keys";
import { PreviewCanvas } from "../preview-canvas";
import { ValidationChecklist } from "../validation-checklist";
import type { BrandKit } from "@/types/brand-kit";

interface LivePreviewTabProps {
  kit: BrandKit;
}

export function LivePreviewTab({ kit }: LivePreviewTabProps) {
  const templatesQuery = useQuery({
    queryKey: queryKeys.brandKitTemplates(),
    queryFn: fetchTemplates,
  });

  const templates = templatesQuery.data ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedTemplate = templates[selectedIdx] ?? null;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "280px 1fr" }, gap: 4 }}>
      {/* Left — canvas */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <PreviewCanvas kit={kit} template={selectedTemplate} />

        {/* Template switcher */}
        {templates.length > 1 && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "center" }}>
            {templates.map((t, i) => (
              <Box
                key={t.id}
                component="button"
                onClick={() => setSelectedIdx(i)}
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 9999,
                  border: "1px solid",
                  borderColor: i === selectedIdx ? "#D0103A" : "#E8EAED",
                  backgroundColor: i === selectedIdx ? "#FFF1F4" : "transparent",
                  color: i === selectedIdx ? "#D0103A" : "#5F6368",
                  fontSize: 10,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  "&:hover": { borderColor: "#D0103A" },
                }}
              >
                {t.name}
              </Box>
            ))}
          </Box>
        )}

        <Typography sx={{ fontSize: 11, color: "#9E9E9E", textAlign: "center", maxWidth: 260 }}>
          Live render using active kit. AI scene zone shows where Gemini-generated imagery will be placed. All other elements are composited from Brand Kit values.
        </Typography>
      </Box>

      {/* Right — validation */}
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F", mb: 2 }}>
          What this preview validates
        </Typography>
        <ValidationChecklist kit={kit} />
      </Box>
    </Box>
  );
}
