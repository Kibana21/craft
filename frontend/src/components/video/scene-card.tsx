"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { CameraFramingSelect } from "./camera-framing-select";
import { refineSceneDialogue, suggestSceneSetting } from "@/lib/api/scenes";
import type { Scene, CameraFraming } from "@/types/scene";

function estimateSceneDuration(dialogue: string): number {
  const words = dialogue.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 2.5) + 1); // speaking time + 1s visual tail
}

interface SceneCardProps {
  scene: Scene;
  onSave: (sceneId: string, data: { name?: string; dialogue?: string; setting?: string; camera_framing?: CameraFraming }) => Promise<void>;
  onDelete: (sceneId: string) => Promise<void>;
}

export function SceneCard({ scene, onSave, onDelete }: SceneCardProps) {
  const [name, setName] = useState(scene.name);
  const [dialogue, setDialogue] = useState(scene.dialogue);
  const [setting, setSetting] = useState(scene.setting);
  const [cameraFraming, setCameraFraming] = useState<CameraFraming>(scene.camera_framing);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isRefiningDialogue, setIsRefiningDialogue] = useState(false);
  const [isSuggestingSetting, setIsSuggestingSetting] = useState(false);
  const [dialogueAiError, setDialogueAiError] = useState("");
  const [settingAiError, setSettingAiError] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty =
    name !== scene.name ||
    dialogue !== scene.dialogue ||
    setting !== scene.setting ||
    cameraFraming !== scene.camera_framing;

  // Sync if parent data changes (e.g. after regenerate)
  useEffect(() => {
    setName(scene.name);
    setDialogue(scene.dialogue);
    setSetting(scene.setting);
    setCameraFraming(scene.camera_framing);
  }, [scene]);

  const handleRefineDialogue = async () => {
    setIsRefiningDialogue(true);
    setDialogueAiError("");
    try {
      const refined = await refineSceneDialogue(scene.id);
      setDialogue(refined);
    } catch {
      setDialogueAiError("Refinement failed. Try again.");
    } finally {
      setIsRefiningDialogue(false);
    }
  };

  const handleSuggestSetting = async () => {
    setIsSuggestingSetting(true);
    setSettingAiError("");
    try {
      const suggested = await suggestSceneSetting(scene.id);
      setSetting(suggested);
    } catch {
      setSettingAiError("Suggestion failed. Try again.");
    } finally {
      setIsSuggestingSetting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(scene.id, { name, dialogue, setting, camera_framing: cameraFraming });
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(scene.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        border: "1.5px solid #E5E5E5",
        borderRadius: 2,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: "1px solid #F0F0F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "#FAFAFA",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: "#717171", letterSpacing: 0.5 }}>
          SCENE {scene.sequence}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label="Presenter Locked"
            size="small"
            sx={{ height: 20, fontSize: "0.65rem", bgcolor: "#F0F7FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}
          />
          <Chip
            label="Brand Locked"
            size="small"
            sx={{ height: 20, fontSize: "0.65rem", bgcolor: "#FFF5F7", color: "#BE123C", border: "1px solid #FECDD3" }}
          />
          {(() => {
            const secs = estimateSceneDuration(dialogue);
            const isLong = secs > 7;
            return (
              <Chip
                label={`~${secs}s`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  bgcolor: isLong ? "#FFF7ED" : "#F0FDF4",
                  color: isLong ? "#C2410C" : "#15803D",
                  border: `1px solid ${isLong ? "#FED7AA" : "#BBF7D0"}`,
                  fontWeight: 600,
                }}
              />
            );
          })()}
        </Box>
      </Box>

      {/* Card body */}
      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Scene name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
        />

        {/* Dialogue — styled with italic left-border */}
        <Box sx={{ borderLeft: "3px solid #D0103A", pl: 1.5 }}>
          <TextField
            label="Dialogue"
            value={dialogue}
            onChange={(e) => setDialogue(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={3}
            slotProps={{ input: { style: { fontStyle: "italic" } } }}
          />
          <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={handleRefineDialogue}
              disabled={!dialogue.trim() || isRefiningDialogue}
              startIcon={
                isRefiningDialogue ? (
                  <CircularProgress size={11} sx={{ color: "#D0103A" }} />
                ) : (
                  <Box component="span" sx={{ fontSize: "12px" }}>✦</Box>
                )
              }
              sx={{
                textTransform: "none",
                fontSize: "11px",
                fontWeight: 500,
                color: "#D0103A",
                px: 0.75,
                py: 0.25,
                minWidth: 0,
                borderRadius: "6px",
                "&:hover": { bgcolor: "#FFF1F4" },
                "&:disabled": { color: "#ABABAB" },
              }}
            >
              {isRefiningDialogue ? "Refining…" : "Refine with AI"}
            </Button>
            {dialogueAiError && (
              <Typography sx={{ fontSize: "11px", color: "#D0103A" }}>{dialogueAiError}</Typography>
            )}
          </Box>
        </Box>

        <Box>
          <TextField
            label="Setting"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
          />
          <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={handleSuggestSetting}
              disabled={!dialogue.trim() || isSuggestingSetting}
              startIcon={
                isSuggestingSetting ? (
                  <CircularProgress size={11} sx={{ color: "#9333EA" }} />
                ) : (
                  <Box component="span" sx={{ fontSize: "12px" }}>✦</Box>
                )
              }
              sx={{
                textTransform: "none",
                fontSize: "11px",
                fontWeight: 500,
                color: "#9333EA",
                px: 0.75,
                py: 0.25,
                minWidth: 0,
                borderRadius: "6px",
                "&:hover": { bgcolor: "#FAF5FF" },
                "&:disabled": { color: "#ABABAB" },
              }}
            >
              {isSuggestingSetting ? "Suggesting…" : "Suggest setting with AI"}
            </Button>
            {settingAiError && (
              <Typography sx={{ fontSize: "11px", color: "#9333EA" }}>{settingAiError}</Typography>
            )}
          </Box>
        </Box>

        <CameraFramingSelect value={cameraFraming} onChange={setCameraFraming} />

        {/* Footer actions */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pt: 0.5 }}>
          <Button
            size="small"
            disabled={isDeleting}
            onClick={handleDelete}
            startIcon={
              isDeleting ? (
                <CircularProgress size={12} sx={{ color: "#D0103A" }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              )
            }
            sx={{
              textTransform: "none",
              color: "#DC2626",
              fontSize: "0.75rem",
              border: "1px solid #FECACA",
              borderRadius: "6px",
              px: 1.25,
              py: 0.4,
              "&:hover": { bgcolor: "#FEF2F2", borderColor: "#DC2626" },
              "&:disabled": { color: "#ABABAB", borderColor: "#E5E5E5" },
            }}
          >
            {isDeleting ? "Deleting…" : "Delete scene"}
          </Button>

          <Button
            size="small"
            variant="contained"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
            startIcon={isSaving ? <CircularProgress size={12} sx={{ color: "inherit" }} /> : undefined}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.8rem",
              bgcolor: savedFlash ? "#059669" : "#D0103A",
              "&:hover": { bgcolor: savedFlash ? "#047857" : "#A00D2E" },
              "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
              transition: "bgcolor 0.3s",
              minWidth: 90,
            }}
          >
            {savedFlash ? "Saved ✓" : isSaving ? "Saving…" : "Save"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
