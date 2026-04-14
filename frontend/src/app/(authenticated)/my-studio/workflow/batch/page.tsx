"use client";

// Phase C batch workflow. Shares the shape of /workflow/new but applies a
// single intent + style + prompt to 2–20 source images in parallel. Backend
// `POST /workflows/generate` with is_batch=true handles the fan-out.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WizardProgress } from "@/components/projects/wizard/wizard-progress";
import { useStudioRunPolling } from "@/hooks/useStudioRunPolling";
import { useStudioWorkflow } from "../layout";
import {
  buildPrompt,
  discardOutputs,
  generateRun,
  getImage,
  staticStudioUrl,
} from "@/lib/api/studio";
import {
  INTENT_COPY,
  type StudioImageDetail,
  type StudioIntent,
  type VariationCount,
} from "@/types/studio";

const STEPS = ["Intent", "Style", "Prompt", "Generate"];
const BATCH_VARIATION_OPTIONS: VariationCount[] = [1, 2, 4];
const MIN_BATCH = 2;
const MAX_BATCH = 20;

export default function StudioWorkflowBatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useStudioWorkflow();

  const [step, setStep] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<StudioImageDetail[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);

  // Initial wiring.
  useEffect(() => {
    const raw = searchParams.get("sources") ?? "";
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    ctx.setMode("batch");
    ctx.setSourceImageIds(ids);
    if (ids.length === 0) {
      setIsLoadingSources(false);
      return;
    }
    Promise.all(ids.map((id) => getImage(id).catch(() => null)))
      .then((arr) => setSources(arr.filter((x): x is StudioImageDetail => x !== null)))
      .finally(() => setIsLoadingSources(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default variation_count=1 for batch runs to stay under the 40-variation
  // ceiling (PRD §11.5). The workflow context default is 4 — override once.
  useEffect(() => {
    if (ctx.variationCount === 4) ctx.setVariationCount(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status: runStatus, error: runError } = useStudioRunPolling(ctx.runId);

  const totalVariations = ctx.sourceImageIds.length * ctx.variationCount;

  const sizeValid = useMemo(
    () =>
      ctx.sourceImageIds.length >= MIN_BATCH &&
      ctx.sourceImageIds.length <= MAX_BATCH,
    [ctx.sourceImageIds.length],
  );

  const handleBuild = useCallback(async () => {
    if (!ctx.intent || !sizeValid) return;
    setIsBuilding(true);
    setError(null);
    try {
      const res = await buildPrompt({
        intent: ctx.intent,
        style_inputs: ctx.styleInputs,
        source_image_id: ctx.sourceImageIds[0],
        variation_count: ctx.variationCount,
      });
      ctx.setMergedPrompt(res.merged_prompt, res.ai_enrichments);
      setStep(2);
    } catch {
      setError("Could not build the shared prompt. Try again.");
    } finally {
      setIsBuilding(false);
    }
  }, [ctx, sizeValid]);

  const handleDispatch = useCallback(async () => {
    if (!ctx.intent || !ctx.mergedPrompt.trim()) return;
    setIsDispatching(true);
    setError(null);
    try {
      const res = await generateRun({
        intent: ctx.intent,
        style_inputs: ctx.styleInputs,
        source_image_ids: ctx.sourceImageIds,
        merged_prompt: ctx.mergedPrompt,
        variation_count: ctx.variationCount,
        is_batch: true,
      });
      ctx.setRunId(res.run_id);
      setStep(3);
    } catch (err: unknown) {
      const e = err as { detail?: unknown };
      const detail =
        typeof e.detail === "object" && e.detail !== null
          ? (e.detail as { detail?: string; error_code?: string })
          : null;
      if (detail?.error_code === "STUDIO_QUOTA_EXCEEDED") {
        setError("Daily cap reached. Try again tomorrow.");
      } else {
        setError(detail?.detail ?? "Could not start batch. Try again.");
      }
    } finally {
      setIsDispatching(false);
    }
  }, [ctx]);

  // Progress + results — reused layout from single workflow's Step 4, just for
  // a shared run across multiple sources.

  const outputs = runStatus?.outputs ?? [];
  const progress = runStatus?.progress_percent ?? 0;
  const isRunning = runStatus?.status === "QUEUED" || runStatus?.status === "RUNNING";
  const isTerminal =
    runStatus?.status === "DONE" ||
    runStatus?.status === "FAILED" ||
    runStatus?.status === "PARTIAL";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <WizardProgress
        steps={STEPS}
        currentStep={step}
        onStepClick={(i) => {
          if (i < step) setStep(i);
        }}
        clickableSteps="completed-and-current"
      />

      {/* Source strip */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          bgcolor: "#FAFAFA",
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          overflowX: "auto",
        }}
      >
        <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#5F6368", whiteSpace: "nowrap", mr: 1 }}>
          {ctx.sourceImageIds.length} sources
        </Typography>
        {isLoadingSources
          ? Array.from({ length: Math.max(ctx.sourceImageIds.length, 1) }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" sx={{ width: 56, height: 56, borderRadius: "8px" }} />
            ))
          : sources.map((s) => (
              <Box
                key={s.id}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "8px",
                  overflow: "hidden",
                  flexShrink: 0,
                  bgcolor: "#F5F5F5",
                }}
              >
                <Box
                  component="img"
                  src={staticStudioUrl(s.thumbnail_url ?? s.storage_url)}
                  alt={s.name}
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </Box>
            ))}
        {!sizeValid && (
          <Typography sx={{ ml: "auto", fontSize: "12px", color: "#D0103A" }}>
            Batch requires {MIN_BATCH}–{MAX_BATCH} images.
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          borderRadius: "16px",
          border: "1px solid #E8EAED",
          bgcolor: "#FFFFFF",
          p: { xs: 2.5, sm: 4 },
          minHeight: 300,
        }}
      >
        {step === 0 && (
          <>
            <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#1F1F1F", mb: 0.5 }}>
              Apply the same intent to all sources
            </Typography>
            <Typography sx={{ fontSize: "13px", color: "#5F6368", mb: 3 }}>
              The batch workflow uses one intent + one style + one prompt for all selected images.
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(1, 1fr)",
                gap: 1.5,
                "@media (min-width:600px)": { gridTemplateColumns: "repeat(2, 1fr)" },
              }}
            >
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
                      p: 2,
                      borderRadius: "12px",
                      border: "1.5px solid",
                      borderColor: active ? "#D0103A" : "#E8EAED",
                      bgcolor: active ? "#FFF5F7" : "#FFFFFF",
                      cursor: "pointer",
                      "&:hover": { borderColor: "#D0103A" },
                    }}
                  >
                    <Box sx={{ fontSize: "18px", mb: 0.25 }}>{copy.icon}</Box>
                    <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#1F1F1F" }}>
                      {copy.label}
                    </Typography>
                    <Typography sx={{ fontSize: "12px", color: "#5F6368", mt: 0.25 }}>
                      {copy.description}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </>
        )}

        {step === 1 && (
          <Box>
            <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#1F1F1F", mb: 0.5 }}>
              Shared style
            </Typography>
            <Typography sx={{ fontSize: "13px", color: "#5F6368", mb: 3 }}>
              Applied to every selected image.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              placeholder="Any notes to guide all images — e.g. 'keep each agent's face exactly as-is'"
              value={(ctx.styleInputs.notes as string) ?? ""}
              onChange={(e) => ctx.setStyleInputs({ ...ctx.styleInputs, notes: e.target.value })}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "0.9375rem",
                  "& fieldset": { borderColor: "#E5E5E5" },
                  "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
                },
              }}
            />
          </Box>
        )}

        {step === 2 && (
          <Box>
            <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#1F1F1F", mb: 0.5 }}>
              Shared prompt
            </Typography>
            <Typography sx={{ fontSize: "13px", color: "#5F6368", mb: 3 }}>
              {totalVariations} total generations · estimated ~{Math.ceil(totalVariations * 10 / 60)} min.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              maxRows={12}
              value={isBuilding ? "Building your prompt…" : ctx.mergedPrompt}
              onChange={(e) => !isBuilding && ctx.setMergedPrompt(e.target.value)}
              disabled={isBuilding}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "12.5px",
                  lineHeight: 1.55,
                  bgcolor: "#FAFAFA",
                },
              }}
            />
            <Typography sx={{ mt: 1.5, fontSize: "12px", fontWeight: 600, color: "#1F1F1F", mb: 0.75 }}>
              Variations per image
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {BATCH_VARIATION_OPTIONS.map((n) => (
                <Box
                  key={n}
                  component="button"
                  onClick={() => ctx.setVariationCount(n)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 9999,
                    border: "1.5px solid",
                    borderColor: ctx.variationCount === n ? "#D0103A" : "#E8EAED",
                    bgcolor: ctx.variationCount === n ? "#D0103A" : "#FFFFFF",
                    color: ctx.variationCount === n ? "#FFFFFF" : "#1F1F1F",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {step === 3 && (
          <Box>
            <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#1F1F1F", mb: 0.5 }}>
              Generating your batch
            </Typography>
            <Typography sx={{ fontSize: "13px", color: "#5F6368", mb: 3 }}>
              You can leave this page — we&apos;ll notify you when all images are ready.
            </Typography>
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
                {progress}% · {runStatus?.status ?? "starting"} · {outputs.length}/{totalVariations} ready
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 1.25,
                "@media (min-width:600px)": { gridTemplateColumns: "repeat(4, 1fr)" },
                "@media (min-width:900px)": { gridTemplateColumns: "repeat(5, 1fr)" },
              }}
            >
              {outputs.map((o, idx) => (
                <Box
                  key={o.id}
                  sx={{ aspectRatio: "1", borderRadius: "10px", overflow: "hidden", border: "1px solid #E8EAED" }}
                >
                  <Box
                    component="img"
                    src={staticStudioUrl(o.thumbnail_url ?? o.storage_url)}
                    alt={`Output ${idx + 1}`}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </Box>
              ))}
              {isRunning && outputs.length < totalVariations &&
                Array.from({ length: Math.min(4, totalVariations - outputs.length) }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" sx={{ aspectRatio: "1", borderRadius: "10px" }} />
                ))}
            </Box>
          </Box>
        )}
      </Box>

      {(error || runError) && (
        <Typography sx={{ mt: 1.5, fontSize: "13px", color: "#D0103A" }}>
          {error ?? runError}
        </Typography>
      )}

      {/* Footer navigation */}
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
              disabled={!ctx.intent || !sizeValid}
              onClick={() => setStep(1)}
              sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
            >
              Continue
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="contained"
              disabled={isBuilding}
              onClick={handleBuild}
              startIcon={isBuilding ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
              sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
            >
              {isBuilding ? "Building…" : "Build shared prompt →"}
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="contained"
              disabled={!ctx.mergedPrompt.trim() || isDispatching}
              onClick={handleDispatch}
              startIcon={isDispatching ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
              sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
            >
              {isDispatching ? "Starting…" : `Generate all (${totalVariations}) →`}
            </Button>
          )}
        </Box>
      )}

      {step === 3 && isTerminal && (
        <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={async () => {
              if (ctx.runId) await discardOutputs(ctx.runId).catch(() => null);
              ctx.reset();
              router.push("/my-studio");
            }}
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              ctx.reset();
              router.push("/my-studio");
            }}
            sx={{ borderRadius: 9999, textTransform: "none", bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
          >
            Save to library →
          </Button>
        </Box>
      )}
    </Box>
  );
}
