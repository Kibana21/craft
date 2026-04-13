"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useVariantGeneration } from "../_hooks/use-variant-generation";
import { usePosterWizard } from "../layout";
import { exportArtifact, getDownloadUrl } from "@/lib/api/exports";
import { inpaintRegion, upscaleVariant } from "@/lib/api/poster-wizard";
import { ChatPanel } from "@/components/poster-wizard/chat/chat-panel";
import { InpaintOverlay } from "@/components/poster-wizard/chat/inpaint-overlay";
import type { PendingInpaintTurn } from "@/components/poster-wizard/chat/chat-panel";
import type { SubjectType, CompositionFormat } from "@/types/poster-wizard";
import type { GeneratedVariant } from "@/lib/api/poster-wizard";

// ── Metadata badge ─────────────────────────────────────────────────────────────

function MetaPill({ label }: { label: string }) {
  return (
    <Box
      sx={{
        px: 1.5, py: 0.4, borderRadius: "9999px",
        bgcolor: "#F7F7F7", border: "1px solid #E8EAED",
        fontSize: "11px", fontWeight: 500, color: "#5F6368",
      }}
    >
      {label}
    </Box>
  );
}

// ── Thumbnail strip tile ───────────────────────────────────────────────────────

function StripTile({
  variant,
  isSelected,
  isLoading,
  index,
  onSelect,
  onRetry,
}: {
  variant: GeneratedVariant | null;
  isSelected: boolean;
  isLoading: boolean;
  index: number;
  onSelect?: () => void;
  onRetry?: () => void;
}) {
  const THUMB_W = 72;

  if (isLoading || !variant) {
    return (
      <Box sx={{ position: "relative", width: THUMB_W, flexShrink: 0 }}>
        <Skeleton
          variant="rectangular"
          sx={{ width: THUMB_W, aspectRatio: "4/5", borderRadius: "8px" }}
          animation="wave"
        />
        <Typography sx={{
          position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
          fontSize: "9px", color: "#9E9E9E", bgcolor: "rgba(255,255,255,0.9)",
          px: 0.75, borderRadius: "3px", whiteSpace: "nowrap",
        }}>
          Generating…
        </Typography>
      </Box>
    );
  }

  if (variant.status === "FAILED") {
    return (
      <Tooltip title={onRetry && variant.retry_token ? "Click to retry" : "Generation failed"}>
        <Box
          component={onRetry && variant.retry_token ? "button" : "div"}
          onClick={onRetry && variant.retry_token ? onRetry : undefined}
          sx={{
            width: THUMB_W, aspectRatio: "4/5", borderRadius: "8px", flexShrink: 0,
            bgcolor: "#FFF1F4", border: "1.5px solid #F5C6D0",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 0.5,
            cursor: onRetry && variant.retry_token ? "pointer" : "default",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D0103A" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <Typography sx={{ fontSize: "9px", color: "#D0103A", fontWeight: 600 }}>Failed</Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      component="button"
      onClick={onSelect}
      sx={{
        width: THUMB_W, aspectRatio: "4/5", borderRadius: "8px", flexShrink: 0,
        overflow: "hidden", border: "2px solid",
        borderColor: isSelected ? "#D0103A" : "#E8EAED",
        cursor: "pointer", transition: "border-color 0.15s",
        bgcolor: "#F7F7F7", p: 0, position: "relative",
        "&:hover": { borderColor: isSelected ? "#D0103A" : "#ABABAB" },
      }}
    >
      {variant.image_url ? (
        <Box
          component="img"
          src={variant.image_url}
          alt={`Variant ${index + 1}`}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ fontSize: "9px", color: "#9E9E9E" }}>{index + 1}</Typography>
        </Box>
      )}
      {isSelected && (
        <Box sx={{
          position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
          width: 6, height: 6, borderRadius: "50%", bgcolor: "#D0103A",
        }} />
      )}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosterGeneratePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { composition, subject, artifactId, setSubject, generation } = usePosterWizard();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isInpaintMode, setIsInpaintMode] = useState(false);
  const [isInpainting, setIsInpainting] = useState(false);
  const [pendingInpaintTurn, setPendingInpaintTurn] = useState<PendingInpaintTurn | null>(null);

  const hasAutoDispatched = useRef(false);

  // Variants persisted on the artifact use the PosterVariant shape (image_url,
  // generated_at, status, selected, …). The generation hook works in the
  // API-response shape (GeneratedVariant: id, slot, status, image_url,
  // error_code, retry_token). Map once on mount so re-opening an existing
  // poster immediately shows its saved variants in the canvas and strip.
  const seededVariants: GeneratedVariant[] = useMemo(
    () =>
      (generation.variants ?? [])
        .filter((v) => v.status === "READY" || v.status === "FAILED")
        .map((v, idx) => ({
          id: v.id,
          slot: idx,
          status: v.status as "READY" | "FAILED",
          image_url: v.image_url,
          error_code: null,
          // Retry tokens aren't persisted — they're Redis-scoped and expire with
          // the job. Existing variants can't be retried; only regenerated.
          retry_token: null,
        })),
    // Intentionally only depend on artifactId: we seed on first mount for this
    // artifact and hand ownership of `variants` to the hook thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artifactId],
  );

  const { status, variants, generate, appendOne, retrySlot, updateVariantImage, addVariant, error, isLoading, isAppending } =
    useVariantGeneration({
      artifactId,
      initialVariants: seededVariants,
      onVariantsReady: (ready) => {
        setSubject({ locked: true });
        // Auto-select the first ready variant if nothing is selected yet
        if (ready.length > 0 && !selectedVariantId) setSelectedVariantId(ready[0].id);
      },
    });

  // If we seeded variants for an existing poster, auto-select the first ready
  // one so the canvas renders it instead of the "Your poster will appear here"
  // placeholder.
  useEffect(() => {
    if (selectedVariantId) return;
    const firstReady = seededVariants.find((v) => v.status === "READY");
    if (firstReady) setSelectedVariantId(firstReady.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId]);

  // Auto-generate the first image on mount (count=1 — no batch, no waste)
  useEffect(() => {
    if (hasAutoDispatched.current) return;
    if (!artifactId || !composition.merged_prompt || !subject.type) return;
    if (generation.variants.length > 0) return; // existing poster — don't overwrite
    hasAutoDispatched.current = true;

    generate({
      mergedPrompt: composition.merged_prompt,
      subjectType: subject.type as SubjectType,
      format: (composition.format as CompositionFormat) || "PORTRAIT",
      referenceImageIds: subject.product_asset.reference_image_ids,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId, generation.variants.length]);

  // ── Generate one more ─────────────────────────────────────────────────────────

  const handleGenerateAnother = () => {
    if (!composition.merged_prompt || !subject.type) return;
    appendOne({
      mergedPrompt: composition.merged_prompt,
      subjectType: subject.type as SubjectType,
      format: (composition.format as CompositionFormat) || "PORTRAIT",
      referenceImageIds: subject.product_asset.reference_image_ids,
    });
  };

  // ── Retry single slot ─────────────────────────────────────────────────────────

  const handleRetrySlot = async (variant: GeneratedVariant) => {
    if (!variant.retry_token) return;
    await retrySlot({
      slot: variant.slot,
      retryToken: variant.retry_token,
      mergedPrompt: composition.merged_prompt,
      subjectType: subject.type as SubjectType,
      referenceImageIds: subject.product_asset.reference_image_ids,
    });
  };

  // ── Export ────────────────────────────────────────────────────────────────────

  const handleExport = async (format: "png" | "jpg" | "pdf") => {
    if (!artifactId) return;
    setIsExporting(format);
    setExportError(null);
    try {
      const result = await exportArtifact(artifactId, format);
      window.open(getDownloadUrl(result.export_id), "_blank");
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setIsExporting(null);
    }
  };

  // ── Upscale ───────────────────────────────────────────────────────────────────

  const handleUpscale = async () => {
    if (!artifactId || !selectedVariant) return;
    setIsUpscaling(true);
    setExportError(null);
    try {
      const result = await upscaleVariant(artifactId, selectedVariant.id);
      updateVariantImage(selectedVariant.id, result.image_url);
    } catch {
      setExportError("Upscale failed. Please try again.");
    } finally {
      setIsUpscaling(false);
    }
  };

  // ── Inpaint ───────────────────────────────────────────────────────────────────

  const handleInpaintSubmit = async (description: string, maskFile: File, _coveragePct: number) => {
    if (!artifactId || !selectedVariant) return;
    setIsInpainting(true);
    try {
      const result = await inpaintRegion(
        artifactId, selectedVariant.id, description,
        composition.merged_prompt, maskFile,
      );
      setPendingInpaintTurn({
        turn_id: result.turn_id,
        new_image_url: result.new_image_url,
        change_description: result.change_description,
      });
      setIsInpaintMode(false);
    } catch {
      setExportError("Inpainting failed. Please try again.");
      setIsInpaintMode(false);
    } finally {
      setIsInpainting(false);
    }
  };

  const handleSaveAsVariant = (newVariant: GeneratedVariant) => {
    addVariant(newVariant);
    setSelectedVariantId(newVariant.id);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null;
  const hasAnyReady = variants.some((v) => v.status === "READY");
  const isBusy = isLoading || isAppending;

  const subjectLabel =
    subject.type === "HUMAN_MODEL" ? "Human model"
      : subject.type === "PRODUCT_ASSET" ? "Product / asset"
        : subject.type === "SCENE_ABSTRACT" ? "Scene / abstract"
          : "—";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ borderRadius: "16px", border: "1px solid #E8EAED", bgcolor: "#FFFFFF", p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: "22px", fontWeight: 700, color: "#1F1F1F" }}>
          Generate &amp; refine
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#5F6368" }}>
          {isLoading
            ? "Generating your poster — this takes about 10 seconds…"
            : isAppending
              ? "Generating another variant…"
              : "Select a variant to preview. Use the chat panel to refine or generate more."}
        </Typography>
      </Box>

      {/* Meta pills */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        <MetaPill label={subjectLabel} />
        {composition.format && <MetaPill label={composition.format} />}
        {composition.layout_template && <MetaPill label={composition.layout_template.replace(/_/g, " ")} />}
        {composition.visual_style && <MetaPill label={composition.visual_style.replace(/_/g, " ")} />}
        {isInpaintMode && <MetaPill label="Edit region mode" />}
      </Box>

      {/* Two-column layout */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>

        {/* ── Left column ───────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>

          {/* Large preview / inpaint overlay */}
          {isInpaintMode && selectedVariant?.image_url ? (
            <Box sx={{ mb: 2 }}>
              <InpaintOverlay
                imageUrl={selectedVariant.image_url}
                onSubmit={handleInpaintSubmit}
                onCancel={() => setIsInpaintMode(false)}
                isLoading={isInpainting}
              />
            </Box>
          ) : (
            <Box
              sx={{
                aspectRatio: "4/5", borderRadius: "12px", overflow: "hidden",
                border: "1px solid #E8EAED", bgcolor: "#F7F7F7",
                display: "flex", alignItems: "center", justifyContent: "center",
                mb: 2,
              }}
            >
              {isLoading ? (
                <Box sx={{ textAlign: "center" }}>
                  <CircularProgress sx={{ color: "#D0103A", mb: 1 }} />
                  <Typography sx={{ fontSize: "13px", color: "#5F6368" }}>
                    Generating…
                  </Typography>
                </Box>
              ) : selectedVariant?.image_url ? (
                <Box
                  component="img"
                  src={selectedVariant.image_url}
                  alt="Selected variant"
                  sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              ) : selectedVariant?.status === "FAILED" ? (
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontSize: "14px", color: "#D0103A", mb: 1 }}>
                    Generation failed
                  </Typography>
                  <Button
                    size="small" variant="outlined"
                    onClick={() => selectedVariant.retry_token ? handleRetrySlot(selectedVariant) : handleGenerateAnother()}
                    sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#D0103A", color: "#D0103A", fontSize: "12px", "&:hover": { bgcolor: "#FFF1F4" } }}
                  >
                    Try again
                  </Button>
                </Box>
              ) : (
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontSize: "14px", color: "#9E9E9E", mb: 1.5 }}>
                    {status === "error" ? "Generation failed. Try generating again." : "Your poster will appear here"}
                  </Typography>
                  {status !== "loading" && (
                    <Button
                      variant="contained" disableElevation onClick={handleGenerateAnother}
                      disabled={isBusy}
                      sx={{ borderRadius: 2, textTransform: "none", bgcolor: "#D0103A", color: "white", fontWeight: 600, "&:hover": { bgcolor: "#A00D2E" } }}
                    >
                      Generate
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Thumbnail strip */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "nowrap", overflowX: "auto", pb: 0.5 }}>
            {/* Existing / in-progress thumbnails */}
            {variants.map((variant, idx) => (
              <StripTile
                key={variant.id}
                index={idx}
                variant={variant}
                isSelected={selectedVariant?.id === variant.id}
                isLoading={false}
                onSelect={() => { setSelectedVariantId(variant.id); setIsInpaintMode(false); }}
                onRetry={variant.status === "FAILED" ? () => handleRetrySlot(variant) : undefined}
              />
            ))}

            {/* Loading placeholder while appending */}
            {isAppending && (
              <StripTile
                key="appending"
                index={variants.length}
                variant={null}
                isSelected={false}
                isLoading={true}
              />
            )}

            {/* "Generate another" button */}
            <Tooltip title={isBusy ? "Wait for current generation to finish" : "Generate one more variant"}>
              <Box
                component="button"
                onClick={!isBusy ? handleGenerateAnother : undefined}
                sx={{
                  width: 72, aspectRatio: "4/5", flexShrink: 0,
                  borderRadius: "8px", border: "1.5px dashed",
                  borderColor: isBusy ? "#E8EAED" : "#D0103A",
                  bgcolor: isBusy ? "#FAFAFA" : "#FFF1F4",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 0.5,
                  cursor: isBusy ? "default" : "pointer",
                  transition: "all 0.15s",
                  "&:hover": isBusy ? {} : { bgcolor: "#FFE4EA" },
                }}
              >
                {isAppending ? (
                  <CircularProgress size={14} sx={{ color: "#D0103A" }} />
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke={isBusy ? "#BDBDBD" : "#D0103A"} strokeWidth="2.2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <Typography sx={{ fontSize: "9px", fontWeight: 600, color: isBusy ? "#BDBDBD" : "#D0103A" }}>
                      Generate
                    </Typography>
                  </>
                )}
              </Box>
            </Tooltip>
          </Box>

          {/* Action toolbar */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              size="small"
              variant={isInpaintMode ? "contained" : "outlined"}
              disabled={!selectedVariant?.image_url || isBusy}
              onClick={() => setIsInpaintMode((v) => !v)}
              disableElevation
              sx={{
                borderRadius: 9999, textTransform: "none", fontSize: "12px",
                ...(isInpaintMode
                  ? { bgcolor: "#D0103A", color: "white", "&:hover": { bgcolor: "#A00D2E" } }
                  : { borderColor: "#E8EAED", color: "#1F1F1F", "&:hover": { borderColor: "#ABABAB" } }),
              }}
            >
              {isInpaintMode ? "Cancel edit" : "Edit region"}
            </Button>

            {(["png", "jpg", "pdf"] as const).map((fmt) => (
              <Button
                key={fmt}
                size="small" variant="outlined"
                disabled={!hasAnyReady || !!isExporting}
                onClick={() => handleExport(fmt)}
                startIcon={isExporting === fmt ? <CircularProgress size={12} sx={{ color: "#D0103A" }} /> : undefined}
                sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#1F1F1F", fontSize: "12px", "&:hover": { borderColor: "#ABABAB" } }}
              >
                Export {fmt.toUpperCase()}
              </Button>
            ))}

            <Button
              size="small" variant="outlined"
              disabled={!selectedVariant?.image_url || isUpscaling || isBusy}
              onClick={handleUpscale}
              startIcon={isUpscaling ? <CircularProgress size={12} sx={{ color: "#D0103A" }} /> : undefined}
              sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#1F1F1F", fontSize: "12px", "&:hover": { borderColor: "#ABABAB" } }}
            >
              {isUpscaling ? "Upscaling…" : "2× Upscale"}
            </Button>
          </Box>

          {(error || exportError) && (
            <Typography sx={{ mt: 1.5, fontSize: "13px", color: "#D0103A" }}>
              {error || exportError}
            </Typography>
          )}
        </Box>

        {/* ── Right column — chat panel ────────────────────────────────────── */}
        <Box
          sx={{
            width: 320, flexShrink: 0, borderRadius: "12px",
            border: "1px solid #E8EAED", bgcolor: "#FAFAFA",
            display: "flex", flexDirection: "column",
            minHeight: 560, overflow: "hidden",
          }}
        >
          <ChatPanel
            artifactId={artifactId}
            variantId={selectedVariant?.id ?? null}
            mergedPrompt={composition.merged_prompt}
            onVariantImageUpdate={updateVariantImage}
            onSaveAsVariant={handleSaveAsVariant}
            pendingInpaintTurn={pendingInpaintTurn}
            onInpaintTurnConsumed={() => setPendingInpaintTurn(null)}
            projectId={projectId}
          />
        </Box>
      </Box>

      {/* Back to project */}
      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-start" }}>
        <Button
          variant="outlined"
          onClick={() => router.push(`/projects/${projectId}`)}
          sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368", "&:hover": { borderColor: "#ABABAB" } }}
        >
          ← Back to project
        </Button>
      </Box>
    </Box>
  );
}
