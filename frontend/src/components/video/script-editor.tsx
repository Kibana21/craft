"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

const DEBOUNCE_MS = 2000;

interface ScriptEditorProps {
  content: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  targetDurationSeconds: number;
  isSaving: boolean;
  onChange: (content: string) => void;
  onSave: (content: string) => void;
}

export function ScriptEditor({
  content,
  wordCount,
  estimatedDurationSeconds,
  targetDurationSeconds,
  isSaving,
  onChange,
  onSave,
}: ScriptEditorProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localContent, setLocalContent] = useState(content);

  // Sync external content changes (e.g. after AI draft/rewrite)
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setLocalContent(next);
    onChange(next);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(next);
    }, DEBOUNCE_MS);
  };

  // Flush pending save when unmounting
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const diff = estimatedDurationSeconds - targetDurationSeconds;
  const pctOff = targetDurationSeconds > 0 ? Math.abs(diff) / targetDurationSeconds : 0;
  const statsColor = pctOff > 0.2 ? "#D0103A" : "#717171";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        component="textarea"
        value={localContent}
        onChange={handleChange}
        placeholder="Your script will appear here. Click 'Auto-draft from brief' to generate a starting point, or type directly."
        sx={{
          width: "100%",
          minHeight: 320,
          p: 2,
          border: "1.5px solid #E5E5E5",
          borderRadius: 2,
          fontFamily: "inherit",
          fontSize: "0.9375rem",
          lineHeight: 1.7,
          resize: "vertical",
          outline: "none",
          color: "#222222",
          bgcolor: "#FFFFFF",
          transition: "border-color 0.15s",
          "&:focus": { borderColor: "#1A1A18" },
        }}
      />

      {/* Stats bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ color: statsColor, fontVariantNumeric: "tabular-nums" }}>
          {wordCount} words · ~{estimatedDurationSeconds}s
          {pctOff > 0.2 && (
            <span>
              {" "}
              ({diff > 0 ? "+" : ""}
              {diff}s vs {targetDurationSeconds}s target)
            </span>
          )}
        </Typography>

        {isSaving ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <CircularProgress size={12} sx={{ color: "#ABABAB" }} />
            <Typography variant="caption" color="text.secondary">
              Saving…
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Auto-saves after {DEBOUNCE_MS / 1000}s of inactivity
          </Typography>
        )}
      </Box>
    </Box>
  );
}
