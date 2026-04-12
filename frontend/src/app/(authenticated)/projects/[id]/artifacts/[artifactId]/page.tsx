"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchArtifactDetail, updateArtifact } from "@/lib/api/artifacts";
import { ExportDialog } from "@/components/artifacts/export-dialog";
import { CommentThread } from "@/components/artifacts/comment-thread";
import type { ArtifactDetail } from "@/types/artifact";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

const TYPE_ICONS: Record<string, string> = {
  poster: "◻", whatsapp_card: "✉", reel: "▶", video: "▶",
  story: "◻", infographic: "📊", slide_deck: "📋",
};

// Gradient map converted to CSS linear-gradient equivalents
const TYPE_BG: Record<string, string> = {
  poster: "linear-gradient(135deg, #7C3AED, #8B5CF6)",
  whatsapp_card: "linear-gradient(135deg, #DC2626, #F43F5E)",
  reel: "linear-gradient(135deg, #059669, #14B8A6)",
  video: "linear-gradient(135deg, #059669, #14B8A6)",
  story: "linear-gradient(135deg, #D97706, #F97316)",
  infographic: "linear-gradient(135deg, #0891B2, #3B82F6)",
  slide_deck: "linear-gradient(135deg, #334155, #475569)",
};

function ComplianceBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          height: 36,
          alignItems: "center",
          gap: 0.75,
          borderRadius: 9999,
          bgcolor: "#F7F7F7",
          px: 1.5,
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#717171",
        }}
      >
        ⏳ Scoring...
      </Box>
    );
  }
  const bgcolor =
    score >= 90
      ? "#008A05"
      : score >= 70
        ? "#F59E0B"
        : "#D0103A";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        height: 36,
        width: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        bgcolor,
        color: "white",
        fontSize: "0.75rem",
        fontWeight: 700,
      }}
    >
      {Math.round(score)}
    </Box>
  );
}

export default function ArtifactDetailPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showExport, setShowExport] = useState(false);

  const LEADER_ROLES = ["district_leader", "agency_leader", "brand_admin"];
  const canComment = user ? LEADER_ROLES.includes(user.role) : false;

  useEffect(() => {
    if (artifactId) {
      fetchArtifactDetail(artifactId)
        .then(setArtifact)
        .catch(() => router.push(`/projects/${projectId}`))
        .finally(() => setIsLoading(false));
    }
  }, [artifactId, projectId, router]);

  const handleSaveField = async (field: string, value: string) => {
    if (!artifact) return;
    const newContent = { ...(artifact.content || {}), [field]: value };
    const updated = await updateArtifact(artifact.id, { content: newContent });
    setArtifact(updated);
    setEditingField(null);
  };

  if (isLoading || !artifact) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 900, px: 3, py: 6 }}>
        <Box
          sx={{
            height: 32,
            width: 192,
            borderRadius: "8px",
            bgcolor: "#F7F7F7",
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.4 },
            },
          }}
        />
        <Box
          sx={{
            mt: 3,
            height: 384,
            borderRadius: "12px",
            bgcolor: "#F7F7F7",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </Box>
    );
  }

  const content = artifact.content || {};
  const locks = artifact.locks || [];
  const isLocked = (field: string) => locks.includes(field);
  const gradient = TYPE_BG[artifact.type] || TYPE_BG.poster;
  const icon = TYPE_ICONS[artifact.type] || "◻";

  return (
    <Box sx={{ mx: "auto", maxWidth: 900, px: 3, py: 6 }}>
      {/* Breadcrumb */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          onClick={() => router.push(`/projects/${projectId}`)}
          disableElevation
          startIcon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8l4 4" />
            </svg>
          }
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            border: "1px solid #E8EAED",
            color: "#5F6368",
            fontSize: "0.8125rem",
            fontWeight: 500,
            px: 1.5,
            py: 0.75,
            "&:hover": {
              border: "1px solid #DADCE0",
              bgcolor: "#F1F3F4",
              color: "#1F1F1F",
            },
          }}
        >
          Back to project
        </Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 4 }}>
        {/* Left — Preview */}
        <Box>
          <Box
            sx={{
              overflow: "hidden",
              borderRadius: "12px",
              background: gradient,
            }}
          >
            <Box
              sx={{
                display: "flex",
                height: 320,
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 5,
                textAlign: "center",
                color: "white",
              }}
            >
              <Box component="span" sx={{ fontSize: "3rem", opacity: 0.4 }}>{icon}</Box>
              <Typography sx={{ mt: 3, fontSize: "1.5rem", fontWeight: 700 }}>
                {(content.headline as string) || artifact.name}
              </Typography>
              {content.message ? (
                <Typography sx={{ mt: 1.5, maxWidth: 400, fontSize: "0.875rem", opacity: 0.8 }}>
                  {String(content.message)}
                </Typography>
              ) : null}
              <Typography sx={{ mt: 2, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.5 }}>
                {String(content.product || "")} · {artifact.type.replace("_", " ")} · {artifact.format || ""}
              </Typography>
            </Box>
          </Box>

          {/* Reel storyboard frames */}
          {artifact.type === "reel" && Array.isArray(content.frames) && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ mb: 1.5, fontSize: "0.875rem", fontWeight: 600, color: "#484848" }}>
                Storyboard — {(content.frames as unknown[]).length} frames
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                {(content.frames as Array<{ frame_number: number; text_overlay: string; duration_seconds: number; visual_description: string }>).map((frame, i) => (
                  <Box
                    key={i}
                    sx={{
                      borderRadius: "12px",
                      border: "1px solid #EBEBEB",
                      bgcolor: "#FFFFFF",
                      p: 2,
                    }}
                  >
                    <Box sx={{ mb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: "0.75rem", color: "#B0B0B0" }}>
                        Frame {frame.frame_number}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "#B0B0B0" }}>
                        {frame.duration_seconds}s
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#222222" }}>
                      {frame.text_overlay}
                    </Typography>
                    <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#717171" }}>
                      {frame.visual_description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Right — Details + Edit */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Header card */}
          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #F0F0F0",
              bgcolor: "#FFFFFF",
              p: 3,
            }}
          >
            <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#222222" }}>
                {artifact.name}
              </Typography>
              <ComplianceBadge score={artifact.compliance_score} />
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Box
                component="span"
                sx={{
                  borderRadius: 9999,
                  bgcolor: "#F7F7F7",
                  px: 1.5,
                  py: 0.5,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: "#484848",
                }}
              >
                {artifact.type.replace("_", " ")}
              </Box>
              {artifact.channel && (
                <Box
                  component="span"
                  sx={{
                    borderRadius: 9999,
                    bgcolor: "#EFF6FF",
                    px: 1.5,
                    py: 0.5,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#1D4ED8",
                  }}
                >
                  {artifact.channel}
                </Box>
              )}
              {artifact.format && (
                <Box
                  component="span"
                  sx={{
                    borderRadius: 9999,
                    bgcolor: "#F5F3FF",
                    px: 1.5,
                    py: 0.5,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#6D28D9",
                  }}
                >
                  {artifact.format}
                </Box>
              )}
              <Box
                component="span"
                sx={{
                  borderRadius: 9999,
                  px: 1.5,
                  py: 0.5,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  ...(artifact.status === "draft"
                    ? { bgcolor: "#F7F7F7", color: "#717171" }
                    : artifact.status === "ready"
                      ? { bgcolor: "#F0FFF0", color: "#008A05" }
                      : { bgcolor: "#FFFBEB", color: "#B45309" }),
                }}
              >
                {artifact.status}
              </Box>
            </Box>
            <Typography sx={{ mt: 1.5, fontSize: "0.75rem", color: "#B0B0B0" }}>
              Created by {artifact.creator.name} · v{artifact.version}
            </Typography>
          </Box>

          {/* Editable fields card */}
          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #F0F0F0",
              bgcolor: "#FFFFFF",
              p: 3,
            }}
          >
            <Typography sx={{ mb: 2, fontSize: "0.875rem", fontWeight: 600, color: "#484848" }}>
              Content
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Object.entries(content)
                .filter(([key]) => !["locks", "remixed_from", "frames", "formats", "type", "format"].includes(key))
                .map(([key, value]) => {
                  const locked = isLocked(key);
                  return (
                    <Box key={key}>
                      <Box sx={{ mb: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "#B0B0B0" }}>
                          {key.replace(/_/g, " ")}
                        </Typography>
                        {locked && (
                          <Typography sx={{ fontSize: "10px", color: "#B0B0B0" }}>🔒 Locked</Typography>
                        )}
                      </Box>
                      {editingField === key && !locked ? (
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <TextField
                            size="small"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            sx={{
                              flex: 1,
                              "& .MuiOutlinedInput-root": {
                                fontSize: "0.875rem",
                                "& fieldset": { borderColor: "#DDDDDD" },
                                "&:hover fieldset": { borderColor: "#AAAAAA" },
                                "&.Mui-focused fieldset": { borderColor: "#222222", borderWidth: 1 },
                              },
                            }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleSaveField(key, editValue)}
                            disableElevation
                            sx={{
                              borderRadius: "8px",
                              textTransform: "none",
                              bgcolor: "#D0103A",
                              color: "white",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              px: 1.5,
                              "&:hover": { bgcolor: "#B80E33" },
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => setEditingField(null)}
                            sx={{
                              borderRadius: "8px",
                              textTransform: "none",
                              bgcolor: "#F7F7F7",
                              color: "#717171",
                              fontSize: "0.75rem",
                              px: 1.5,
                              "&:hover": { bgcolor: "#EEEEEE" },
                            }}
                          >
                            Cancel
                          </Button>
                        </Box>
                      ) : (
                        <Box
                          component="button"
                          onClick={() => {
                            if (!locked) {
                              setEditingField(key);
                              setEditValue(String(value));
                            }
                          }}
                          disabled={locked}
                          sx={{
                            width: "100%",
                            borderRadius: "8px",
                            border: "1px solid",
                            px: 1.5,
                            py: 1,
                            textAlign: "left",
                            fontSize: "0.875rem",
                            transition: "border-color 0.15s, background-color 0.15s",
                            cursor: locked ? "not-allowed" : "pointer",
                            ...(locked
                              ? {
                                  borderColor: "#F7F7F7",
                                  bgcolor: "#F7F7F7",
                                  color: "#B0B0B0",
                                }
                              : {
                                  borderColor: "#EBEBEB",
                                  bgcolor: "#FFFFFF",
                                  color: "#484848",
                                  "&:hover": { borderColor: "#DDDDDD" },
                                }),
                          }}
                        >
                          {String(value)}
                        </Box>
                      )}
                    </Box>
                  );
                })}
            </Box>
          </Box>

          {/* Export button */}
          <Button
            variant="contained"
            onClick={() => setShowExport(true)}
            disableElevation
            fullWidth
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "white",
              fontWeight: 600,
              fontSize: "1rem",
              py: 1.5,
              "&:hover": { bgcolor: "#B80E33" },
            }}
          >
            Export artifact →
          </Button>

          {/* Comments card */}
          <Box
            sx={{
              borderRadius: "16px",
              border: "1px solid #F0F0F0",
              bgcolor: "#FFFFFF",
              p: 3,
            }}
          >
            <CommentThread
              artifactId={artifact.id}
              canComment={canComment}
            />
          </Box>
        </Box>
      </Box>

      {/* Export dialog */}
      {showExport && (
        <ExportDialog
          artifactId={artifact.id}
          artifactType={artifact.type}
          artifactName={artifact.name}
          complianceScore={artifact.compliance_score}
          onClose={() => setShowExport(false)}
        />
      )}
    </Box>
  );
}
