"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVideoWizard } from "../layout";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { fetchArtifactDetail, updateArtifact } from "@/lib/api/artifacts";
import { draftBrief, improveBriefField } from "@/lib/api/video-sessions";
import type { BriefImproveRequest } from "@/lib/api/video-sessions";
import { AiAssistChip } from "@/components/poster-wizard/shared/ai-assist-chip";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "inspirational", label: "Inspirational" },
  { value: "energetic", label: "Energetic" },
  { value: "empathetic", label: "Empathetic" },
] as const;

type ToneValue = (typeof TONES)[number]["value"];
type ImprovableField = BriefImproveRequest["field"];

const FIELD_LABELS: Record<ImprovableField, string> = {
  key_message: "Key message",
  target_audience: "Target audience",
  cta_text: "Call to action",
  video_brief: "Video brief",
};

export default function BriefStepPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();
  const { videoSession, refreshSession } = useVideoWizard();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState<ToneValue>("professional");
  const [ctaText, setCtaText] = useState("");
  const [videoBrief, setVideoBrief] = useState("");

  // Which field is currently being AI-improved (null = none)
  const [fieldLoading, setFieldLoading] = useState<ImprovableField | null>(null);
  const [isDraftingAll, setIsDraftingAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!artifactId) return;
    fetchArtifactDetail(artifactId)
      .then((art) => {
        const vsId = art.video_session_id;
        setSessionId(vsId ?? null);
        setTitle(art.name ?? "");

        const c = (art.content ?? {}) as Record<string, unknown>;
        if (c.key_message) setKeyMessage(String(c.key_message));
        if (c.target_audience) setTargetAudience(String(c.target_audience));
        if (c.tone) setTone((c.tone as ToneValue) ?? "professional");
        if (c.cta_text) setCtaText(String(c.cta_text));
        if (c.video_brief) setVideoBrief(String(c.video_brief));
      })
      .catch(() => router.push(`/projects/${projectId}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId, projectId]);

  // Build the context payload used for all AI calls
  const buildContext = () => ({
    title,
    key_message: keyMessage,
    target_audience: targetAudience,
    tone,
    cta_text: ctaText,
    video_brief: videoBrief,
  });

  // Improve a specific field with AI
  const handleImproveField = async (field: ImprovableField) => {
    const sid = sessionId ?? videoSession?.id;
    if (!sid) return;
    setFieldLoading(field);
    setError("");
    try {
      const result = await improveBriefField(sid, { field, ...buildContext() });
      if (field === "key_message") setKeyMessage(result.value);
      else if (field === "target_audience") setTargetAudience(result.value);
      else if (field === "cta_text") setCtaText(result.value);
      else if (field === "video_brief") setVideoBrief(result.value);
    } catch {
      setError(`AI improvement failed for ${FIELD_LABELS[field]}. Please try again.`);
    } finally {
      setFieldLoading(null);
    }
  };

  // AI-draft all fields from project context (the "AI Generate Brief" top-level button)
  const handleDraftAll = async () => {
    const sid = sessionId ?? videoSession?.id;
    if (!sid) return;
    setIsDraftingAll(true);
    setError("");
    try {
      const result = await draftBrief(sid);
      setKeyMessage(result.key_message);
      setTargetAudience(result.target_audience);
      setTone((result.tone as ToneValue) ?? "professional");
      setCtaText(result.cta_text);
    } catch {
      setError("AI brief generation failed. Please try again.");
    } finally {
      setIsDraftingAll(false);
    }
  };

  const handleContinue = async () => {
    if (!artifactId) return;
    setIsSaving(true);
    setError("");
    try {
      const art = await fetchArtifactDetail(artifactId);
      const existingContent = (art.content ?? {}) as Record<string, unknown>;
      await updateArtifact(artifactId, {
        name: title,
        content: {
          ...existingContent,
          key_message: keyMessage,
          target_audience: targetAudience,
          tone,
          cta_text: ctaText,
          video_brief: videoBrief,
        },
      });
      await refreshSession();
      router.push(`/projects/${projectId}/artifacts/${artifactId}/video/presenter`);
    } catch {
      setError("Failed to save brief. Please try again.");
      setIsSaving(false);
    }
  };

  // Shared TextField styles
  const textFieldSx = {
    "& .MuiOutlinedInput-root": {
      fontSize: "0.9375rem",
      "& fieldset": { borderColor: "#E5E5E5" },
      "&:hover fieldset": { borderColor: "#ABABAB" },
      "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
    },
  };

  const FieldLabel = ({
    label,
    field,
  }: {
    label: string;
    field: ImprovableField;
  }) => (
    <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#484848" }}>
        {label}
      </Typography>
      <AiAssistChip
        loading={fieldLoading === field}
        onClick={() => handleImproveField(field)}
      >
        + AI
      </AiAssistChip>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 860 }}>
      {/* Heading + AI Generate all */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Define your video brief
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set the direction for your video. All fields feed into the AI script and scene generation.
          </Typography>
        </Box>
        <AiAssistChip
          onClick={handleDraftAll}
          loading={isDraftingAll}
          disabled={!(sessionId ?? videoSession?.id)}
          size="md"
        >
          {isDraftingAll ? "Generating…" : "AI Generate Brief"}
        </AiAssistChip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Video title */}
        <Box>
          <Typography sx={{ mb: 0.75, fontSize: "0.875rem", fontWeight: 600, color: "#484848" }}>
            Video title
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. AIA HealthShield Gold Max — Protection Explained"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={textFieldSx}
          />
        </Box>

        {/* Key message */}
        <Box>
          <FieldLabel label="Key message" field="key_message" />
          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder="What's the main thing viewers should take away?"
            value={keyMessage}
            onChange={(e) => setKeyMessage(e.target.value)}
            sx={textFieldSx}
          />
        </Box>

        {/* Target audience */}
        <Box>
          <FieldLabel label="Target audience" field="target_audience" />
          <TextField
            fullWidth
            size="small"
            placeholder="Who is this video for?"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            sx={textFieldSx}
          />
        </Box>

        {/* Tone */}
        <Box>
          <Typography sx={{ mb: 1, fontSize: "0.875rem", fontWeight: 600, color: "#484848" }}>
            Tone
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {TONES.map((t) => {
              const isSelected = tone === t.value;
              return (
                <Box
                  key={t.value}
                  component="button"
                  onClick={() => setTone(t.value)}
                  sx={{
                    px: 2,
                    py: 0.75,
                    borderRadius: "9999px",
                    border: "1.5px solid",
                    borderColor: isSelected ? "#D0103A" : "#E5E5E5",
                    bgcolor: isSelected ? "#D0103A" : "#FFFFFF",
                    color: isSelected ? "#FFFFFF" : "#484848",
                    fontSize: "0.875rem",
                    fontWeight: isSelected ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    "&:hover": {
                      borderColor: "#D0103A",
                      bgcolor: isSelected ? "#A00D2E" : "#FFF1F4",
                      color: isSelected ? "#FFFFFF" : "#D0103A",
                    },
                  }}
                >
                  {t.label}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* CTA text */}
        <Box>
          <FieldLabel label="Call to action" field="cta_text" />
          <TextField
            fullWidth
            size="small"
            placeholder="What should viewers do after watching?"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            sx={textFieldSx}
          />
        </Box>

        {/* Divider */}
        <Box sx={{ borderTop: "1px solid #F0F0F0", pt: 1 }} />

        {/* Video brief — narrative summary */}
        <Box>
          <FieldLabel label="Video brief" field="video_brief" />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            A narrative summary used as context throughout script and scene generation. Leave blank to skip, or let AI build it from your inputs above.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Describe the purpose, audience, and direction of this video in a few sentences…"
            value={videoBrief}
            onChange={(e) => setVideoBrief(e.target.value)}
            sx={textFieldSx}
          />
        </Box>
      </Box>

      {/* Bottom actions */}
      <Box
        sx={{
          mt: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
        }}
      >
        <Button
          variant="contained"
          disabled={isSaving || !keyMessage.trim()}
          onClick={handleContinue}
          startIcon={isSaving ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
          sx={{
            textTransform: "none",
            bgcolor: "#D0103A",
            color: "white",
            fontWeight: 600,
            px: 4,
            py: 1.25,
            borderRadius: 2,
            "&:hover": { bgcolor: "#A00D2E" },
            "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
          }}
        >
          {isSaving ? "Saving…" : "Continue to Presenter"}
        </Button>
      </Box>
    </Box>
  );
}
