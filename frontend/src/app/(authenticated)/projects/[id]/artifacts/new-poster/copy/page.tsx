"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { AiAssistChip } from "@/components/poster-wizard/shared/ai-assist-chip";
import { FieldComplianceWarning } from "@/components/poster-wizard/shared/field-compliance-warning";
import { useFieldCompliance } from "@/hooks/use-field-compliance";
import { copyDraftAll, copyDraftField, toneRewrite } from "@/lib/api/poster-wizard";
import { updateArtifact } from "@/lib/api/artifacts";
import { usePosterWizard } from "../layout";
import type { CampaignObjective, ComplianceFlag, PosterCopyContent, PosterTone } from "@/types/poster-wizard";

// ── Optimal word ranges ───────────────────────────────────────────────────────

const OPTIMAL: Record<string, { min: number; max: number } | null> = {
  headline: { min: 5, max: 8 },
  subheadline: { min: 10, max: 15 },
  cta_text: { min: 3, max: 6 },
  body: { min: 20, max: 35 },
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Tone rewrite options ───────────────────────────────────────────────────────

const TONE_OPTIONS: { key: "SHARPER" | "WARMER" | "MORE_URGENT" | "SHORTER"; label: string }[] = [
  { key: "SHARPER", label: "Sharper" },
  { key: "WARMER", label: "Warmer" },
  { key: "MORE_URGENT", label: "More urgent" },
  { key: "SHORTER", label: "Shorter" },
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

// ── FieldRow (receives pre-computed compliance flags as props) ─────────────────

function FieldRow({
  fieldKey,
  label,
  required,
  multiline,
  maxLength,
  placeholder,
  value,
  onChange,
  aiEnabled,
  complianceFlags,
  onComplianceDismiss,
  fieldLoading,
  brief,
  handleDraftField,
}: {
  fieldKey?: "headline" | "subheadline" | "body" | "cta_text";
  label: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  aiEnabled?: boolean;
  complianceFlags?: import("@/lib/api/poster-wizard").ComplianceFlag[];
  onComplianceDismiss?: (flag: import("@/lib/api/poster-wizard").ComplianceFlag) => void;
  fieldLoading: Record<string, boolean>;
  brief: { title: string; narrative: string };
  handleDraftField: (field: "headline" | "subheadline" | "body" | "cta_text") => void;
}) {
  const optimal = fieldKey ? OPTIMAL[fieldKey] : null;
  const wc = wordCount(value);
  const isOutsideOptimal = optimal && value.trim().length > 0 && (wc < optimal.min || wc > optimal.max);
  const isFieldAiLoading = fieldKey ? fieldLoading[fieldKey] : false;

  return (
    <Box>
      <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            {label} {required && <span style={{ color: "#D0103A" }}>*</span>}
          </Typography>
          {optimal && (
            <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>
              {optimal.min}–{optimal.max} words
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {maxLength && (
            <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>
              {value.length} / {maxLength}
            </Typography>
          )}
          {aiEnabled && fieldKey && (
            <AiAssistChip
              onClick={() => handleDraftField(fieldKey)}
              loading={isFieldAiLoading}
              disabled={!brief.title && !brief.narrative}
            >
              + AI
            </AiAssistChip>
          )}
        </Box>
      </Box>
      <TextField
        fullWidth
        size="small"
        multiline={multiline}
        minRows={multiline ? 3 : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (!maxLength || v.length <= maxLength) onChange(v);
        }}
        sx={textFieldSx}
      />
      {isOutsideOptimal && (
        <Typography sx={{ mt: 0.5, fontSize: "11px", color: "#B45309" }}>
          {wc} word{wc !== 1 ? "s" : ""} — optimal range is {optimal!.min}–{optimal!.max}
        </Typography>
      )}
      {complianceFlags && complianceFlags.length > 0 && (
        <FieldComplianceWarning flags={complianceFlags} onDismiss={onComplianceDismiss} />
      )}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosterCopyPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { copy, setCopy, brief, artifactId, isSaving, setIsSaving, getContentPayload } =
    usePosterWizard();

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [isToneLoading, setIsToneLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo state for tone rewrite
  const [undoSnapshot, setUndoSnapshot] = useState<Pick<
    PosterCopyContent,
    "headline" | "subheadline" | "body" | "cta_text"
  > | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  // ── Per-field compliance (hooks must be called unconditionally at top level) ──

  const headlineCompliance = useFieldCompliance({
    field: "headline",
    text: copy.headline,
    tone: brief.tone,
  });

  const subheadlineCompliance = useFieldCompliance({
    field: "subheadline",
    text: copy.subheadline,
    tone: brief.tone,
  });

  const bodyCompliance = useFieldCompliance({
    field: "body",
    text: copy.body,
    tone: brief.tone,
  });

  const ctaCompliance = useFieldCompliance({
    field: "cta_text",
    text: copy.cta_text,
    tone: brief.tone,
  });

  const totalFlagCount =
    headlineCompliance.totalFlagCount +
    subheadlineCompliance.totalFlagCount +
    bodyCompliance.totalFlagCount +
    ctaCompliance.totalFlagCount;

  // ── AI draft all ──────────────────────────────────────────────────────────────

  const handleAiDraftAll = async () => {
    if (!brief.narrative && !brief.campaign_objective) {
      setError("Complete Step 1 (Brief) first to give AI context.");
      return;
    }
    setIsAiLoading(true);
    setError(null);
    try {
      const result = await copyDraftAll({
        brief: brief.narrative || brief.target_audience || brief.title,
        tone: (brief.tone as PosterTone) || "PROFESSIONAL",
        campaign_objective: (brief.campaign_objective as CampaignObjective) || "BRAND_AWARENESS",
        audience: brief.target_audience || undefined,
      });
      setCopy({
        headline: result.headline,
        subheadline: result.subheadline,
        body: result.body,
        cta_text: result.cta_text,
      });
    } catch {
      setCopy({
        headline: "Protect What Matters Most",
        subheadline: "Comprehensive coverage for Singapore families",
        body: `${brief.title || "AIA Singapore"} gives your family peace of mind with flexible, comprehensive coverage designed for every stage of life.`,
        cta_text: brief.call_to_action || "Get Your Free Quote",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // ── Per-field AI ──────────────────────────────────────────────────────────────

  const handleDraftField = useCallback(
    async (field: "headline" | "subheadline" | "body" | "cta_text") => {
      setFieldLoading((prev) => ({ ...prev, [field]: true }));
      setError(null);
      try {
        const result = await copyDraftField({
          field,
          brief: brief.narrative || brief.title || "",
          tone: (brief.tone as PosterTone) || "PROFESSIONAL",
          current_values: {
            headline: copy.headline,
            subheadline: copy.subheadline,
            body: copy.body,
            cta_text: copy.cta_text,
          },
        });
        setCopy({ [field]: result.value });
      } catch {
        setError(`Could not draft ${field.replace("_", " ")}. Please try again.`);
      } finally {
        setFieldLoading((prev) => ({ ...prev, [field]: false }));
      }
    },
    [brief, copy, setCopy],
  );

  // ── Tone rewrite ──────────────────────────────────────────────────────────────

  const handleToneRewrite = async (tone: "SHARPER" | "WARMER" | "MORE_URGENT" | "SHORTER") => {
    setIsToneLoading(true);
    setError(null);
    const snapshot = {
      headline: copy.headline,
      subheadline: copy.subheadline,
      body: copy.body,
      cta_text: copy.cta_text,
    };
    try {
      const result = await toneRewrite({
        rewrite_tone: tone,
        current_copy: {
          headline: copy.headline,
          subheadline: copy.subheadline,
          body: copy.body,
          cta_text: copy.cta_text,
        },
      });
      setCopy(result.rewritten);
      setUndoSnapshot(snapshot);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), 60_000);
    } catch {
      setError("Tone rewrite failed. Please try again.");
    } finally {
      setIsToneLoading(false);
    }
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    setCopy(undoSnapshot);
    setUndoSnapshot(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  // ── Validation ────────────────────────────────────────────────────────────────

  const isValid = copy.headline.trim().length > 0 && copy.cta_text.trim().length > 0;

  // ── Navigation ────────────────────────────────────────────────────────────────

  const handleBack = () => {
    router.push(`/projects/${projectId}/artifacts/new-poster/subject`);
  };

  const handleContinue = async () => {
    if (!artifactId || !isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateArtifact(artifactId, { content: getContentPayload() });
      router.push(`/projects/${projectId}/artifacts/new-poster/compose`);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const sharedFieldProps = { fieldLoading, brief, handleDraftField };

  return (
    <Box sx={{ borderRadius: "16px", border: "1px solid #E8EAED", bgcolor: "#FFFFFF", p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: "22px", fontWeight: 700, color: "#1F1F1F" }}>
              Poster copy
            </Typography>
            {/* Compliance flag count badge */}
            {totalFlagCount > 0 && (
              <Box
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: "9999px",
                  bgcolor: "#FFFBEB",
                  border: "1px solid #F59F00",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#B45309",
                }}
              >
                {totalFlagCount} compliance {totalFlagCount === 1 ? "flag" : "flags"}
              </Box>
            )}
          </Box>
          <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#5F6368" }}>
            Write the text that appears on the poster. Required fields are marked with{" "}
            <span style={{ color: "#D0103A" }}>*</span>.
          </Typography>
        </Box>
        <AiAssistChip onClick={handleAiDraftAll} loading={isAiLoading}>
          Draft all from brief
        </AiAssistChip>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <FieldRow
          {...sharedFieldProps}
          fieldKey="headline"
          label="Headline"
          required
          maxLength={80}
          placeholder="e.g. Protect What Matters Most"
          value={copy.headline}
          onChange={(v) => setCopy({ headline: v })}
          aiEnabled
          complianceFlags={headlineCompliance.visibleFlags}
          onComplianceDismiss={headlineCompliance.dismiss}
        />
        <FieldRow
          {...sharedFieldProps}
          fieldKey="subheadline"
          label="Subheadline"
          maxLength={120}
          placeholder="e.g. Comprehensive coverage for Singapore families"
          value={copy.subheadline}
          onChange={(v) => setCopy({ subheadline: v })}
          aiEnabled
          complianceFlags={subheadlineCompliance.visibleFlags}
          onComplianceDismiss={subheadlineCompliance.dismiss}
        />
        <FieldRow
          {...sharedFieldProps}
          fieldKey="body"
          label="Body copy"
          multiline
          maxLength={300}
          placeholder="Supporting paragraph — key product benefits and emotional hook."
          value={copy.body}
          onChange={(v) => setCopy({ body: v })}
          aiEnabled
          complianceFlags={bodyCompliance.visibleFlags}
          onComplianceDismiss={bodyCompliance.dismiss}
        />
        <FieldRow
          {...sharedFieldProps}
          fieldKey="cta_text"
          label="CTA text"
          required
          maxLength={40}
          placeholder="e.g. Get Your Free Quote"
          value={copy.cta_text}
          onChange={(v) => setCopy({ cta_text: v })}
          aiEnabled
          complianceFlags={ctaCompliance.visibleFlags}
          onComplianceDismiss={ctaCompliance.dismiss}
        />
        <FieldRow
          {...sharedFieldProps}
          label="Brand tagline"
          maxLength={80}
          placeholder="e.g. Healthier, Longer, Better Lives"
          value={copy.brand_tagline}
          onChange={(v) => setCopy({ brand_tagline: v })}
        />
        <FieldRow
          {...sharedFieldProps}
          label="Regulatory disclaimer"
          multiline
          maxLength={500}
          placeholder="MAS-required disclaimer text (appears in small print at the bottom of the poster)."
          value={copy.regulatory_disclaimer}
          onChange={(v) => setCopy({ regulatory_disclaimer: v })}
        />
      </Box>

      {/* Tone rewrite bar */}
      <Box sx={{ mt: 3, p: 2, borderRadius: "10px", bgcolor: "#F7F7F7", border: "1px solid #E8EAED" }}>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#5F6368" }}>
              Rewrite tone:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {TONE_OPTIONS.map((opt) => (
                <Box
                  key={opt.key}
                  component="button"
                  disabled={isToneLoading}
                  onClick={() => handleToneRewrite(opt.key)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: "9999px",
                    border: "1px solid #DADCE0",
                    bgcolor: "#FFFFFF",
                    color: "#484848",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: isToneLoading ? "not-allowed" : "pointer",
                    opacity: isToneLoading ? 0.6 : 1,
                    transition: "all 0.15s",
                    "&:hover:not(:disabled)": { borderColor: "#D0103A", color: "#D0103A", bgcolor: "#FFF1F4" },
                  }}
                >
                  {isToneLoading ? (
                    <CircularProgress size={10} sx={{ color: "#D0103A" }} />
                  ) : (
                    opt.label
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          {undoSnapshot && (
            <Box
              component="button"
              onClick={handleUndo}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: "9999px",
                border: "1px solid #D0103A",
                bgcolor: "transparent",
                color: "#D0103A",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                "&:hover": { bgcolor: "#FFF1F4" },
              }}
            >
              ↩ Undo rewrite
            </Box>
          )}
        </Box>
      </Box>

      {error && (
        <Typography sx={{ mt: 2, fontSize: "13px", color: "#D0103A" }}>{error}</Typography>
      )}

      {/* Footer */}
      <Box sx={{ mt: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
        >
          Back
        </Button>
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
