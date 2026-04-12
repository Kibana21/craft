"use client";

import { useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { staticVideoUrl } from "@/lib/api/generated-videos";
import type { GeneratedVideo } from "@/types/generated-video";

interface VideoPlayerOverlayProps {
  video: GeneratedVideo | null;
  onClose: () => void;
  onDownload?: (video: GeneratedVideo) => void;
}

export function VideoPlayerOverlay({ video, onClose, onDownload }: VideoPlayerOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Pause when overlay closes so audio doesn't keep playing
  useEffect(() => {
    if (!video && videoRef.current) {
      videoRef.current.pause();
    }
  }, [video]);

  if (!video || !video.file_url) return null;

  const src = staticVideoUrl(video.file_url);

  return (
    <Dialog
      open={!!video}
      onClose={onClose}
      fullScreen
      slotProps={{ paper: { sx: { bgcolor: "#000000" } } }}
    >
      {/* Top bar */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      >
        <Typography sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "0.95rem" }}>
          Version {video.version}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {onDownload && (
            <Button
              size="small"
              onClick={() => onDownload(video)}
              sx={{
                textTransform: "none",
                color: "#FFFFFF",
                borderColor: "rgba(255,255,255,0.4)",
                "&:hover": { borderColor: "#FFFFFF", bgcolor: "rgba(255,255,255,0.1)" },
              }}
              variant="outlined"
            >
              Download
            </Button>
          )}

          {/* Close button */}
          <IconButton
            onClick={onClose}
            sx={{
              color: "#FFFFFF",
              bgcolor: "rgba(255,255,255,0.15)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
              width: 36,
              height: 36,
            }}
            aria-label="Close player"
          >
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>✕</span>
          </IconButton>
        </Box>
      </Box>

      {/* Video */}
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            outline: "none",
          }}
        />
      </Box>
    </Dialog>
  );
}
