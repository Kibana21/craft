"use client";

import { useState } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import type { ScriptVersion, ScriptAction } from "@/types/video-script";

const ACTION_LABELS: Record<ScriptAction, string> = {
  draft: "AI draft",
  warm: "Warm & Personal",
  professional: "More Professional",
  shorter: "Shorter",
  stronger_cta: "Stronger CTA",
  manual: "Manual edit",
};

const ACTION_COLORS: Record<ScriptAction, string> = {
  draft: "#7C3AED",
  warm: "#D97706",
  professional: "#1A1A18",
  shorter: "#059669",
  stronger_cta: "#D0103A",
  manual: "#ABABAB",
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ScriptVersionDrawerProps {
  open: boolean;
  versions: ScriptVersion[];
  onClose: () => void;
  onRestore: (versionId: string) => Promise<void>;
}

export function ScriptVersionDrawer({
  open,
  versions,
  onClose,
  onRestore,
}: ScriptVersionDrawerProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleRestore = async (version: ScriptVersion) => {
    setRestoringId(version.id);
    try {
      await onRestore(version.id);
      setToast("Version restored. Your previous script was saved as a new version.");
      onClose();
    } catch {
      setToast("Restore failed. Please try again.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{ "& .MuiDrawer-paper": { width: 360, p: 3 } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
            Version history
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            ✕
          </IconButton>
        </Box>

        {versions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No versions yet. Versions are saved automatically as you edit or when AI rewrites your script.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {versions.map((v, idx) => {
              const isFirst = idx === 0;
              const color = ACTION_COLORS[v.action] ?? "#ABABAB";
              return (
                <Box key={v.id}>
                  <Box sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <Chip
                        label={ACTION_LABELS[v.action] ?? v.action}
                        size="small"
                        sx={{
                          bgcolor: color,
                          color: "#FFFFFF",
                          fontWeight: 600,
                          fontSize: "0.65rem",
                          height: 20,
                        }}
                      />
                      {isFirst && (
                        <Chip
                          label="current"
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.65rem", borderColor: "#E5E5E5", color: "#ABABAB" }}
                        />
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                        {formatRelativeTime(v.created_at)}
                      </Typography>
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", lineHeight: 1.5, mb: 1.5 }}
                    >
                      {v.preview}
                      {v.preview.length >= 150 ? "…" : ""}
                    </Typography>

                    {!isFirst && (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={restoringId === v.id}
                        onClick={() => handleRestore(v)}
                        sx={{
                          textTransform: "none",
                          fontSize: "0.75rem",
                          borderColor: "#E5E5E5",
                          color: "#222222",
                          "&:hover": { borderColor: "#ABABAB", bgcolor: "transparent" },
                        }}
                      >
                        {restoringId === v.id ? "Restoring…" : "Restore"}
                      </Button>
                    )}
                  </Box>
                  {idx < versions.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        )}
      </Drawer>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" onClose={() => setToast(null)} sx={{ width: "100%" }}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}
