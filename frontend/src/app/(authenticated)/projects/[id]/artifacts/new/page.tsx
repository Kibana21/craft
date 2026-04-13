"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import { WhatsAppCreator } from "@/components/artifacts/create/whatsapp-creator";
import { createArtifact } from "@/lib/api/artifacts";
import { fetchProjectDetail, type ProjectDetail } from "@/lib/api/projects";
import type { ArtifactType } from "@/types/artifact";

const ARTIFACT_TYPES: { key: ArtifactType; icon: string; label: string; desc: string }[] = [
  { key: "poster", icon: "◻", label: "Static poster", desc: "PNG / PDF · Social media & print" },
  { key: "whatsapp_card", icon: "✉", label: "WhatsApp card", desc: "800x800 · Client messaging" },
  { key: "reel", icon: "▶", label: "Reel / Video", desc: "9:16 vertical · Social stories" },
  { key: "infographic", icon: "📊", label: "Infographic", desc: "Steps / guide · Educational" },
  { key: "slide_deck", icon: "📋", label: "Slide deck", desc: "PPTX · Presentations" },
];

export default function NewArtifactPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const preselectedType = searchParams.get("type") as ArtifactType | null;
  const [selectedType, setSelectedType] = useState<ArtifactType | null>(preselectedType);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetail(projectId).then(setProject).catch(() => router.push("/home"));
    }
  }, [projectId, router]);

  // Immediately create a REEL artifact and route to the video wizard
  const handleSelectReel = async () => {
    if (!projectId || isCreatingVideo) return;
    setIsCreatingVideo(true);
    try {
      const artifact = await createArtifact(projectId, {
        type: "reel",
        name: "New video",
        content: {},
        channel: "social",
      });
      router.push(`/projects/${projectId}/artifacts/${artifact.id}/video/presenter`);
    } catch {
      setIsCreatingVideo(false);
    }
  };

  const handleSave = async (data: Record<string, unknown>) => {
    if (!selectedType || !projectId) return;
    setIsSaving(true);
    try {
      const artifact = await createArtifact(projectId, {
        type: selectedType,
        name: (data.headline as string) || `New ${selectedType}`,
        content: data,
        channel: selectedType === "whatsapp_card" ? "whatsapp" : selectedType === "poster" ? "instagram" : "social",
        format: (data.format as "1:1" | "4:5" | "9:16" | "800x800") || undefined,
      });
      router.push(`/projects/${projectId}/artifacts/${artifact.id}`);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 720, px: 3, py: 6 }}>
      {/* Breadcrumb */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
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
          {project?.name || "Project"}
        </ButtonBase>
        <Typography sx={{ fontSize: "14px", color: "#717171" }}>/</Typography>
        <Typography sx={{ fontSize: "14px", color: "#222222" }}>New artifact</Typography>
      </Box>

      {!selectedType ? (
        /* Type selector */
        <Box
          sx={{
            borderRadius: "16px",
            border: "1px solid #EBEBEB",
            bgcolor: "#FFFFFF",
            p: 4,
          }}
        >
          <Typography sx={{ fontSize: "28px", fontWeight: 700, color: "#222222" }}>
            Choose artifact type
          </Typography>
          <Typography sx={{ mt: 1, fontSize: "16px", color: "#717171" }}>
            What kind of content do you want to create?
          </Typography>

          <Box
            sx={{
              mt: 5,
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 3,
            }}
          >
            {ARTIFACT_TYPES.map((type) => (
              <ButtonBase
                key={type.key}
                disabled={type.key === "reel" && isCreatingVideo}
                onClick={() => {
                  if (type.key === "reel") return handleSelectReel();
                  if (type.key === "poster") return router.push(`/projects/${projectId}/artifacts/new-poster/brief`);
                  setSelectedType(type.key);
                }}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  borderRadius: "12px",
                  border: "2px solid #EBEBEB",
                  p: 4,
                  textAlign: "left",
                  transition: "all 0.2s",
                  opacity: type.key === "reel" && isCreatingVideo ? 0.6 : 1,
                  "&:hover": {
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    transform: "scale(1.02)",
                    borderColor: "#D0103A",
                    "& .MuiTypography-root.card-label": { color: "#D0103A" },
                  },
                }}
              >
                {type.key === "reel" && isCreatingVideo ? (
                  <CircularProgress size={36} sx={{ color: "#D0103A" }} />
                ) : (
                  <Typography sx={{ fontSize: "36px" }}>{type.icon}</Typography>
                )}
                <Typography
                  className="card-label"
                  sx={{ mt: 2, fontSize: "16px", fontWeight: 600, color: "#222222", transition: "color 0.2s" }}
                >
                  {type.label}
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#717171" }}>
                  {type.desc}
                </Typography>
              </ButtonBase>
            ))}
          </Box>
        </Box>
      ) : (
        /* Creator form */
        <Box>
          <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              disableElevation
              onClick={() => setSelectedType(null)}
              startIcon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 4L6 8l4 4" />
                </svg>
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                fontSize: "13px",
                fontWeight: 500,
                color: "#5F6368",
                borderColor: "#E8EAED",
                "&:hover": { bgcolor: "#F1F3F4", borderColor: "#DADCE0", color: "#1F1F1F" },
              }}
            >
              Change type
            </Button>
            <Box
              sx={{
                borderRadius: 9999,
                bgcolor: "#F7F7F7",
                px: 1.5,
                py: 0.5,
              }}
            >
              <Typography sx={{ fontSize: "14px", fontWeight: 500, color: "#484848" }}>
                {ARTIFACT_TYPES.find((t) => t.key === selectedType)?.label}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #EBEBEB",
              bgcolor: "#FFFFFF",
              p: 4,
            }}
          >
            <Typography sx={{ mb: 3, fontSize: "28px", fontWeight: 700, color: "#222222" }}>
              Create {ARTIFACT_TYPES.find((t) => t.key === selectedType)?.label?.toLowerCase()}
            </Typography>

            {selectedType === "whatsapp_card" && (
              <WhatsAppCreator
                product={project?.product || ""}
                audience={project?.target_audience || ""}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {(selectedType === "infographic" || selectedType === "slide_deck") && (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Box
                  sx={{
                    mx: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    bgcolor: "#F7F7F7",
                    fontSize: "30px",
                  }}
                >
                  🚧
                </Box>
                <Typography sx={{ mt: 2, fontSize: "18px", fontWeight: 600, color: "#222222" }}>
                  Coming soon
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#717171" }}>
                  {selectedType === "infographic" ? "Infographic" : "Slide deck"} creation will be available in a future update.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
