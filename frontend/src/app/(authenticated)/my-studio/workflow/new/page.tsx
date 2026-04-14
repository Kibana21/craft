"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import { WizardProgress } from "@/components/projects/wizard/wizard-progress";
import { useStudioWorkflow } from "../layout";
import { useStudioRunPolling } from "@/hooks/useStudioRunPolling";
import {
  buildPrompt,
  discardOutputs,
  generateRun,
  getImage,
  retrySlot,
  staticStudioUrl,
} from "@/lib/api/studio";
import {
  INTENT_COPY,
  STUDIO_IMAGE_TYPE_LABEL,
  type StudioImage,
  type StudioIntent,
  type VariationCount,
} from "@/types/studio";

// ── Step indicator labels ─────────────────────────────────────────────────────

const STEPS = ["Intent", "Style", "Prompt", "Generate"];

// ── Small helpers ─────────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Box
      component="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 9999,
        border: "1.5px solid",
        borderColor: active ? "#D0103A" : "#E8EAED",
        bgcolor: active ? "#D0103A" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#1F1F1F",
        fontSize: "13px",
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        "&:hover":
          disabled || active
            ? {}
            : { borderColor: "#D0103A", color: "#D0103A", bgcolor: "#FFF1F4" },
      }}
    >
      {children}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudioWorkflowNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useStudioWorkflow();
  const [step, setStep] = useState(0); // 0..3
  const [isBuilding, setIsBuilding] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<StudioImage | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(true);

  // Initial wiring: read ?source= and hydrate the context on mount.
  useEffect(() => {
    const sourceId = searchParams.get("source");
    ctx.setMode("single");
    if (!sourceId) {
      ctx.setSourceImageIds([]);
      setSourceImage(null);
      setIsLoadingSource(false);
      return;
    }
    ctx.setSourceImageIds([sourceId]);
    getImage(sourceId)
      .then((img) => setSourceImage(img))
      .catch(() => setSourceImage(null))
      .finally(() => setIsLoadingSource(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling — only fires when we have a runId (ctx.runId set on dispatch).
  const { status: runStatus, error: runError } = useStudioRunPolling(ctx.runId);

  // ── Step 1: Intent ──────────────────────────────────────────────────────────

  const renderIntent = () => (
    <Box>
      <SectionHeader
        title="What would you like to do with this image?"
        subtitle="Pick an intent. We'll ask a few quick questions next."
      />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 1.5, "@media (min-width:600px)": { gridTemplateColumns: "repeat(2, 1fr)" } }}>
        {(Object.keys(INTENT_COPY) as StudioIntent[]).map((k) => {
          const copy = INTENT_COPY[k];
          const active = ctx.intent === k;
          return (
            <Box
              key={k}
              component="button"
              onClick={() => ctx.setIntent(k)}
              sx={{
                textAlign: "left",
                p: 2.25,
                borderRadius: "14px",
                border: "1.5px solid",
                borderColor: active ? "#D0103A" : "#E8EAED",
                bgcolor: active ? "#FFF5F7" : "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                transition: "all 0.15s",
                "&:hover": { borderColor: "#D0103A", bgcolor: active ? "#FFF5F7" : "#FFF9FB" },
              }}
            >
              <Box sx={{ fontSize: "20px", mb: 0.25 }}>{copy.icon}</Box>
              <Typography sx={{ fontSize: "15px", fontWeight: 700, color: "#1F1F1F" }}>
                {copy.label}
              </Typography>
              <Typography sx={{ fontSize: "12.5px", color: "#5F6368", lineHeight: 1.5 }}>
                {copy.description}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  // ── Step 2: Style inputs (intent-scoped) ────────────────────────────────────

  const renderStyle = () => {
    if (!ctx.intent) return null;
    return <StyleInputs intent={ctx.intent} value={ctx.styleInputs} onChange={ctx.setStyleInputs} />;
  };

  // ── Step 3: Prompt review ───────────────────────────────────────────────────

  const renderPrompt = () => (
    <PromptReview
      isBuilding={isBuilding}
      sourceImage={sourceImage}
      mergedPrompt={ctx.mergedPrompt}
      aiEnrichments={ctx.aiEnrichments}
      onChangePrompt={(p) => ctx.setMergedPrompt(p)}
      onRegenerate={handleRegenerate}
      canUndo={ctx.regenerationHistory.length > 0}
      onUndoRegeneration={() => {
        const prev = ctx.undoRegeneration();
        if (prev) ctx.setMergedPrompt(prev);
      }}
      variationCount={ctx.variationCount}
      onChangeVariationCount={ctx.setVariationCount}
    />
  );

  // ── Step 4: Generate ────────────────────────────────────────────────────────

  const renderGenerate = () => (
    <GenerateResults
      runStatus={runStatus}
      runError={runError}
      dispatchError={dispatchError}
      isDispatching={isDispatching}
      onRetrySlot={async (variant, slot) => {
        if (!ctx.runId) return;
        try {
          await retrySlot(ctx.runId, {
            source_image_id: variant?.source_image_id ?? null,
            slot,
          });
        } catch {
          /* retry failure is surfaced via the poll status the user is already watching */
        }
      }}
      onSaveToLibrary={() => {
        ctx.reset();
        router.push("/my-studio");
      }}
      onDiscard={async () => {
        if (ctx.runId) await discardOutputs(ctx.runId).catch(() => null);
        ctx.reset();
        router.push("/my-studio");
      }}
    />
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const isStep2Valid = useMemo(
    () => validateStyle(ctx.intent, ctx.styleInputs),
    [ctx.intent, ctx.styleInputs],
  );

  // Called when advancing from Step 2 → Step 3: builds the prompt via AI.
  const handleContinueFromStyle = useCallback(async () => {
    if (!ctx.intent || !isStep2Valid) return;
    setIsBuilding(true);
    setDispatchError(null);
    try {
      const res = await buildPrompt({
        intent: ctx.intent,
        style_inputs: ctx.styleInputs,
        source_image_id: ctx.sourceImageIds[0] ?? undefined,
        variation_count: ctx.variationCount,
      });
      ctx.setMergedPrompt(res.merged_prompt, res.ai_enrichments);
      setStep(2);
    } catch (err: unknown) {
      const e = err as { detail?: unknown; status?: number };
      const detail =
        typeof e.detail === "string"
          ? e.detail
          : typeof e.detail === "object" && e.detail !== null
            ? (e.detail as { detail?: string }).detail
            : null;
      setDispatchError(detail ?? "Could not build your prompt. Try again.");
    } finally {
      setIsBuilding(false);
    }
  }, [ctx, isStep2Valid]);

  const handleRegenerate = useCallback(async () => {
    if (!ctx.intent) return;
    setIsBuilding(true);
    setDispatchError(null);
    try {
      // Stash current prompt in the undo stack before replacing.
      if (ctx.mergedPrompt) ctx.pushRegeneration(ctx.mergedPrompt);
      const res = await buildPrompt({
        intent: ctx.intent,
        style_inputs: ctx.styleInputs,
        source_image_id: ctx.sourceImageIds[0] ?? undefined,
        variation_count: ctx.variationCount,
      });
      ctx.setMergedPrompt(res.merged_prompt, res.ai_enrichments);
    } catch {
      setDispatchError("Regenerate failed. Keep the previous prompt or try again.");
    } finally {
      setIsBuilding(false);
    }
  }, [ctx]);

  // Called when advancing from Step 3 → Step 4: dispatches the run.
  const handleContinueFromPrompt = useCallback(async () => {
    if (!ctx.intent || !ctx.mergedPrompt) return;
    setIsDispatching(true);
    setDispatchError(null);
    try {
      const res = await generateRun({
        intent: ctx.intent,
        style_inputs: ctx.styleInputs,
        source_image_ids: ctx.sourceImageIds,
        merged_prompt: ctx.mergedPrompt,
        variation_count: ctx.variationCount,
        is_batch: false,
      });
      ctx.setRunId(res.run_id);
      setStep(3);
    } catch (err: unknown) {
      const e = err as { detail?: unknown; status?: number };
      const detail =
        typeof e.detail === "object" && e.detail !== null
          ? (e.detail as { detail?: string; error_code?: string })
          : null;
      if (detail?.error_code === "STUDIO_QUOTA_EXCEEDED") {
        setDispatchError("Daily generation cap reached. Try again tomorrow.");
      } else {
        setDispatchError(detail?.detail ?? "Could not start generation. Try again.");
      }
    } finally {
      setIsDispatching(false);
    }
  }, [ctx]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <WizardProgress
        steps={STEPS}
        currentStep={step}
        onStepClick={(i) => {
          // Allow jumping back to completed steps — never forward.
          if (i < step) setStep(i);
        }}
        clickableSteps="completed-and-current"
      />

      {/* Source preview */}
      {ctx.sourceImageIds.length > 0 && (
        <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "10px",
              overflow: "hidden",
              bgcolor: "#F5F5F5",
              flexShrink: 0,
            }}
          >
            {isLoadingSource ? (
              <Skeleton variant="rectangular" sx={{ width: 64, height: 64 }} />
            ) : sourceImage ? (
              <Box
                component="img"
                src={staticStudioUrl(sourceImage.thumbnail_url ?? sourceImage.storage_url)}
                alt={sourceImage.name}
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "13px", color: "#1F1F1F", fontWeight: 600 }}>
              {sourceImage?.name ?? "Source image"}
            </Typography>
            <Typography sx={{ fontSize: "12px", color: "#9E9E9E" }}>
              Source · {sourceImage ? STUDIO_IMAGE_TYPE_LABEL[sourceImage.type] : ""}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Step body */}
      <Box
        sx={{
          borderRadius: "16px",
          border: "1px solid #E8EAED",
          bgcolor: "#FFFFFF",
          p: { xs: 2.5, sm: 4 },
          minHeight: 300,
        }}
      >
        {step === 0 && renderIntent()}
        {step === 1 && renderStyle()}
        {step === 2 && renderPrompt()}
        {step === 3 && renderGenerate()}
      </Box>

      {dispatchError && (
        <Typography sx={{ mt: 1.5, fontSize: "13px", color: "#D0103A" }}>
          {dispatchError}
        </Typography>
      )}

      {/* Footer nav — not shown on step 4 (GenerateResults has its own footer) */}
      {step < 3 && (
        <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              if (step === 0) router.push("/my-studio");
              else setStep(step - 1);
            }}
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </Button>
          {step === 0 && (
            <Button
              variant="contained"
              disabled={!ctx.intent}
              onClick={() => setStep(1)}
              sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
            >
              Continue
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="contained"
              disabled={!isStep2Valid || isBuilding}
              onClick={handleContinueFromStyle}
              startIcon={isBuilding ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
              sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
            >
              {isBuilding ? "Building your prompt…" : "Build prompt →"}
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="contained"
              disabled={!ctx.mergedPrompt.trim() || isDispatching}
              onClick={handleContinueFromPrompt}
              startIcon={isDispatching ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
              sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
            >
              {isDispatching ? "Starting…" : "Generate images →"}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Section header helper ─────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#1F1F1F" }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#5F6368" }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

// ── Step 2: StyleInputs (intent-scoped) ──────────────────────────────────────

function StyleInputs({
  intent,
  value,
  onChange,
}: {
  intent: StudioIntent;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });

  const common = (
    <SectionHeader
      title="Tell us a little more"
      subtitle="Answer a few quick questions to guide the AI."
    />
  );

  if (intent === "MAKE_PROFESSIONAL") {
    const settings = (value.setting as string[]) ?? [];
    const toggleSetting = (k: string) =>
      set({ setting: settings.includes(k) ? settings.filter((s) => s !== k) : [...settings, k] });
    return (
      <Box>
        {common}
        <Field label="Setting / background (select one or more)">
          <ChipRow>
            {["OFFICE", "OUTDOOR", "STUDIO", "BLURRED"].map((k) => (
              <Chip key={k} active={settings.includes(k)} onClick={() => toggleSetting(k)}>
                {k === "BLURRED" ? "Blurred (bokeh)" : k === "STUDIO" ? "Studio (plain)" : k[0] + k.slice(1).toLowerCase()}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Attire / style">
          <ChipRow>
            {[
              ["KEEP", "Keep current"],
              ["MORE_FORMAL", "Make more formal"],
            ].map(([k, lbl]) => (
              <Chip key={k} active={value.attire === k} onClick={() => set({ attire: k })}>
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Mood / expression">
          <ChipRow>
            {[
              ["CONFIDENT", "Confident / Composed"],
              ["WARM", "Warm / Friendly"],
              ["APPROACHABLE", "Approachable"],
            ].map(([k, lbl]) => (
              <Chip key={k} active={value.mood === k} onClick={() => set({ mood: k })}>
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Anything specific to add?">
          <TextField
            fullWidth
            multiline
            minRows={2}
            value={(value.notes as string) ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="e.g. keep glasses, no tie, warmer skin tones"
            sx={textFieldSx}
          />
        </Field>
      </Box>
    );
  }

  if (intent === "CHANGE_BACKGROUND") {
    return (
      <Box>
        {common}
        <Field label="New background type">
          <ChipRow>
            {[
              ["OFFICE_INTERIOR", "Office interior"],
              ["OUTDOOR_NATURE", "Outdoor nature"],
              ["CITY_SKYLINE", "City skyline"],
              ["ABSTRACT", "Abstract"],
              ["PLAIN_COLOUR", "Plain colour"],
              ["CUSTOM", "Custom"],
            ].map(([k, lbl]) => (
              <Chip
                key={k}
                active={value.new_background === k}
                onClick={() => set({ new_background: k })}
              >
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Lighting">
          <ChipRow>
            {[
              ["MATCH", "Match original"],
              ["RELIGHT", "Relight for new background"],
            ].map(([k, lbl]) => (
              <Chip
                key={k}
                active={value.lighting_match === k}
                onClick={() => set({ lighting_match: k })}
              >
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        {value.new_background === "CUSTOM" && (
          <Field label="Describe the background">
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={(value.description as string) ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. sunlit glass skyscraper lobby"
              sx={textFieldSx}
            />
          </Field>
        )}
      </Box>
    );
  }

  if (intent === "ENHANCE_QUALITY") {
    const focus = (value.focus_areas as string[]) ?? [];
    const toggleFocus = (k: string) =>
      set({ focus_areas: focus.includes(k) ? focus.filter((s) => s !== k) : [...focus, k] });
    return (
      <Box>
        {common}
        <Field label="Focus areas (select one or more)">
          <ChipRow>
            {[
              ["LIGHTING", "Lighting"],
              ["SHARPNESS", "Sharpness / clarity"],
              ["COLOUR", "Colour balance"],
              ["SKIN_TONES", "Skin tones"],
              ["BG_BLUR", "Background blur"],
            ].map(([k, lbl]) => (
              <Chip key={k} active={focus.includes(k)} onClick={() => toggleFocus(k)}>
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Output resolution">
          <ChipRow>
            {[
              ["SAME", "Same as original"],
              ["UPSCALE_2X", "2× upscale"],
              ["UPSCALE_4X", "4× upscale"],
            ].map(([k, lbl]) => (
              <Chip
                key={k}
                active={(value.output_resolution ?? "SAME") === k}
                onClick={() => set({ output_resolution: k })}
              >
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </Box>
    );
  }

  if (intent === "VARIATION") {
    const keep = (value.keep_consistent as string[]) ?? [];
    const toggle = (k: string) =>
      set({ keep_consistent: keep.includes(k) ? keep.filter((s) => s !== k) : [...keep, k] });
    return (
      <Box>
        {common}
        <Field label={`How different? (${(value.difference_level ?? 50)}% different)`}>
          <Slider
            value={(value.difference_level as number) ?? 50}
            onChange={(_, v) => set({ difference_level: v as number })}
            min={10}
            max={90}
            step={10}
            marks
            sx={{ color: "#D0103A", mt: 1 }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
            <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>Subtle</Typography>
            <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>Very different</Typography>
          </Box>
        </Field>
        <Field label="Keep consistent">
          <ChipRow>
            {[
              ["IDENTITY", "Subject identity"],
              ["PALETTE", "Colour palette"],
              ["COMPOSITION", "Composition"],
              ["MOOD", "Mood"],
            ].map(([k, lbl]) => (
              <Chip key={k} active={keep.includes(k)} onClick={() => toggle(k)}>
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Style direction">
          <ChipRow>
            {[
              ["SAME", "Same style"],
              ["MORE_PROFESSIONAL", "More professional"],
              ["MORE_ARTISTIC", "More artistic"],
              ["MORE_VIBRANT", "More vibrant"],
            ].map(([k, lbl]) => (
              <Chip
                key={k}
                active={(value.style_direction ?? "SAME") === k}
                onClick={() => set({ style_direction: k })}
              >
                {lbl}
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </Box>
    );
  }

  // CUSTOM
  return (
    <Box>
      {common}
      <Field label="Describe what you want">
        <TextField
          fullWidth
          multiline
          minRows={4}
          value={(value.description as string) ?? ""}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="e.g. a cinematic portrait with warm rim lighting, shallow depth of field"
          sx={textFieldSx}
        />
      </Field>
      <Field label="Use source image as reference">
        <ChipRow>
          {[
            [true, "On"],
            [false, "Off"],
          ].map(([k, lbl]) => {
            const current = value.use_source_as_reference ?? true;
            return (
              <Chip
                key={String(k)}
                active={current === k}
                onClick={() => set({ use_source_as_reference: k })}
              >
                {lbl}
              </Chip>
            );
          })}
        </ChipRow>
      </Field>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>{children}</Box>;
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.9375rem",
    "& fieldset": { borderColor: "#E5E5E5" },
    "&:hover fieldset": { borderColor: "#ABABAB" },
    "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
  },
};

function validateStyle(intent: StudioIntent | null, v: Record<string, unknown>): boolean {
  if (!intent) return false;
  if (intent === "MAKE_PROFESSIONAL") {
    return (
      Array.isArray(v.setting) &&
      (v.setting as unknown[]).length > 0 &&
      typeof v.attire === "string" &&
      typeof v.mood === "string"
    );
  }
  if (intent === "CHANGE_BACKGROUND") {
    const ok = typeof v.new_background === "string" && typeof v.lighting_match === "string";
    if (v.new_background === "CUSTOM") {
      return ok && typeof v.description === "string" && (v.description as string).trim().length > 0;
    }
    return ok;
  }
  if (intent === "ENHANCE_QUALITY") {
    return Array.isArray(v.focus_areas) && (v.focus_areas as unknown[]).length > 0;
  }
  if (intent === "VARIATION") {
    return typeof v.difference_level === "number";
  }
  // CUSTOM
  return typeof v.description === "string" && (v.description as string).trim().length > 0;
}

// ── Step 3: PromptReview ─────────────────────────────────────────────────────

function PromptReview({
  isBuilding,
  sourceImage,
  mergedPrompt,
  aiEnrichments,
  onChangePrompt,
  onRegenerate,
  canUndo,
  onUndoRegeneration,
  variationCount,
  onChangeVariationCount,
}: {
  isBuilding: boolean;
  sourceImage: StudioImage | null;
  mergedPrompt: string;
  aiEnrichments: string[];
  onChangePrompt: (p: string) => void;
  onRegenerate: () => void;
  canUndo: boolean;
  onUndoRegeneration: () => void;
  variationCount: VariationCount;
  onChangeVariationCount: (n: VariationCount) => void;
}) {
  return (
    <Box>
      <SectionHeader
        title="Your AI-built prompt"
        subtitle="Built from your inputs. Review, edit, or regenerate before generating."
      />
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 3 }}>
        {/* Source preview (reserved) */}
        {sourceImage && (
          <Box
            sx={{
              width: { xs: "100%", sm: 220 },
              flexShrink: 0,
              borderRadius: "12px",
              overflow: "hidden",
              bgcolor: "#F7F7F7",
              aspectRatio: "1",
            }}
          >
            <Box
              component="img"
              src={staticStudioUrl(sourceImage.thumbnail_url ?? sourceImage.storage_url)}
              alt={sourceImage.name}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        )}

        {/* Editable prompt */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ mb: 0.75, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography sx={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: "#5F6368" }}>
              GENERATED PROMPT · EDITABLE
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {canUndo && (
                <Button
                  size="small"
                  onClick={onUndoRegeneration}
                  sx={{
                    textTransform: "none",
                    fontSize: "12px",
                    color: "#5F6368",
                    "&:hover": { bgcolor: "#F1F3F4" },
                  }}
                >
                  Undo
                </Button>
              )}
              <Button
                size="small"
                onClick={onRegenerate}
                disabled={isBuilding}
                startIcon={isBuilding ? <CircularProgress size={12} sx={{ color: "#D0103A" }} /> : undefined}
                sx={{
                  textTransform: "none",
                  fontSize: "12px",
                  color: "#D0103A",
                  border: "1px solid #D0103A",
                  borderRadius: 9999,
                  px: 1.25,
                  "&:hover": { bgcolor: "#FFF1F4" },
                }}
              >
                {isBuilding ? "Regenerating…" : "↻ Regenerate"}
              </Button>
            </Box>
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={6}
            maxRows={14}
            value={isBuilding ? "Building your prompt…" : mergedPrompt}
            onChange={(e) => !isBuilding && onChangePrompt(e.target.value)}
            disabled={isBuilding}
            sx={{
              ...textFieldSx,
              "& .MuiOutlinedInput-root": {
                ...textFieldSx["& .MuiOutlinedInput-root"],
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "12.5px",
                lineHeight: 1.55,
                bgcolor: "#FAFAFA",
              },
            }}
          />

          {/* What the AI added */}
          {aiEnrichments.length > 0 && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: "10px", bgcolor: "#F7F7F7" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: "#5F6368", mb: 0.75 }}>
                WHAT THE AI ADDED FOR YOU
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                {aiEnrichments.map((e, i) => (
                  <Typography
                    key={i}
                    component="li"
                    sx={{ fontSize: "12.5px", color: "#3C4043", lineHeight: 1.7 }}
                  >
                    {e}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          {/* Variation count */}
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Number of variations
            </Typography>
            <ChipRow>
              {[1, 2, 4, 8].map((n) => (
                <Chip
                  key={n}
                  active={variationCount === n}
                  onClick={() => onChangeVariationCount(n as VariationCount)}
                >
                  {n}
                </Chip>
              ))}
            </ChipRow>
            {variationCount === 8 && (
              <Typography sx={{ mt: 0.75, fontSize: "11.5px", color: "#5F6368" }}>
                8 variations take longer and use more of your daily cap.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Step 4: GenerateResults ──────────────────────────────────────────────────

function GenerateResults({
  runStatus,
  runError,
  dispatchError,
  isDispatching,
  onRetrySlot,
  onSaveToLibrary,
  onDiscard,
}: {
  runStatus: import("@/types/studio").WorkflowRunStatusResponse | null;
  runError: string | null;
  dispatchError: string | null;
  isDispatching: boolean;
  onRetrySlot: (variant: StudioImage | null, slot: number) => void;
  onSaveToLibrary: () => void;
  onDiscard: () => void;
}) {
  const outputs = runStatus?.outputs ?? [];
  const isRunning = runStatus?.status === "QUEUED" || runStatus?.status === "RUNNING";
  const isTerminal =
    runStatus?.status === "DONE" ||
    runStatus?.status === "FAILED" ||
    runStatus?.status === "PARTIAL";
  const progress = runStatus?.progress_percent ?? 0;

  return (
    <Box>
      <SectionHeader
        title="Generating your images"
        subtitle={
          isDispatching
            ? "Dispatching…"
            : isRunning
              ? "Creating variations — they'll appear below as they finish."
              : runStatus?.status === "DONE"
                ? "All done. Save the ones you like to your library."
                : runStatus?.status === "PARTIAL"
                  ? "Some variations failed. You can retry or keep what's here."
                  : runStatus?.status === "FAILED"
                    ? "No variations succeeded. Try tweaking the prompt and run again."
                    : "Preparing…"
        }
      />

      {/* Progress bar */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ height: 6, borderRadius: 9999, bgcolor: "#EEEEEE", overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${Math.max(4, progress)}%`,
              bgcolor: runStatus?.status === "FAILED" ? "#D0103A" : "#188038",
              transition: "width 0.4s ease",
            }}
          />
        </Box>
        <Typography sx={{ mt: 0.5, fontSize: "11.5px", color: "#5F6368" }}>
          {progress}% · {runStatus?.status ?? "starting"}
        </Typography>
      </Box>

      {/* Outputs grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 1.5,
          "@media (min-width:600px)": { gridTemplateColumns: "repeat(3, 1fr)" },
          "@media (min-width:900px)": { gridTemplateColumns: "repeat(4, 1fr)" },
        }}
      >
        {outputs.map((o, idx) => (
          <Box
            key={o.id}
            sx={{
              aspectRatio: "1",
              bgcolor: "#F7F7F7",
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid #E8EAED",
            }}
          >
            <Box
              component="img"
              src={staticStudioUrl(o.thumbnail_url ?? o.storage_url)}
              alt={`Variation ${idx + 1}`}
              loading="lazy"
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        ))}
        {isRunning && outputs.length === 0 &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              sx={{ aspectRatio: "1", borderRadius: "12px" }}
              animation="wave"
            />
          ))}
      </Box>

      {(runError || dispatchError) && (
        <Typography sx={{ mt: 2, fontSize: "13px", color: "#D0103A" }}>
          {runError ?? dispatchError}
        </Typography>
      )}

      {/* Footer — terminal actions */}
      {isTerminal && (
        <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={onDiscard}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#E8EAED",
              color: "#5F6368",
              "&:hover": { borderColor: "#D0103A", color: "#D0103A" },
            }}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={onSaveToLibrary}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              "&:hover": { bgcolor: "#A00D2E" },
            }}
          >
            Save to library →
          </Button>
        </Box>
      )}

      {/* Retry-slot buttons (PARTIAL only) */}
      {runStatus?.status === "PARTIAL" && outputs.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "12px", color: "#5F6368", mb: 0.5 }}>
            Some variations failed. Retry a specific slot:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {outputs.map((o, idx) => (
              <Chip key={o.id} onClick={() => onRetrySlot(o, idx)}>
                Retry slot {idx + 1}
              </Chip>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
