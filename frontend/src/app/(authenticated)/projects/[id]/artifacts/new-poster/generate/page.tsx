"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
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
        px: 1.5,
        py: 0.4,
        borderRadius: "9999px",
        bgcolor: "#F7F7F7",
        border: "1px solid #E8EAED",
        fontSize: "11px",
        fontWeight: 500,
        color: "#5F6368",
      }}
    >
      {label}
    </Box>
  );
}

// ── Variant thumbnail tile ─────────────────────────────────────────────────────

function VariantTile({
  variant,
  isSelected,
  isLoading,
  slot,
  onSelect,
  onRetry,
}: {
  variant: GeneratedVariant | null;
  isSelected: boolean;
  isLoading: boolean;
  slot: number;
  onSelect?: () => void;
  onRetry?: () => void;
}) {
  if (isLoading || !variant) {
    return (
      <Box sx={{ position: "relative" }}>
        <Skeleton
          variant="rectangular"
          sx={{ aspectRatio: "4/5", borderRadius: "10px", width: "100%" }}
          animation="wave"
        />
        <Typography
          sx={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "10px",
            color: "#9E9E9E",
            bgcolor: "rgba(255,255,255,0.85)",
            px: 1,
            borderRadius: "4px",
          }}
        >
          Generating {slot + 1}…
        </Typography>
      </Box>
    );
  }

  if (variant.status === "FAILED") {
    return (
      <Box
        sx={{
          aspectRatio: "4/5",
          borderRadius: "10px",
          bgcolor: "#FFF1F4",
          border: "1.5px solid #F5C6D0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          p: 1,
        }}
      >
        <Typography sx={{ fontSize: "11px", color: "#D0103A", fontWeight: 600 }}>
          Failed
        </Typography>
        {onRetry && variant.retry_token && (
          <Button
            size="small"
            variant="outlined"
            onClick={onRetry}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#D0103A",
              color: "#D0103A",
              fontSize: "11px",
              py: 0.25,
              px: 1.5,
              minHeight: 0,
              "&:hover": { bgcolor: "#FFF1F4" },
            }}
          >
            Retry
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box
      component="button"
      onClick={onSelect}
      sx={{
        display: "block",
        aspectRatio: "4/5",
        borderRadius: "10px",
        overflow: "hidden",
        border: "2.5px solid",
        borderColor: isSelected ? "#D0103A" : "#E8EAED",
        cursor: "pointer",
        transition: "border-color 0.15s",
        bgcolor: "#F7F7F7",
        p: 0,
        "&:hover": { borderColor: "#D0103A" },
      }}
    >
      {variant.image_url ? (
        <Box
          component="img"
          src={variant.image_url}
          alt={`Variant ${slot + 1}`}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ fontSize: "10px", color: "#9E9E9E" }}>
            Variant {slot + 1}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosterGeneratePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { composition, subject, artifactId, setSubject, generation } = usePosterWizard();

  // Variant grid selection — tracked by variant id after initial generation
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Inpainting state
  const [isInpaintMode, setIsInpaintMode] = useState(false);
  const [isInpainting, setIsInpainting] = useState(false);
  const [pendingInpaintTurn, setPendingInpaintTurn] = useState<PendingInpaintTurn | null>(null);

  const hasAutoDispatched = useRef(false);

  const { status, variants, generate, retrySlot, updateVariantImage, addVariant, error } =
    useVariantGeneration({
      artifactId,
      onVariantsReady: (ready) => {
        setSubject({ locked: true });
        if (ready.length > 0) setSelectedVariantId(ready[0].id);
      },
    });

  const isLoading = status === "loading";

  // ── Auto-dispatch on mount ────────────────────────────────────────────────────
  // Skip auto-generation if the artifact already has saved variants (loaded from
  // an existing poster). The user can trigger regeneration manually if needed.

  useEffect(() => {
    if (hasAutoDispatched.current) return;
    if (!artifactId || !composition.merged_prompt || !subject.type) return;
    if (generation.variants.length > 0) return;  // existing poster — don't clobber saved variants
    hasAutoDispatched.current = true;

    generate({
      mergedPrompt: composition.merged_prompt,
      subjectType: subject.type as SubjectType,
      format: (composition.format as CompositionFormat) || "PORTRAIT",
      referenceImageIds: subject.product_asset.reference_image_ids,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId, generation.variants.length]);

  // ── Regen all ─────────────────────────────────────────────────────────────────

  const handleRegenAll = async () => {
    setShowRegenConfirm(false);
    setSelectedVariantId(null);
    setIsInpaintMode(false);
    const result = await generate({
      mergedPrompt: composition.merged_prompt,
      subjectType: subject.type as SubjectType,
      format: (composition.format as CompositionFormat) || "PORTRAIT",
      referenceImageIds: subject.product_asset.reference_image_ids,
    });
    void result;
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

  // ── 2× Upscale ───────────────────────────────────────────────────────────────

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

  const handleInpaintSubmit = async (
    description: string,
    maskFile: File,
    _coveragePct: number,
  ) => {
    if (!artifactId || !selectedVariant) return;
    setIsInpainting(true);
    try {
      const result = await inpaintRegion(
        artifactId,
        selectedVariant.id,
        description,
        composition.merged_prompt,
        maskFile,
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

  // ── Save as variant ───────────────────────────────────────────────────────────

  const handleSaveAsVariant = (newVariant: GeneratedVariant) => {
    addVariant(newVariant);
    setSelectedVariantId(newVariant.id);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null;
  const hasAnyReady = variants.some((v) => v.status === "READY");

  // Grid: show at least 4 placeholder slots initially, grow with variants
  const gridSlotCount = Math.max(4, variants.length);

  const subjectLabel =
    subject.type === "HUMAN_MODEL"
      ? "Human model"
      : subject.type === "PRODUCT_ASSET"
        ? "Product / asset"
        : subject.type === "SCENE_ABSTRACT"
          ? "Scene / abstract"
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
            ? "Generating four poster variants — this takes about 30 seconds…"
            : "Select a variant to preview. Use the chat panel to refine."}
        </Typography>
      </Box>

      {/* Metadata pills */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        <MetaPill label={subjectLabel} />
        {composition.format && <MetaPill label={composition.format} />}
        {composition.layout_template && (
          <MetaPill label={composition.layout_template.replace(/_/g, " ")} />
        )}
        {composition.visual_style && (
          <MetaPill label={composition.visual_style.replace(/_/g, " ")} />
        )}
        {isInpaintMode && (
          <MetaPill label="Edit region mode" />
        )}
      </Box>

      {/* Two-column layout */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* ── Left column ─────────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Variant grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(gridSlotCount, 4)}, 1fr)`,
              gap: 1.5,
              mb: 3,
            }}
          >
            {Array.from({ length: gridSlotCount }).map((_, idx) => {
              const variant = variants[idx] ?? null;
              const isSelected = selectedVariant?.id === variant?.id;
              return (
                <VariantTile
                  key={variant?.id ?? `placeholder-${idx}`}
                  slot={idx}
                  variant={variant}
                  isSelected={isSelected}
                  isLoading={isLoading || (!variant && status !== "error" && status !== "success")}
                  onSelect={variant ? () => {
                    setSelectedVariantId(variant.id);
                    setIsInpaintMode(false);
                  } : undefined}
                  onRetry={
                    variant?.status === "FAILED" ? () => handleRetrySlot(variant) : undefined
                  }
                />
              );
            })}
          </Box>

          {/* Main preview / inpaint overlay */}
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
                aspectRatio: "4/5",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid #E8EAED",
                bgcolor: "#F7F7F7",
                mb: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isLoading ? (
                <Box sx={{ textAlign: "center" }}>
                  <CircularProgress sx={{ color: "#D0103A", mb: 1 }} />
                  <Typography sx={{ fontSize: "13px", color: "#5F6368" }}>
                    Generating variants…
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
                <Typography sx={{ fontSize: "13px", color: "#D0103A" }}>
                  Generation failed for this variant.
                </Typography>
              ) : (
                <Typography sx={{ fontSize: "13px", color: "#9E9E9E" }}>
                  {status === "error" ? "Generation failed." : "Select a variant above to preview"}
                </Typography>
              )}
            </Box>
          )}

          {/* Action toolbar */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            {/* Edit region */}
            <Button
              size="small"
              variant={isInpaintMode ? "contained" : "outlined"}
              disabled={!selectedVariant?.image_url || isLoading}
              onClick={() => setIsInpaintMode((v) => !v)}
              disableElevation
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                fontSize: "12px",
                ...(isInpaintMode
                  ? { bgcolor: "#D0103A", color: "white", "&:hover": { bgcolor: "#A00D2E" } }
                  : { borderColor: "#E8EAED", color: "#1F1F1F", "&:hover": { borderColor: "#ABABAB" } }),
              }}
            >
              {isInpaintMode ? "Cancel edit" : "Edit region"}
            </Button>

            {/* Export PNG */}
            <Button
              size="small"
              variant="outlined"
              disabled={!hasAnyReady || !!isExporting}
              onClick={() => handleExport("png")}
              startIcon={
                isExporting === "png" ? (
                  <CircularProgress size={12} sx={{ color: "#D0103A" }} />
                ) : undefined
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#1F1F1F",
                fontSize: "12px",
                "&:hover": { borderColor: "#ABABAB" },
              }}
            >
              Export PNG
            </Button>

            {/* Export JPG */}
            <Button
              size="small"
              variant="outlined"
              disabled={!hasAnyReady || !!isExporting}
              onClick={() => handleExport("jpg")}
              startIcon={
                isExporting === "jpg" ? (
                  <CircularProgress size={12} sx={{ color: "#D0103A" }} />
                ) : undefined
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#1F1F1F",
                fontSize: "12px",
                "&:hover": { borderColor: "#ABABAB" },
              }}
            >
              Export JPG
            </Button>

            {/* Export PDF (print-ready) */}
            <Button
              size="small"
              variant="outlined"
              disabled={!hasAnyReady || !!isExporting}
              onClick={() => handleExport("pdf")}
              startIcon={
                isExporting === "pdf" ? (
                  <CircularProgress size={12} sx={{ color: "#D0103A" }} />
                ) : undefined
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#1F1F1F",
                fontSize: "12px",
                "&:hover": { borderColor: "#ABABAB" },
              }}
            >
              Export PDF
            </Button>

            {/* 2× Upscale */}
            <Button
              size="small"
              variant="outlined"
              disabled={!selectedVariant?.image_url || isUpscaling || isLoading}
              onClick={handleUpscale}
              startIcon={
                isUpscaling ? (
                  <CircularProgress size={12} sx={{ color: "#D0103A" }} />
                ) : undefined
              }
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#1F1F1F",
                fontSize: "12px",
                "&:hover": { borderColor: "#ABABAB" },
              }}
            >
              {isUpscaling ? "Upscaling…" : "2× Upscale"}
            </Button>

            {/* Regen all */}
            <Button
              size="small"
              variant="outlined"
              disabled={isLoading}
              onClick={() => setShowRegenConfirm(true)}
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#5F6368",
                fontSize: "12px",
                "&:hover": { borderColor: "#ABABAB" },
              }}
            >
              Regen all
            </Button>
          </Box>

          {(error || exportError) && (
            <Typography sx={{ mt: 1.5, fontSize: "13px", color: "#D0103A" }}>
              {error || exportError}
            </Typography>
          )}
        </Box>

        {/* ── Right column — chat panel ────────────────────────────────────────── */}
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            borderRadius: "12px",
            border: "1px solid #E8EAED",
            bgcolor: "#FAFAFA",
            display: "flex",
            flexDirection: "column",
            // Match approximate height of left column
            minHeight: 560,
            overflow: "hidden",
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

      {/* Regen-all confirm dialog */}
      <Dialog
        open={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "16px", fontWeight: 700, color: "#1F1F1F" }}>
          Regenerate all variants?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "14px", color: "#5F6368" }}>
            All four variants will be regenerated using the current composition prompt. Any chat
            refinements on the selected variant will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setShowRegenConfirm(false)}
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
            onClick={handleRegenAll}
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
            Regenerate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
