"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { deleteVideo } from "@/lib/api/generated-videos";
import type { GeneratedVideo } from "@/types/generated-video";

interface VideoDeleteButtonProps {
  video: GeneratedVideo;
  onDeleted: (video: GeneratedVideo) => void;
}

type State = "idle" | "confirm" | "deleting";

export function VideoDeleteButton({ video, onDeleted }: VideoDeleteButtonProps) {
  const [state, setState] = useState<State>("idle");

  const handleFirstClick = () => setState("confirm");
  const handleCancel = () => setState("idle");

  const handleConfirm = async () => {
    setState("deleting");
    try {
      await deleteVideo(video.id);
      onDeleted(video);
    } catch {
      // Reset on error so user can try again
      setState("idle");
    }
  };

  if (state === "confirm") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          size="small"
          onClick={handleConfirm}
          sx={{
            textTransform: "none",
            fontSize: "0.75rem",
            color: "#FFFFFF",
            bgcolor: "#D0103A",
            "&:hover": { bgcolor: "#A00D2E" },
            px: 1.5,
            py: 0.5,
            minWidth: 0,
          }}
        >
          Confirm delete?
        </Button>
        <Button
          size="small"
          onClick={handleCancel}
          sx={{
            textTransform: "none",
            fontSize: "0.75rem",
            color: "#717171",
            "&:hover": { color: "#222222", bgcolor: "transparent" },
            minWidth: 0,
            p: 0,
          }}
        >
          Cancel
        </Button>
      </Box>
    );
  }

  if (state === "deleting") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <CircularProgress size={14} sx={{ color: "#D0103A" }} />
        <Button
          size="small"
          disabled
          sx={{ textTransform: "none", fontSize: "0.75rem", color: "#ABABAB", p: 0, minWidth: 0 }}
        >
          Deleting…
        </Button>
      </Box>
    );
  }

  return (
    <Button
      size="small"
      onClick={handleFirstClick}
      sx={{
        textTransform: "none",
        fontSize: "0.75rem",
        color: "#ABABAB",
        "&:hover": { color: "#D0103A", bgcolor: "transparent" },
        p: 0,
        minWidth: 0,
      }}
    >
      Delete
    </Button>
  );
}
