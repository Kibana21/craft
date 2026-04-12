"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { ToneSelector } from "../tone-selector";
import { FormatSelector } from "../format-selector";
import { TaglineGenerator } from "../tagline-generator";

interface PosterCreatorProps {
  product: string;
  audience: string;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function PosterCreator({ product, audience, onSave, isSaving }: PosterCreatorProps) {
  const [headline, setHeadline] = useState("");
  const [tone, setTone] = useState("professional");
  const [format, setFormat] = useState("1:1");

  const handleSave = () => {
    onSave({
      headline,
      product,
      tone,
      format,
      type: "poster",
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <TaglineGenerator
        product={product}
        audience={audience}
        tone={tone}
        value={headline}
        onChange={setHeadline}
      />

      <ToneSelector value={tone} onChange={setTone} />

      <FormatSelector
        value={format}
        onChange={setFormat}
        options={["1:1", "4:5", "9:16"]}
      />

      {/* Preview placeholder */}
      <Box
        sx={{
          overflow: "hidden",
          borderRadius: "12px",
          border: "1px solid #EBEBEB",
          background: "linear-gradient(135deg, #dc2626, #ef4444)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 256,
            p: 4,
            textAlign: "center",
            color: "#FFFFFF",
          }}
        >
          <Typography sx={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6 }}>
            Preview
          </Typography>
          <Typography sx={{ mt: 2, fontSize: "20px", fontWeight: 700 }}>
            {headline || "Your headline here"}
          </Typography>
          <Typography sx={{ mt: 1, fontSize: "14px", opacity: 0.7 }}>{product}</Typography>
          <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
            <Box sx={{ borderRadius: 9999, bgcolor: "rgba(255,255,255,0.2)", px: 1.5, py: 0.5 }}>
              <Typography sx={{ fontSize: "12px", color: "#FFFFFF" }}>{tone}</Typography>
            </Box>
            <Box sx={{ borderRadius: 9999, bgcolor: "rgba(255,255,255,0.2)", px: 1.5, py: 0.5 }}>
              <Typography sx={{ fontSize: "12px", color: "#FFFFFF" }}>{format}</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleSave}
        disabled={isSaving || !headline.trim()}
        sx={{
          borderRadius: 9999,
          textTransform: "none",
          bgcolor: "#D0103A",
          color: "#FFFFFF",
          fontSize: "16px",
          fontWeight: 600,
          py: 1.5,
          "&:hover": { bgcolor: "#B80E33" },
          "&:disabled": { opacity: 0.4, bgcolor: "#D0103A", color: "#FFFFFF", cursor: "not-allowed" },
        }}
      >
        {isSaving ? "Creating artifact..." : "Create poster"}
      </Button>
    </Box>
  );
}
