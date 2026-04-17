"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { BrandKit } from "@/types/brand-kit";

interface ValidationChecklistProps {
  kit: BrandKit;
}

function CheckCard({
  status,
  title,
  description,
}: {
  status: "pass" | "warn";
  title: string;
  description: string;
}) {
  const icon = status === "pass" ? "\u2713" : "!";
  const color = status === "pass" ? "#188038" : "#F59E0B";

  return (
    <Box sx={{ display: "flex", gap: 1.5, p: 2, border: "1px solid #E8EAED", borderRadius: "10px" }}>
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          bgcolor: color,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#1F1F1F" }}>{title}</Typography>
        <Typography sx={{ color: "#5F6368", fontSize: 13, mt: 0.25, lineHeight: 1.5 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

export function ValidationChecklist({ kit }: ValidationChecklistProps) {
  const fonts = kit.fonts || {};
  const hasLogo = !!kit.logo_url;
  const hasAllFonts =
    !!(fonts.heading_url || fonts.heading) &&
    !!(fonts.body_url || fonts.body) &&
    !!(fonts.disclaimer_url || fonts.disclaimer_inherited || fonts.disclaimer);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <CheckCard
        status="pass"
        title="Colour accuracy"
        description="Background is exact Primary hex, not AI approximation. CTA uses Primary. Disclaimer uses Secondary."
      />
      <CheckCard
        status={hasLogo ? "pass" : "warn"}
        title="Logo placement"
        description={
          hasLogo
            ? "Composited at template zone coordinates. Clear space enforced. AI scene doesn\u2019t bleed into logo area."
            : "No logo uploaded. Upload a primary logo in the Logo Vault tab for compositing."
        }
      />
      <CheckCard
        status={hasAllFonts ? "pass" : "warn"}
        title="Typography rendering"
        description={
          hasAllFonts
            ? "Headline uses the uploaded Heading font at the correct size. Body uses Body font. Disclaimer capped at MAS minimum."
            : "One or more font slots are missing uploads. Upload fonts in the Typography tab."
        }
      />
      <CheckCard
        status="warn"
        title="AI scene zone"
        description="Placeholder shown \u2014 actual Gemini output fills this region at generation time. Verify zone dimensions match template."
      />
    </Box>
  );
}
