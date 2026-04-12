"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import { ToneSelector } from "../tone-selector";
import { generateStoryboard } from "@/lib/api/ai";
import type { StoryboardFrame } from "@/types/ai";

interface ReelCreatorProps {
  product: string;
  audience: string;
  keyMessage: string;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

const FRAME_GRADIENTS = [
  "linear-gradient(135deg, #dc2626, #f43f5e)",
  "linear-gradient(135deg, #7c3aed, #a855f7)",
  "linear-gradient(135deg, #059669, #14b8a6)",
  "linear-gradient(135deg, #d97706, #f97316)",
  "linear-gradient(135deg, #0891b2, #3b82f6)",
  "linear-gradient(135deg, #475569, #64748b)",
];

export function ReelCreator({ product, audience, keyMessage, onSave, isSaving }: ReelCreatorProps) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("inspirational");
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFrame, setActiveFrame] = useState(0);

  const handleGenerateStoryboard = async () => {
    setIsGenerating(true);
    try {
      const result = await generateStoryboard(
        topic || product,
        keyMessage || "Protect what matters",
        product,
        tone
      );
      setFrames(result.frames);
    } catch {
      // Fallback handled
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    onSave({
      topic,
      product,
      tone,
      frames,
      format: "9:16",
      type: "reel",
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography
          component="label"
          sx={{ display: "block", mb: 1, fontSize: "14px", fontWeight: 500, color: "#484848" }}
        >
          Topic
        </Typography>
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Family protection, Health coverage"
          sx={{
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
      </Box>

      <ToneSelector value={tone} onChange={setTone} />

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleGenerateStoryboard}
        disabled={isGenerating}
        sx={{
          borderRadius: 9999,
          textTransform: "none",
          bgcolor: "#222222",
          color: "#FFFFFF",
          fontSize: "16px",
          fontWeight: 600,
          py: 1.5,
          "&:hover": { bgcolor: "#484848" },
          "&:disabled": { opacity: 0.5, bgcolor: "#222222", color: "#FFFFFF" },
        }}
      >
        {isGenerating ? "Generating storyboard..." : "✨ Generate storyboard"}
      </Button>

      {/* Storyboard preview */}
      {frames.length > 0 && (
        <Box>
          <Typography sx={{ mb: 1.5, fontSize: "14px", fontWeight: 600, color: "#484848" }}>
            Storyboard — {frames.length} frames
          </Typography>

          {/* Frame timeline */}
          <Box sx={{ mb: 2, display: "flex", gap: 1 }}>
            {frames.map((frame, i) => (
              <ButtonBase
                key={i}
                onClick={() => setActiveFrame(i)}
                sx={{
                  flex: 1,
                  borderRadius: "8px",
                  p: 1,
                  textAlign: "center",
                  fontSize: "12px",
                  transition: "all 0.15s",
                  ...(i === activeFrame
                    ? { bgcolor: "#222222", color: "#FFFFFF" }
                    : {
                        bgcolor: "#F7F7F7",
                        color: "#717171",
                        "&:hover": { bgcolor: "#EBEBEB" },
                      }),
                }}
              >
                {frame.duration_seconds}s
              </ButtonBase>
            ))}
          </Box>

          {/* Active frame preview */}
          <Box
            sx={{
              overflow: "hidden",
              borderRadius: "12px",
              background: FRAME_GRADIENTS[activeFrame % FRAME_GRADIENTS.length],
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "9/16",
                maxHeight: 320,
                p: 4,
                textAlign: "center",
                color: "#FFFFFF",
              }}
            >
              <Typography sx={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6 }}>
                Frame {frames[activeFrame].frame_number} · {frames[activeFrame].transition}
              </Typography>
              <Typography sx={{ mt: 2, fontSize: "24px", fontWeight: 700 }}>
                {frames[activeFrame].text_overlay}
              </Typography>
              <Typography sx={{ mt: 1.5, fontSize: "14px", opacity: 0.7 }}>
                {frames[activeFrame].visual_description}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleSave}
        disabled={isSaving || frames.length === 0}
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
        {isSaving ? "Creating reel..." : "Create reel"}
      </Button>
    </Box>
  );
}
