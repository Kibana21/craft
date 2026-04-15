"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import { generateTaglines } from "@/lib/api/ai";
import { AiAssistChip } from "@/components/poster-wizard/shared/ai-assist-chip";

interface TaglineGeneratorProps {
  product: string;
  audience: string;
  tone: string;
  value: string;
  onChange: (tagline: string) => void;
}

export function TaglineGenerator({
  product,
  audience,
  tone,
  value,
  onChange,
}: TaglineGeneratorProps) {
  const [taglines, setTaglines] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const results = await generateTaglines(product, audience, tone);
      setTaglines(results);
    } catch {
      // Fallback handled by backend
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography
          component="label"
          sx={{ fontSize: "14px", fontWeight: 500, color: "#484848" }}
        >
          Headline / Tagline
        </Typography>
        <AiAssistChip onClick={handleGenerate} loading={isGenerating}>
          {isGenerating ? "Generating…" : "+ AI taglines"}
        </AiAssistChip>
      </Box>

      <TextField
        fullWidth
        size="small"
        variant="outlined"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a headline or generate with AI"
        sx={{
          mb: 1.5,
          "& .MuiOutlinedInput-root": {
            borderRadius: "10px",
            fontSize: "16px",
            color: "#222222",
            "& fieldset": { borderColor: "#DDDDDD" },
            "&:hover fieldset": { borderColor: "#BBBBBB" },
            "&.Mui-focused fieldset": {
              borderColor: "#D0103A",
              boxShadow: "0 0 0 3px rgba(208,16,58,0.08)",
            },
          },
          "& input::placeholder": { color: "#B0B0B0", opacity: 1 },
        }}
      />

      {taglines.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {taglines.map((tagline, i) => (
            <ButtonBase
              key={i}
              onClick={() => onChange(tagline)}
              sx={{
                borderRadius: 9999,
                px: 2,
                py: 1,
                fontSize: "14px",
                border: "1px solid",
                transition: "all 0.2s",
                ...(value === tagline
                  ? {
                      bgcolor: "#222222",
                      color: "#FFFFFF",
                      borderColor: "#222222",
                    }
                  : {
                      bgcolor: "#FFFFFF",
                      color: "#484848",
                      borderColor: "#DDDDDD",
                      "&:hover": { borderColor: "#222222" },
                    }),
              }}
            >
              {tagline}
            </ButtonBase>
          ))}
        </Box>
      )}
    </Box>
  );
}
