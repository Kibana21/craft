"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { fetchArtifactDetail } from "@/lib/api/artifacts";
import { fetchVideoSession, listGeneratedVideos } from "@/lib/api/video-sessions";
import { WizardStepIndicator } from "@/components/video/wizard-step-indicator";
import type { ArtifactDetail } from "@/types/artifact";
import type { VideoSession } from "@/types/presenter";

// ── Context ───────────────────────────────────────────────────────────────────

interface VideoWizardContextValue {
  artifact: ArtifactDetail | null;
  videoSession: VideoSession | null;
  refreshSession: () => Promise<void>;
}

const VideoWizardContext = createContext<VideoWizardContextValue>({
  artifact: null,
  videoSession: null,
  refreshSession: async () => {},
});

export function useVideoWizard() {
  return useContext(VideoWizardContext);
}

// ── Layout ────────────────────────────────────────────────────────────────────

type StepKey = "brief" | "presenter" | "script" | "storyboard" | "generate";

const SESSION_STEP_MAP: Record<string, StepKey> = {
  presenter: "presenter",
  script: "script",
  storyboard: "storyboard",
  generation: "generate",
};

export default function VideoWizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();

  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [videoSession, setVideoSession] = useState<VideoSession | null>(null);
  const [hasReadyVideo, setHasReadyVideo] = useState(false);

  const loadSession = async () => {
    if (!artifactId) return;
    try {
      const art = await fetchArtifactDetail(artifactId);
      setArtifact(art);
      const vsId = art.video_session_id;
      if (vsId) {
        const [vs, videoList] = await Promise.all([
          fetchVideoSession(vsId),
          listGeneratedVideos(vsId),
        ]);
        setVideoSession(vs);
        setHasReadyVideo(videoList.videos.some((v) => v.status === "ready"));
      }
    } catch {
      // Non-fatal — child pages handle their own errors
    }
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId]);

  // "brief" phase = DB step is "presenter" AND artifact has no key_message yet
  const hasBrief = !!((artifact?.content as Record<string, unknown>)?.key_message);
  const currentStep: StepKey = (() => {
    const dbStep = SESSION_STEP_MAP[videoSession?.current_step ?? ""] ?? "brief";
    if (dbStep === "presenter" && !hasBrief) return "brief";
    return dbStep;
  })();

  const handleNavigate = (step: StepKey) => {
    router.push(`/projects/${projectId}/artifacts/${artifactId}/video/${step}`);
  };

  return (
    <VideoWizardContext.Provider
      value={{ artifact, videoSession, refreshSession: loadSession }}
    >
      <Box sx={{ mx: "auto", maxWidth: 960, px: 3, py: 6 }}>
        {/* Breadcrumb */}
        <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 1 }}>
          <ButtonBase
            onClick={() => router.push("/home")}
            sx={{ fontSize: "14px", color: "#717171", "&:hover": { color: "#222222" } }}
          >
            Home
          </ButtonBase>
          <Typography sx={{ fontSize: "14px", color: "#717171" }}>/</Typography>
          <ButtonBase
            onClick={() => router.push(`/projects/${projectId}`)}
            sx={{ fontSize: "14px", color: "#717171", "&:hover": { color: "#222222" } }}
          >
            {artifact?.name ?? "Project"}
          </ButtonBase>
          <Typography sx={{ fontSize: "14px", color: "#717171" }}>/</Typography>
          <Typography sx={{ fontSize: "14px", color: "#222222" }}>Video wizard</Typography>
        </Box>

        {/* Shared step indicator */}
        <WizardStepIndicator
          currentStep={currentStep}
          projectId={projectId}
          artifactId={artifactId}
          onNavigate={handleNavigate}
          isGenerationComplete={hasReadyVideo}
        />

        {/* Page content */}
        {children}
      </Box>
    </VideoWizardContext.Provider>
  );
}
