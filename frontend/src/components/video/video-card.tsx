"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import { VideoDeleteButton } from "@/components/video/video-delete-button";
import type { GeneratedVideo } from "@/types/generated-video";

interface VideoCardProps {
  video: GeneratedVideo;
  onPlay?: (video: GeneratedVideo) => void;
  onDownload?: (video: GeneratedVideo) => void;
  onDelete?: (video: GeneratedVideo) => void;
}

function QueuedState() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 5, gap: 2 }}>
      <Typography sx={{ fontSize: "2rem" }}>⏳</Typography>
      <Typography variant="body2" sx={{ color: "#717171", fontWeight: 600 }}>
        Queued — waiting to start
      </Typography>
    </Box>
  );
}

function RenderingState({ video }: { video: GeneratedVideo }) {
  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "#222222" }}>
          Rendering…
        </Typography>
        <Typography variant="body2" sx={{ color: "#717171", fontVariantNumeric: "tabular-nums" }}>
          {video.progress_percent}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={video.progress_percent}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: "#F0F0F0",
          "& .MuiLinearProgress-bar": { bgcolor: "#D0103A", borderRadius: 3 },
        }}
      />
      {video.current_scene !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Scene {video.current_scene} rendering…
        </Typography>
      )}
    </Box>
  );
}

function ReadyState({ video, onPlay, onDownload }: Pick<VideoCardProps, "video" | "onPlay" | "onDownload">) {
  return (
    <Box>
      {/* Thumbnail / play area */}
      <Box
        onClick={() => onPlay?.(video)}
        sx={{
          height: 160,
          bgcolor: "#1A1A18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: onPlay ? "pointer" : "default",
          borderRadius: "8px 8px 0 0",
          position: "relative",
          "&:hover .play-icon": { transform: "scale(1.1)" },
        }}
      >
        <Box
          className="play-icon"
          sx={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.4rem",
            transition: "transform 0.15s",
          }}
        >
          ▶
        </Box>
      </Box>

      {/* Info + actions */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Version {video.version}
          </Typography>
          <Chip
            label="Ready"
            size="small"
            sx={{ mt: 0.5, height: 18, fontSize: "0.65rem", bgcolor: "#D1FAE5", color: "#065F46" }}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onDownload?.(video)}
            sx={{
              textTransform: "none",
              fontSize: "0.75rem",
              borderColor: "#E5E5E5",
              color: "#222222",
              "&:hover": { borderColor: "#ABABAB", bgcolor: "transparent" },
            }}
          >
            Download
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function FailedState({ video, onDelete }: Pick<VideoCardProps, "video" | "onDelete">) {
  return (
    <Box sx={{ py: 4, px: 2, textAlign: "center" }}>
      <Typography sx={{ fontSize: "1.8rem", mb: 1 }}>✕</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: "#D0103A", mb: 0.5 }}>
        Generation failed
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 2, maxWidth: 260, mx: "auto" }}
      >
        {video.error_message || "An unexpected error occurred."}
      </Typography>
      {onDelete && <VideoDeleteButton video={video} onDeleted={onDelete} />}
    </Box>
  );
}

export function VideoCard({ video, onPlay, onDownload, onDelete }: VideoCardProps) {
  return (
    <Box
      sx={{
        border: "1.5px solid #E5E5E5",
        borderRadius: 2,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
        minWidth: 280,
      }}
    >
      {video.status === "queued" && <QueuedState />}
      {video.status === "rendering" && <RenderingState video={video} />}
      {video.status === "ready" && (
        <ReadyState video={video} onPlay={onPlay} onDownload={onDownload} />
      )}
      {video.status === "failed" && <FailedState video={video} onDelete={onDelete} />}

      {/* Card footer — always shows version + timestamp */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: "1px solid #F0F0F0",
          bgcolor: "#FAFAFA",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          v{video.version}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(video.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Typography>
      </Box>
    </Box>
  );
}
