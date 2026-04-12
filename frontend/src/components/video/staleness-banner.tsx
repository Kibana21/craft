"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";

interface StalenessBannerProps {
  onRegenerate: () => Promise<void>;
}

export function StalenessBanner({ onRegenerate }: StalenessBannerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleConfirm = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
      setDialogOpen(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: 3,
          py: 2,
          borderRadius: 2,
          bgcolor: "#FFFBEB",
          border: "1.5px solid #FDE68A",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "#92400E" }}>
            Script has changed since scenes were generated
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Regenerate scenes to reflect the latest script version.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          onClick={() => setDialogOpen(true)}
          sx={{
            flexShrink: 0,
            bgcolor: "#D97706",
            "&:hover": { bgcolor: "#B45309" },
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Regenerate scenes
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Regenerate all scenes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will delete all current scenes and re-split your script using AI. Any manual edits to scene cards will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={isRegenerating}
            sx={{ textTransform: "none", color: "#717171" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isRegenerating}
            onClick={handleConfirm}
            startIcon={isRegenerating ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
            sx={{
              bgcolor: "#D0103A",
              "&:hover": { bgcolor: "#A00D2E" },
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {isRegenerating ? "Regenerating…" : "Yes, regenerate"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
