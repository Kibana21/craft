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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import { exportArtifact, getDownloadUrl } from "@/lib/api/exports";
import {
  inpaintRegion,
  upscaleVariant,
  listVariantTurns,
  restoreVariantTurn,
  staticPosterUrl,
} from "@/lib/api/poster-wizard";
import { ChatPanel } from "@/components/poster-wizard/chat/chat-panel";
import { InpaintOverlay } from "@/components/poster-wizard/chat/inpaint-overlay";
import type { PendingInpaintTurn } from "@/components/poster-wizard/chat/chat-panel";
import type { SubjectType, CompositionFormat } from "@/types/poster-wizard";
import type { GeneratedVariant, VariantTurnItem } from "@/lib/api/poster-wizard";

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
          src={staticPosterUrl(variant.image_url)}
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
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTurns, setHistoryTurns] = useState<VariantTurnItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringTurnId, setRestoringTurnId] = useState<string | null>(null);

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

  // ── History (variant refinement turns) ───────────────────────────────────

  const handleOpenHistory = async () => {
    if (!artifactId || !selectedVariant) return;
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const { turns } = await listVariantTurns(artifactId, selectedVariant.id);
      setHistoryTurns(turns);
    } catch (err: unknown) {
      const apiErr = err as { detail?: unknown; status?: number };
      const detail = typeof apiErr.detail === "string"
        ? apiErr.detail
        : typeof apiErr.detail === "object" && apiErr.detail !== null
          ? ((apiErr.detail as { detail?: string }).detail ?? JSON.stringify(apiErr.detail))
          : null;
      const status = apiErr.status ? ` (${apiErr.status})` : "";
      setHistoryError(`Couldn't load history${status}: ${detail ?? "unknown error"}`);
      setHistoryTurns([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleRestoreTurn = async (turn: VariantTurnItem) => {
    if (!artifactId || !selectedVariant) return;
    setRestoringTurnId(turn.turn_id);
    try {
      const { image_url } = await restoreVariantTurn(artifactId, selectedVariant.id, turn.turn_id);
      updateVariantImage(selectedVariant.id, image_url);
      setIsHistoryOpen(false);
    } catch {
      setHistoryError("Restore failed. Please try again.");
    } finally {
      setRestoringTurnId(null);
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
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5, alignItems: "center" }}>
        <MetaPill label={subjectLabel} />
        {composition.format && <MetaPill label={composition.format} />}
        {composition.layout_template && <MetaPill label={composition.layout_template.replace(/_/g, " ")} />}
        {composition.visual_style && <MetaPill label={composition.visual_style.replace(/_/g, " ")} />}
        {isInpaintMode && <MetaPill label="Edit region mode" />}

        {composition.merged_prompt && (
          <Box
            component="button"
            onClick={() => setIsPromptOpen((v) => !v)}
            aria-expanded={isPromptOpen}
            sx={{
              ml: "auto", display: "inline-flex", alignItems: "center", gap: 0.5,
              px: 1.5, py: 0.4, borderRadius: "9999px",
              border: "1px solid #E8EAED", bgcolor: isPromptOpen ? "#F7F7F7" : "#FFFFFF",
              fontSize: "11px", fontWeight: 500, color: "#5F6368", cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { borderColor: "#ABABAB", bgcolor: "#F7F7F7" },
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
            {isPromptOpen ? "Hide prompt" : "View prompt"}
          </Box>
        )}
      </Box>

      {/* Expandable prompt panel. The prompt is built deterministically on the
          Compose step from brief + subject + copy + composition settings and
          is persisted on artifact.content.composition.merged_prompt. */}
      {isPromptOpen && composition.merged_prompt && (
        <Box
          sx={{
            mb: 3, borderRadius: "10px", border: "1px solid #E8EAED",
            bgcolor: "#FAFAFA", overflow: "hidden",
          }}
        >
          <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            px: 1.5, py: 1, borderBottom: "1px solid #E8EAED", bgcolor: "#FFFFFF",
          }}>
            <Typography sx={{ fontSize: "11px", fontWeight: 600, color: "#5F6368", letterSpacing: "0.02em" }}>
              MERGED PROMPT · sent to the image model
            </Typography>
            <Box
              component="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(composition.merged_prompt);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // Clipboard denied — silent; user can still select-and-copy.
                }
              }}
              sx={{
                display: "inline-flex", alignItems: "center", gap: 0.5,
                px: 1, py: 0.25, borderRadius: "6px", border: "none",
                bgcolor: "transparent", color: copied ? "#188038" : "#5F6368",
                fontSize: "11px", fontWeight: 500, cursor: "pointer",
                "&:hover": { bgcolor: "#F1F3F4" },
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Box>
          </Box>
          <Box
            component="pre"
            sx={{
              m: 0, px: 1.5, py: 1.25, maxHeight: 480, overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "12px", lineHeight: 1.55, color: "#1F1F1F",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              // Always show a scrollbar track so the user can tell when
              // content is clipped vs actually complete.
              "&::-webkit-scrollbar": { width: "8px" },
              "&::-webkit-scrollbar-thumb": { background: "#DADCE0", borderRadius: "4px" },
              "&::-webkit-scrollbar-track": { background: "transparent" },
            }}
          >
            {composition.merged_prompt}
          </Box>
        </Box>
      )}

      {/* Two-column layout */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>

        {/* ── Left column ───────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>

          {/* Large preview / inpaint overlay */}
          {isInpaintMode && selectedVariant?.image_url ? (
            <Box sx={{ mb: 2 }}>
              <InpaintOverlay
                imageUrl={staticPosterUrl(selectedVariant.image_url)}
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
                  src={staticPosterUrl(selectedVariant.image_url)}
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

            <Button
              size="small" variant="outlined"
              disabled={!selectedVariant}
              onClick={handleOpenHistory}
              startIcon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
                  <polyline points="3 3 3 8 8 8"/>
                  <polyline points="12 7 12 12 15 14"/>
                </svg>
              }
              sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#1F1F1F", fontSize: "12px", "&:hover": { borderColor: "#ABABAB" } }}
            >
              History
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

      {/* ── Refinement history dialog ─────────────────────────────────────── */}
      <Dialog
        open={isHistoryOpen}
        onClose={() => !restoringTurnId && setIsHistoryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A" }}>
            Refinement history
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: "12px", color: "#5F6368" }}>
            Every chat refine or region edit for this variant. Restoring swaps the image only —
            the turn counter and change log stay as they are.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: "0 !important" }}>
          {isHistoryLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress sx={{ color: "#D0103A" }} size={28} />
            </Box>
          ) : historyError ? (
            <Typography sx={{ fontSize: "13px", color: "#D0103A", py: 2 }}>
              {historyError}
            </Typography>
          ) : historyTurns.length === 0 ? (
            <Typography sx={{ fontSize: "13px", color: "#9E9E9E", py: 3, textAlign: "center" }}>
              No refinement history yet. Use the chat panel to refine this variant.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, py: 1 }}>
              {historyTurns.map((turn) => {
                const isCurrent = selectedVariant?.image_url === turn.resulting_image_url;
                const restoring = restoringTurnId === turn.turn_id;
                return (
                  <Box
                    key={turn.turn_id}
                    sx={{
                      display: "flex", alignItems: "flex-start", gap: 1.5,
                      p: 1.25, borderRadius: "12px",
                      border: "1px solid",
                      borderColor: isCurrent ? "#D0103A" : "#E8EAED",
                      bgcolor: isCurrent ? "#FFF5F7" : "#FFFFFF",
                    }}
                  >
                    {/* Thumbnail */}
                    <Box
                      component="img"
                      src={staticPosterUrl(turn.resulting_image_url)}
                      alt={`Turn ${turn.turn_index + 1}`}
                      sx={{
                        width: 72, aspectRatio: "4/5", objectFit: "cover",
                        borderRadius: "8px", border: "1px solid #E8EAED", flexShrink: 0,
                      }}
                    />

                    {/* Meta */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#5F6368" }}>
                          TURN {turn.turn_index + 1}
                        </Typography>
                        <Box sx={{
                          px: 0.75, py: 0.1, borderRadius: "4px",
                          bgcolor: turn.action_type === "INPAINT" ? "#EDE7F6" : "#E8F0FE",
                          color: turn.action_type === "INPAINT" ? "#6A3FB5" : "#1967D2",
                          fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.02em",
                        }}>
                          {turn.action_type === "INPAINT" ? "REGION" : "CHAT"}
                        </Box>
                        <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>
                          {new Date(turn.created_at).toLocaleString(undefined, {
                            month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </Typography>
                        {isCurrent && (
                          <Typography sx={{
                            ml: "auto", fontSize: "10.5px", fontWeight: 700, color: "#D0103A",
                          }}>
                            CURRENT
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{
                        fontSize: "13px", color: "#1F1F1F", lineHeight: 1.45, mb: 0.5,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {turn.user_message}
                      </Typography>
                      {turn.ai_response && (
                        <Typography sx={{ fontSize: "11.5px", fontStyle: "italic", color: "#5F6368" }}>
                          → {turn.ai_response}
                        </Typography>
                      )}
                    </Box>

                    {/* Restore button */}
                    <Button
                      size="small"
                      variant={isCurrent ? "text" : "outlined"}
                      disabled={isCurrent || !!restoringTurnId}
                      onClick={() => handleRestoreTurn(turn)}
                      startIcon={restoring ? <CircularProgress size={12} sx={{ color: "#D0103A" }} /> : undefined}
                      sx={{
                        borderRadius: 9999, textTransform: "none", fontSize: "12px",
                        minWidth: 88, flexShrink: 0, alignSelf: "center",
                        ...(isCurrent
                          ? { color: "#9E9E9E" }
                          : { borderColor: "#E8EAED", color: "#1F1F1F", "&:hover": { borderColor: "#D0103A", color: "#D0103A" } }),
                      }}
                    >
                      {restoring ? "Restoring…" : isCurrent ? "Shown" : "Restore"}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
