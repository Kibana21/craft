"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVideoWizard } from "../layout";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { fetchArtifactDetail } from "@/lib/api/artifacts";
import {
  fetchVideoSession,
  getScript,
  generateScenes,
  regenerateScenes,
  listScenes,
} from "@/lib/api/video-sessions";
import { updateScene, deleteScene, insertScene } from "@/lib/api/scenes";
import { SceneCard } from "@/components/video/scene-card";
import { SceneInsertButton } from "@/components/video/scene-insert-button";
import { SceneInsertModal } from "@/components/video/scene-insert-modal";
import { StalenessBanner } from "@/components/video/staleness-banner";
import type { Scene, CameraFraming, SceneInsertData } from "@/types/scene";

export default function StoryboardStepPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();
  const { refreshSession } = useVideoWizard();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetDuration, setTargetDuration] = useState(60);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesVersionId, setScenesVersionId] = useState<string | null>(null);
  const [currentScriptVersionId, setCurrentScriptVersionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Insert modal
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  const isStale =
    scenes.length > 0 &&
    scenesVersionId !== currentScriptVersionId;

  const WORDS_PER_SECOND = 2.5;
  const totalEstimatedSeconds = scenes.reduce((sum, s) => {
    const words = s.dialogue.trim().split(/\s+/).filter(Boolean).length;
    return sum + Math.max(2, Math.ceil(words / WORDS_PER_SECOND) + 1);
  }, 0);

  const loadScenes = async (sid: string) => {
    const data = await listScenes(sid);
    setScenes(data.scenes);
    setScenesVersionId(data.scenes_script_version_id);
    setCurrentScriptVersionId(data.current_script_version_id);
    return data;
  };

  useEffect(() => {
    if (!artifactId) return;

    fetchArtifactDetail(artifactId)
      .then(async (art) => {
        const vsId = art.video_session_id;
        if (!vsId) {
          router.push(`/projects/${projectId}/artifacts/${artifactId}/video/presenter`);
          return;
        }
        setSessionId(vsId);

        const vs = await fetchVideoSession(vsId);
        setTargetDuration(vs.target_duration_seconds);

        const data = await loadScenes(vsId);

        // Auto-generate if no scenes exist
        if (data.scenes.length === 0) {
          if (vs.presenter_id === null) {
            setError("Assign a presenter before generating scenes.");
            setIsLoading(false);
            return;
          }
          // Verify a non-empty script exists before trying to generate
          const script = await getScript(vsId);
          if (!script.content.trim()) {
            setError("Write a script before generating scenes. Use the button below to go back.");
            setIsLoading(false);
            return;
          }
          setIsGenerating(true);
          try {
            const generated = await generateScenes(vsId);
            setScenes(generated);
            await refreshSession();
          } catch (err: unknown) {
            // React StrictMode fires effects twice — a concurrent request may have
            // already generated and committed the scenes. Check before showing error.
            try {
              const check = await listScenes(vsId);
              if (check.scenes.length > 0) {
                setScenes(check.scenes);
                await refreshSession();
                setIsGenerating(false);
                return;
              }
            } catch { /* ignore */ }
            const detail = (err as { detail?: string })?.detail;
            if (detail?.toLowerCase().includes("script")) {
              setError(detail + " Use the button below to go back.");
            } else {
              setError(detail ?? "Scene generation failed. Please try again.");
            }
          } finally {
            setIsGenerating(false);
          }
          // Non-fatal: reload version metadata after generation
          try { await loadScenes(vsId); } catch { /* ignore */ }
        }
      })
      .catch(() => router.push(`/projects/${projectId}`))
      .finally(() => setIsLoading(false));
  }, [artifactId, projectId, router]);

  const handleRegenerate = async () => {
    if (!sessionId) return;
    const generated = await regenerateScenes(sessionId);
    setScenes(generated);
    await loadScenes(sessionId);
  };

  const handleSave = async (
    sceneId: string,
    data: { name?: string; dialogue?: string; setting?: string; camera_framing?: CameraFraming }
  ) => {
    await updateScene(sceneId, data);
    // Update local state optimistically
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, ...data } : s))
    );
  };

  const handleDelete = async (sceneId: string) => {
    await deleteScene(sceneId);
    if (sessionId) await loadScenes(sessionId);
  };

  const handleInsert = async (data: SceneInsertData) => {
    if (!sessionId) return;
    await insertScene(sessionId, data);
    await loadScenes(sessionId);
    setInsertPosition(null);
  };

  const handleProceed = () => {
    router.push(`/projects/${projectId}/artifacts/${artifactId}/video/generate`);
  };

  if (isLoading || isGenerating) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 12, gap: 2 }}>
        <CircularProgress sx={{ color: "#D0103A" }} />
        <Typography variant="body2" color="text.secondary">
          {isGenerating ? "Generating scenes from your script…" : "Loading…"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 760 }}>
      {/* Heading */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Scene storyboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""} · ~{totalEstimatedSeconds}s estimated · {targetDuration}s target
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setInsertPosition(1)}
          sx={{
            textTransform: "none",
            borderColor: "#E5E5E5",
            color: "#222222",
            "&:hover": { borderColor: "#ABABAB", bgcolor: "transparent" },
            flexShrink: 0,
          }}
        >
          + Add scene
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setError("")}
          action={
            error.toLowerCase().includes("script") ? (
              <Button
                size="small"
                color="inherit"
                onClick={() =>
                  router.push(`/projects/${projectId}/artifacts/${artifactId}/video/script`)
                }
              >
                Go to Script
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}

      {/* Staleness banner */}
      {isStale && <StalenessBanner onRegenerate={handleRegenerate} />}

      {/* Scene list */}
      {scenes.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: "center",
            border: "1.5px dashed #E5E5E5",
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No scenes yet.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Go back to the script step and ensure your script has content, then return here.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Insert button before scene 1 */}
          <Box
            sx={{
              "&:hover .scene-insert": { opacity: 1 },
              opacity: 0,
              transition: "opacity 0.15s",
              mb: 0.5,
            }}
            className="scene-insert"
          >
            <SceneInsertButton onClick={() => setInsertPosition(1)} />
          </Box>

          {scenes.map((scene, idx) => (
            <Box key={scene.id}>
              <SceneCard
                scene={scene}
                onSave={handleSave}
                onDelete={handleDelete}
              />
              {/* Insert button after each scene */}
              <Box
                sx={{
                  my: 0.5,
                  opacity: 0,
                  transition: "opacity 0.15s",
                  "&:hover": { opacity: 1 },
                }}
              >
                <SceneInsertButton onClick={() => setInsertPosition(idx + 2)} />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Proceed */}
      {scenes.length > 0 && (
        <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            onClick={handleProceed}
            sx={{
              bgcolor: "#D0103A",
              "&:hover": { bgcolor: "#A00D2E" },
              px: 4,
              py: 1.25,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
            }}
          >
            Continue to video generation
          </Button>
        </Box>
      )}

      {/* Insert modal */}
      {insertPosition !== null && (
        <SceneInsertModal
          open={true}
          position={insertPosition}
          onClose={() => setInsertPosition(null)}
          onConfirm={handleInsert}
        />
      )}
    </Box>
  );
}
