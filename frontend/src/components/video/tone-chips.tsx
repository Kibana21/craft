"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import type { RewriteTone } from "@/types/video-script";

const TONES: { value: RewriteTone; label: string }[] = [
  { value: "warm", label: "Warm & Personal" },
  { value: "professional", label: "More Professional" },
  { value: "shorter", label: "Shorter" },
  { value: "stronger_cta", label: "Stronger CTA" },
];

interface ToneChipsProps {
  onRewrite: (tone: RewriteTone) => Promise<void>;
}

export function ToneChips({ onRewrite }: ToneChipsProps) {
  const [loadingTone, setLoadingTone] = useState<RewriteTone | null>(null);
  const [errors, setErrors] = useState<Partial<Record<RewriteTone, string>>>({});

  const handleClick = async (tone: RewriteTone) => {
    setLoadingTone(tone);
    setErrors((prev) => ({ ...prev, [tone]: undefined }));
    try {
      await onRewrite(tone);
    } catch {
      setErrors((prev) => ({ ...prev, [tone]: "Rewrite failed. Try again." }));
    } finally {
      setLoadingTone(null);
    }
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Rewrite tone
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {TONES.map(({ value, label }) => {
          const isLoading = loadingTone === value;
          const error = errors[value];
          return (
            <Box key={value}>
              <Button
                variant="outlined"
                size="small"
                disabled={loadingTone !== null}
                onClick={() => handleClick(value)}
                startIcon={isLoading ? <CircularProgress size={12} /> : undefined}
                sx={{
                  borderColor: "#E5E5E5",
                  color: "#222222",
                  textTransform: "none",
                  fontSize: "0.8rem",
                  borderRadius: 999,
                  px: 2,
                  "&:hover": { borderColor: "#ABABAB", bgcolor: "transparent" },
                  "&:disabled": { color: "#ABABAB", borderColor: "#E5E5E5" },
                }}
              >
                {isLoading ? "Rewriting…" : label}
              </Button>
              {error && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: "block", mt: 0.25, fontSize: "0.7rem" }}
                >
                  {error}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
