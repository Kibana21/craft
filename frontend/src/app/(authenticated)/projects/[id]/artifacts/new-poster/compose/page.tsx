"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { AiAssistChip } from "@/components/poster-wizard/shared/ai-assist-chip";
import { generateCompositionPrompt } from "@/lib/api/poster-wizard";
import { usePosterWizard } from "../layout";
import { updateArtifact } from "@/lib/api/artifacts";
import type { CompositionFormat, LayoutTemplate, PosterTone, VisualStyle } from "@/types/poster-wizard";

// ── Options ───────────────────────────────────────────────────────────────────

const FORMATS: { key: CompositionFormat; label: string; desc: string; ratio: string }[] = [
  { key: "PORTRAIT", label: "Portrait", desc: "A4 / 4:5", ratio: "4:5" },
  { key: "SQUARE", label: "Square", desc: "1:1 · Instagram", ratio: "1:1" },
  { key: "LANDSCAPE", label: "Landscape", desc: "16:9 · Display", ratio: "16:9" },
  { key: "STORY", label: "Story", desc: "9:16 · Stories", ratio: "9:16" },
];

const LAYOUTS: { key: LayoutTemplate; label: string; desc: string }[] = [
  { key: "HERO_DOMINANT", label: "Hero dominant", desc: "Large visual, small copy zone" },
  { key: "SPLIT", label: "Split", desc: "50/50 visual and copy" },
  { key: "FRAME_BORDER", label: "Frame / border", desc: "Content within a decorative frame" },
  { key: "TYPOGRAPHIC", label: "Typographic", desc: "Copy-led, minimal image" },
  { key: "FULL_BLEED", label: "Full bleed", desc: "Image edge-to-edge, copy overlaid" },
];

const STYLES: { key: VisualStyle; label: string }[] = [
  { key: "CLEAN_CORPORATE", label: "Clean corporate" },
  { key: "WARM_HUMAN", label: "Warm & human" },
  { key: "BOLD_HIGH_CONTRAST", label: "Bold / high contrast" },
  { key: "SOFT_ASPIRATIONAL", label: "Soft aspirational" },
  { key: "DARK_PREMIUM", label: "Dark premium" },
  { key: "ILLUSTRATED_GRAPHIC", label: "Illustrated graphic" },
];

const BRAND_PALETTE = ["#D0103A", "#1A1A18", "#1B9D74", "#FFFFFF", "#F7F7F7"];

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.9375rem",
    "& fieldset": { borderColor: "#E5E5E5" },
    "&:hover fieldset": { borderColor: "#ABABAB" },
    "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
  },
};

function ChipSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; desc?: string }[];
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
              "&:hover": { borderColor: "#D0103A", bgcolor: isSelected ? "#A00D2E" : "#FFF1F4" },
            }}
          >
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosterComposePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { composition, setComposition, brief, copy, subject, artifactId, isSaving, setIsSaving, getContentPayload } =
    usePosterWizard();

  const [error, setError] = useState<string | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);

  const promptReady =
    composition.merged_prompt.trim().length > 0 && !composition.merged_prompt_stale;

  const isValid =
    composition.format !== "" &&
    composition.layout_template !== "" &&
    composition.visual_style !== "" &&
    composition.palette.length > 0 &&
    promptReady;

  const handleBack = () => {
    router.push(`/projects/${projectId}/artifacts/new-poster/copy`);
  };

  // Build a deterministic merged prompt from all prior steps (Phase C will polish with LLM)
  const buildMergedPrompt = () => {
    const parts: string[] = [];

    if (composition.visual_style) {
      const styleMap: Record<string, string> = {
        CLEAN_CORPORATE: "clean, corporate style",
        WARM_HUMAN: "warm, human tone",
        BOLD_HIGH_CONTRAST: "bold, high-contrast aesthetic",
        SOFT_ASPIRATIONAL: "soft, aspirational mood",
        DARK_PREMIUM: "dark premium look",
        ILLUSTRATED_GRAPHIC: "illustrated graphic style",
      };
      parts.push(styleMap[composition.visual_style] ?? composition.visual_style.toLowerCase());
    }

    if (subject.type === "HUMAN_MODEL" && subject.human_model.appearance_keywords) {
      parts.push(`featuring ${subject.human_model.appearance_keywords}`);
      if (subject.human_model.expression_mood) parts.push(subject.human_model.expression_mood.toLowerCase());
    } else if (subject.type === "SCENE_ABSTRACT" && subject.scene_abstract.description) {
      parts.push(subject.scene_abstract.description);
    } else if (subject.type === "PRODUCT_ASSET") {
      parts.push("product-focused composition");
    }

    if (brief.tone) {
      const toneMap: Record<string, string> = {
        INSPIRATIONAL: "inspiring atmosphere",
        PROFESSIONAL: "professional setting",
        WARM: "warm human feel",
        EMPATHETIC: "warm empathetic lighting",
        URGENT: "dynamic urgent composition",
      };
      parts.push(toneMap[brief.tone] ?? "");
    }

    if (copy.headline) parts.push(`conveying the message: "${copy.headline}"`);

    if (composition.layout_template) {
      const layoutMap: Record<string, string> = {
        HERO_DOMINANT: "hero-dominant layout",
        SPLIT: "50/50 split layout",
        FRAME_BORDER: "framed border layout",
        TYPOGRAPHIC: "typographic-led layout",
        FULL_BLEED: "full-bleed layout",
      };
      parts.push(layoutMap[composition.layout_template] ?? "");
    }

    parts.push("AIA Singapore brand colours — red #D0103A and white on dark background");
    parts.push("print-ready poster, high quality");

    return parts.filter(Boolean).join(", ");
  };

  const canAssemble =
    composition.format !== "" && composition.layout_template !== "" && composition.visual_style !== "";

  const handleAssemblePrompt = async () => {
    if (!canAssemble) return;
    setIsAssembling(true);
    setError(null);
    try {
      const result = await generateCompositionPrompt({
        brief: {
          title: brief.title,
          campaign_objective: brief.campaign_objective,
          target_audience: brief.target_audience,
          tone: (brief.tone as PosterTone) || "PROFESSIONAL",
          call_to_action: brief.call_to_action,
          narrative: brief.narrative,
        },
        subject,
        copy: {
          headline: copy.headline,
          subheadline: copy.subheadline,
          body: copy.body,
          cta_text: copy.cta_text,
        },
        composition_settings: {
          format: composition.format as CompositionFormat,
          layout_template: composition.layout_template as LayoutTemplate,
          visual_style: composition.visual_style as VisualStyle,
          palette: composition.palette,
        },
      });
      setComposition({
        merged_prompt: result.merged_prompt,
        merged_prompt_stale: false,
        prompt_generated_at: new Date().toISOString(),
      });
    } catch {
      // Fallback: build locally
      const prompt = buildMergedPrompt();
      setComposition({ merged_prompt: prompt, merged_prompt_stale: false, prompt_generated_at: new Date().toISOString() });
    } finally {
      setIsAssembling(false);
    }
  };

  const handleContinue = async () => {
    if (!artifactId || !isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateArtifact(artifactId, { content: getContentPayload() });
      router.push(`/projects/${projectId}/artifacts/new-poster/generate`);
    } catch (err: unknown) {
      const apiErr = err as { detail?: unknown; status?: number };
      console.error("[Poster Step 4] Save failed:", apiErr.status, apiErr.detail ?? err);
      const statusHint = apiErr.status ? ` (${apiErr.status})` : "";
      setError(`Failed to save${statusHint}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ borderRadius: "16px", border: "1px solid #E8EAED", bgcolor: "#FFFFFF", p: 4 }}>
      <Typography sx={{ mb: 0.5, fontSize: "22px", fontWeight: 700, color: "#1F1F1F" }}>
        Composition
      </Typography>
      <Typography sx={{ mb: 3, fontSize: "14px", color: "#5F6368" }}>
        Choose the format, layout, and visual style. The merged prompt assembles automatically from all prior steps.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Format */}
        <Box>
          <Typography sx={{ mb: 1, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Format <span style={{ color: "#D0103A" }}>*</span>
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {FORMATS.map((f) => {
              const isSelected = composition.format === f.key;
              return (
                <Box
                  key={f.key}
                  component="button"
                  onClick={() => setComposition({ format: f.key })}
                  sx={{
                    flex: 1,
                    p: 1.5,
                    borderRadius: "10px",
                    border: "1.5px solid",
                    borderColor: isSelected ? "#D0103A" : "#E8EAED",
                    bgcolor: isSelected ? "#FFF1F4" : "#FFFFFF",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: "#D0103A" },
                  }}
                >
                  {/* Aspect ratio preview */}
                  <Box
                    sx={{
                      mx: "auto",
                      mb: 0.75,
                      bgcolor: isSelected ? "#D0103A" : "#E8EAED",
                      borderRadius: "4px",
                      ...(f.key === "PORTRAIT" && { width: 20, height: 28 }),
                      ...(f.key === "SQUARE" && { width: 24, height: 24 }),
                      ...(f.key === "LANDSCAPE" && { width: 32, height: 20 }),
                      ...(f.key === "STORY" && { width: 16, height: 28 }),
                    }}
                  />
                  <Typography sx={{ fontSize: "12px", fontWeight: 600, color: isSelected ? "#D0103A" : "#484848" }}>
                    {f.label}
                  </Typography>
                  <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>{f.desc}</Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Layout template */}
        <Box>
          <Typography sx={{ mb: 1, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Layout template <span style={{ color: "#D0103A" }}>*</span>
          </Typography>
          <ChipSelector options={LAYOUTS} value={composition.layout_template} onChange={(v) => setComposition({ layout_template: v })} />
        </Box>

        {/* Visual style */}
        <Box>
          <Typography sx={{ mb: 1, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Visual style <span style={{ color: "#D0103A" }}>*</span>
          </Typography>
          <ChipSelector options={STYLES} value={composition.visual_style} onChange={(v) => setComposition({ visual_style: v })} />
        </Box>

        {/* Palette */}
        <Box>
          <Typography sx={{ mb: 1, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Colour palette
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {BRAND_PALETTE.map((hex) => {
              const isActive = composition.palette.includes(hex);
              return (
                <Box
                  key={hex}
                  component="button"
                  onClick={() => {
                    const next = isActive
                      ? composition.palette.filter((c) => c !== hex)
                      : [...composition.palette, hex];
                    setComposition({ palette: next });
                  }}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    bgcolor: hex,
                    border: isActive ? "2.5px solid #D0103A" : "1.5px solid #E8EAED",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 0 0 2px #FFF, 0 0 0 4px #D0103A" : "none",
                    transition: "all 0.15s",
                  }}
                />
              );
            })}
            <Typography sx={{ ml: 1, fontSize: "12px", color: "#9E9E9E" }}>
              Brand kit colours · Custom palette in Phase B
            </Typography>
          </Box>
        </Box>

        {/* Merged prompt */}
        <Box>
          <Box sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Merged composition prompt
            </Typography>
            <AiAssistChip
              onClick={handleAssemblePrompt}
              loading={isAssembling}
              disabled={!canAssemble}
            >
              {composition.merged_prompt ? "Regenerate" : "AI Generate Composition"}
            </AiAssistChip>
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            placeholder="Select format, layout, and style above, then click Assemble — or type a custom prompt directly."
            value={composition.merged_prompt}
            onChange={(e) => setComposition({ merged_prompt: e.target.value, merged_prompt_stale: true })}
            sx={textFieldSx}
          />
          {composition.merged_prompt_stale && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: "8px",
                bgcolor: "#FFFBEB",
                border: "1px solid #FDE68A",
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: "12px", color: "#92400E", flex: 1 }}>
                ⚠ Your copy has changed since this prompt was generated. Regenerate the composition
                prompt to reflect your latest copy.
              </Typography>
            </Box>
          )}
          {composition.prompt_generated_at && !composition.merged_prompt_stale && (
            <Typography sx={{ mt: 0.5, fontSize: "11px", color: "#5F6368" }}>
              Assembled from current brief, subject, and copy.
            </Typography>
          )}
          {!composition.merged_prompt && !isAssembling && (
            <Typography sx={{ mt: 0.5, fontSize: "11px", color: "#9E9E9E" }}>
              Select format, layout, and style above, then click{" "}
              <strong>AI Generate Composition</strong> — or type a prompt directly.
            </Typography>
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
