"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { fetchArtifactDetail } from "@/lib/api/artifacts";
import { triggerGeneration } from "@/lib/api/video-sessions";
import { staticVideoUrl } from "@/lib/api/generated-videos";
import { VideoCard } from "@/components/video/video-card";
import { GenerationStatusBanner } from "@/components/video/generation-status-banner";
import { VideoPlayerOverlay } from "@/components/video/video-player-overlay";
import { useVideoPolling } from "@/hooks/useVideoPolling";
import type { GeneratedVideo } from "@/types/generated-video";

export default function GenerateStepPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState("");
  const [activeVideo, setActiveVideo] = useState<GeneratedVideo | null>(null);

  const { videos, setVideos, anyActive, isLoading, refresh } = useVideoPolling(sessionId);
  const hasReadyVideo = videos.some((v) => v.status === "ready");

  useEffect(() => {
    if (!artifactId) return;
    fetchArtifactDetail(artifactId)
      .then((art) => {
        const vsId = art.video_session_id;
        if (!vsId) {
          router.push(`/projects/${projectId}/artifacts/${artifactId}/video/presenter`);
          return;
        }
        setSessionId(vsId);
      })
      .catch(() => router.push(`/projects/${projectId}`));
  }, [artifactId, projectId, router]);

  const handleGenerate = async () => {
    if (!sessionId || anyActive) return;
    setIsTriggering(true);
    setError("");
    try {
      await triggerGeneration(sessionId);
      await refresh();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail ?? "";
      if (detail.includes("already being generated")) {
        setError("A video is already being generated for this project.");
      } else {
        setError(detail || "Failed to start video generation. Please try again.");
      }
    } finally {
      setIsTriggering(false);
    }
  };

  const handlePlay = (video: GeneratedVideo) => {
    setActiveVideo(video);
  };

  const handleDownload = (video: GeneratedVideo) => {
    if (video.file_url) {
      const a = document.createElement("a");
      a.href = staticVideoUrl(video.file_url);
      a.download = `video-v${video.version}.mp4`;
      a.click();
    }
  };

  const handleDelete = (video: GeneratedVideo) => {
    // Remove from local state immediately for instant feedback
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
    // Close player if this video was playing
    if (activeVideo?.id === video.id) setActiveVideo(null);
  };

  return (
    <Box sx={{ maxWidth: 860 }}>
      {/* Heading + trigger */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Generate video
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI renders each scene sequentially, chaining clips for visual continuity.
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={anyActive || isTriggering || !sessionId}
          onClick={handleGenerate}
          startIcon={isTriggering ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : undefined}
          sx={{
            flexShrink: 0,
            bgcolor: "#D0103A",
            "&:hover": { bgcolor: "#A00D2E" },
            "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
            px: 3,
            py: 1.25,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          {isTriggering ? "Starting…" : hasReadyVideo ? "Generate new version" : "Generate video"}
        </Button>
      </Box>

      {/* Active job banner */}
      {anyActive && <GenerationStatusBanner />}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Video cards */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#D0103A" }} />
        </Box>
      ) : videos.length === 0 ? (
        <Box
          sx={{
            py: 10,
            textAlign: "center",
            border: "1.5px dashed #E5E5E5",
            borderRadius: 2,
          }}
        >
          <Typography sx={{ fontSize: "2rem", mb: 1.5 }}>🎬</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            No videos yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click "Generate video" to start rendering your scenes.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onPlay={handlePlay}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      )}

      {/* Full-screen player overlay */}
      <VideoPlayerOverlay
        video={activeVideo}
        onClose={() => setActiveVideo(null)}
        onDownload={handleDownload}
      />
    </Box>
  );
}
