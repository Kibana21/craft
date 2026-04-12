"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { CameraFramingSelect } from "./camera-framing-select";
import type { CameraFraming, SceneInsertData } from "@/types/scene";

interface SceneInsertModalProps {
  open: boolean;
  position: number;
  onClose: () => void;
  onConfirm: (data: SceneInsertData) => Promise<void>;
}

export function SceneInsertModal({ open, position, onClose, onConfirm }: SceneInsertModalProps) {
  const [name, setName] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [setting, setSetting] = useState("");
  const [cameraFraming, setCameraFraming] = useState<CameraFraming>("medium_shot");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = name.trim() && dialogue.trim() && setting.trim();

  const handleConfirm = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await onConfirm({ position, name, dialogue, setting, camera_framing: cameraFraming });
      // Reset form
      setName("");
      setDialogue("");
      setSetting("");
      setCameraFraming("medium_shot");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Insert scene at position {position}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          <TextField
            label="Scene name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emotional close-up"
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Dialogue"
            value={dialogue}
            onChange={(e) => setDialogue(e.target.value)}
            placeholder="The spoken words for this scene…"
            size="small"
            fullWidth
            multiline
            rows={4}
            required
          />
          <TextField
            label="Setting"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="e.g. Bright family kitchen, morning light"
            size="small"
            fullWidth
            required
          />
          <CameraFramingSelect value={cameraFraming} onChange={setCameraFraming} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={isSubmitting}
          sx={{ textTransform: "none", color: "#717171" }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isValid || isSubmitting}
          onClick={handleConfirm}
          startIcon={isSubmitting ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
          sx={{
            bgcolor: "#D0103A",
            "&:hover": { bgcolor: "#A00D2E" },
            "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          {isSubmitting ? "Inserting…" : "Insert scene"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
