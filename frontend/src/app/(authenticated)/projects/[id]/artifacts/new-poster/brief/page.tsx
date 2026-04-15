"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { AiAssistChip } from "@/components/poster-wizard/shared/ai-assist-chip";
import { generateBrief, improveBriefField } from "@/lib/api/poster-wizard";
import type { BriefImproveField } from "@/lib/api/poster-wizard";
import { updateArtifact } from "@/lib/api/artifacts";
import { usePosterWizard } from "../layout";
import type { CampaignObjective, PosterTone } from "@/types/poster-wizard";

// ── Options ───────────────────────────────────────────────────────────────────

const OBJECTIVES: { key: CampaignObjective; label: string }[] = [
  { key: "PRODUCT_LAUNCH", label: "Product launch" },
  { key: "BRAND_AWARENESS", label: "Brand awareness" },
  { key: "SEASONAL_PROMOTION", label: "Seasonal promotion" },
  { key: "AGENT_ENABLEMENT", label: "Agent enablement" },
  { key: "CUSTOMER_RETENTION", label: "Customer retention" },
];

const TONES: { key: PosterTone; label: string }[] = [
  { key: "PROFESSIONAL", label: "Professional" },
  { key: "INSPIRATIONAL", label: "Inspirational" },
  { key: "WARM", label: "Warm" },
  { key: "URGENT", label: "Urgent" },
  { key: "EMPATHETIC", label: "Empathetic" },
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.9375rem",
    "& fieldset": { borderColor: "#E5E5E5" },
    "&:hover fieldset": { borderColor: "#ABABAB" },
    "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosterBriefPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { brief, setBrief, artifactId, isSaving, setIsSaving, getContentPayload } = usePosterWizard();

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [fieldLoading, setFieldLoading] = useState<BriefImproveField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const handleImproveField = async (field: BriefImproveField) => {
    setFieldLoading(field);
    setError(null);
    try {
      const { value } = await improveBriefField({
        field,
        title: brief.title,
        campaign_objective: brief.campaign_objective,
        target_audience: brief.target_audience,
        tone: brief.tone,
        call_to_action: brief.call_to_action,
        narrative: brief.narrative,
      });
      if (field === "title") setBrief({ title: value });
      else if (field === "target_audience") setBrief({ target_audience: value });
      else if (field === "call_to_action") setBrief({ call_to_action: value });
    } catch {
      setError("AI suggestion failed. Please try again.");
    } finally {
      setFieldLoading(null);
    }
  };

  const hasNarrative = brief.narrative.trim().length > 0;

  // ── AI brief generation ─────────────────────────────────────────────────────

  const canGenerate =
    !!brief.campaign_objective &&
    brief.target_audience.trim().length > 0 &&
    !!brief.tone &&
    brief.call_to_action.trim().length > 0;

  const doGenerate = async () => {
    setIsAiLoading(true);
    setError(null);
    try {
      const result = await generateBrief({
        campaign_objective: brief.campaign_objective as CampaignObjective,
        target_audience: brief.target_audience,
        tone: brief.tone as PosterTone,
        call_to_action: brief.call_to_action,
        existing_brief: brief.narrative || undefined,
      });
      setBrief({ narrative: result.brief });
    } catch {
      setBrief({
        narrative:
          "This campaign aims to connect with our target audience on an emotional level, " +
          "highlighting the peace of mind that comes with comprehensive AIA coverage. " +
          "Through warm, relatable imagery and clear benefit communication, we will " +
          "inspire confidence in financial protection and motivate action.",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiGenerate = () => {
    if (!canGenerate) {
      setError("Fill in objective, audience, tone, and CTA first — AI uses those as context.");
      return;
    }
    if (hasNarrative) {
      setShowRegenerateConfirm(true);
    } else {
      doGenerate();
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────────

  const isValid =
    brief.title.trim().length > 0 &&
    brief.campaign_objective !== "" &&
    brief.target_audience.trim().length > 0 &&
    brief.tone !== "" &&
    brief.call_to_action.trim().length > 0;

  // ── Continue ─────────────────────────────────────────────────────────────────

  const handleContinue = async () => {
    if (!artifactId || !isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      const trimmedTitle = brief.title.trim();
      await updateArtifact(artifactId, {
        content: getContentPayload(),
        ...(trimmedTitle && { name: trimmedTitle }),
      });
      router.push(`/projects/${projectId}/artifacts/new-poster/subject`);
    } catch (err: unknown) {
      const apiErr = err as { detail?: unknown; status?: number };
      console.error("[Poster Step 1] Save failed:", apiErr.status, apiErr.detail ?? err);
      const statusHint = apiErr.status ? ` (${apiErr.status})` : "";
      setError(`Failed to save${statusHint}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Chip selector ─────────────────────────────────────────────────────────

  function ChipSelector<T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { key: T; label: string }[];
    value: T | "";
    onChange: (v: T) => void;
  }) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {options.map((opt) => {
          const isSelected = value === opt.key;
          return (
            <Box
              key={opt.key}
              component="button"
              onClick={() => onChange(opt.key)}
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
                },
              }}
            >
              {opt.label}
            </Box>
          );
        })}
      </Box>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        borderRadius: "16px",
        border: "1px solid #E8EAED",
        bgcolor: "#FFFFFF",
        p: 4,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: "22px", fontWeight: 700, color: "#1F1F1F" }}>
            Campaign brief
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#5F6368" }}>
            Define your campaign goals. This context shapes all AI-generated content in later steps.
          </Typography>
        </Box>
        <AiAssistChip onClick={handleAiGenerate} loading={isAiLoading} disabled={!canGenerate}>
          {hasNarrative ? "Regenerate brief" : "AI generate brief"}
        </AiAssistChip>
      </Box>

      {/* Fields */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Campaign title */}
        <Box>
          <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Campaign title <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <AiAssistChip
              onClick={() => handleImproveField("title")}
              loading={fieldLoading === "title"}
            >
              + AI
            </AiAssistChip>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Life Shield 2026 Q1 Push"
            value={brief.title}
            onChange={(e) => setBrief({ title: e.target.value })}
            sx={textFieldSx}
          />
        </Box>

        {/* Campaign objective */}
        <Box>
          <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Campaign objective <span style={{ color: "#D0103A" }}>*</span>
          </Typography>
          <ChipSelector
            options={OBJECTIVES}
            value={brief.campaign_objective}
            onChange={(v) => setBrief({ campaign_objective: v })}
          />
        </Box>

        {/* Target audience */}
        <Box>
          <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Target audience <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <AiAssistChip
              onClick={() => handleImproveField("target_audience")}
              loading={fieldLoading === "target_audience"}
            >
              + AI
            </AiAssistChip>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Working professionals aged 30–45 with young families"
            value={brief.target_audience}
            onChange={(e) => setBrief({ target_audience: e.target.value })}
            sx={textFieldSx}
          />
        </Box>

        {/* Tone */}
        <Box>
          <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Tone <span style={{ color: "#D0103A" }}>*</span>
          </Typography>
          <ChipSelector
            options={TONES}
            value={brief.tone}
            onChange={(v) => setBrief({ tone: v })}
          />
        </Box>

        {/* Call to action */}
        <Box>
          <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Call to action <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <AiAssistChip
              onClick={() => handleImproveField("call_to_action")}
              loading={fieldLoading === "call_to_action"}
            >
              + AI
            </AiAssistChip>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Get your free quote today"
            value={brief.call_to_action}
            onChange={(e) => setBrief({ call_to_action: e.target.value })}
            sx={textFieldSx}
          />
        </Box>

        {/* Narrative */}
        <Box>
          <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Narrative summary
            </Typography>
            <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>
              {brief.narrative.length} / 1500
            </Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            placeholder="Describe the campaign story and emotional angle (or click AI generate brief above)."
            value={brief.narrative}
            onChange={(e) => {
              if (e.target.value.length <= 1500) setBrief({ narrative: e.target.value });
            }}
            sx={textFieldSx}
          />
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Typography sx={{ mt: 2, fontSize: "13px", color: "#D0103A" }}>{error}</Typography>
      )}

      {/* Regenerate confirm modal */}
      <Dialog
        open={showRegenerateConfirm}
        onClose={() => setShowRegenerateConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "16px", fontWeight: 700, color: "#1F1F1F" }}>
          Overwrite current brief?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "14px", color: "#5F6368" }}>
            The existing narrative summary will be replaced with a new AI-generated brief.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setShowRegenerateConfirm(false)}
            variant="outlined"
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#E8EAED",
              color: "#5F6368",
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowRegenerateConfirm(false);
              doGenerate();
            }}
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 2,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "white",
              fontWeight: 600,
              "&:hover": { bgcolor: "#A00D2E" },
            }}
          >
            Overwrite &amp; regenerate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disabled={!isValid || isSaving}
          onClick={handleContinue}
          startIcon={isSaving ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
          disableElevation
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
          {isSaving ? "Saving…" : "Continue"}
        </Button>
      </Box>
    </Box>
  );
}
