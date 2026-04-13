"use client";

import { useRef, useState } from "react";
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
import {
  generateAppearanceParagraph,
  generateSceneDescription,
  uploadReferenceImage,
  deleteReferenceImage,
} from "@/lib/api/poster-wizard";
import { updateArtifact } from "@/lib/api/artifacts";
import { usePosterWizard } from "../layout";
import type {
  BackgroundTreatment,
  PostureFraming,
  ProductPlacement,
  SceneVisualStyle,
  SubjectType,
} from "@/types/poster-wizard";

// ── Options ───────────────────────────────────────────────────────────────────

const SUBJECT_TYPES: { key: SubjectType; label: string; desc: string; mode: string }[] = [
  { key: "HUMAN_MODEL", label: "Human model", desc: "A person — generated or described", mode: "Text → Image" },
  { key: "PRODUCT_ASSET", label: "Product / asset", desc: "Upload a product image to feature", mode: "Image → Image" },
  { key: "SCENE_ABSTRACT", label: "Scene / abstract", desc: "A setting, concept, or visual mood", mode: "Text → Image" },
];

const POSTURES: { key: PostureFraming; label: string }[] = [
  { key: "FACING_CAMERA", label: "Facing camera" },
  { key: "THREE_QUARTER", label: "Three-quarter" },
  { key: "PROFILE", label: "Profile" },
  { key: "LOOKING_UP", label: "Looking up" },
];

const PLACEMENTS: { key: ProductPlacement; label: string }[] = [
  { key: "HERO_CENTRED", label: "Hero centred" },
  { key: "LIFESTYLE_CONTEXT", label: "Lifestyle context" },
  { key: "DETAIL_CLOSE", label: "Detail close-up" },
  { key: "FLOATING", label: "Floating" },
];

const BACKGROUNDS: { key: BackgroundTreatment; label: string }[] = [
  { key: "REPLACE", label: "Replace background" },
  { key: "EXTEND", label: "Extend background" },
  { key: "KEEP_ORIGINAL", label: "Keep original" },
  { key: "ABSTRACT_BLEND", label: "Abstract blend" },
];

const SCENE_STYLES: { key: SceneVisualStyle; label: string }[] = [
  { key: "PHOTOREALISTIC", label: "Photorealistic" },
  { key: "EDITORIAL_GRAPHIC", label: "Editorial graphic" },
  { key: "ILLUSTRATED", label: "Illustrated" },
  { key: "ABSTRACT", label: "Abstract / painterly" },
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

function ChipSelector<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { key: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {options.map((opt) => {
        const isSelected = value === opt.key;
        return (
          <Box
            key={opt.key}
            component="button"
            onClick={() => !disabled && onChange(opt.key)}
            sx={{
              px: 2,
              py: 0.75,
              borderRadius: "9999px",
              border: "1.5px solid",
              borderColor: isSelected ? "#D0103A" : "#E5E5E5",
              bgcolor: isSelected ? "#D0103A" : "#FFFFFF",
              color: isSelected ? "#FFFFFF" : disabled ? "#ABABAB" : "#484848",
              fontSize: "0.875rem",
              fontWeight: isSelected ? 600 : 500,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled && !isSelected ? 0.6 : 1,
              transition: "all 0.15s",
              "&:hover": disabled
                ? {}
                : { borderColor: "#D0103A", bgcolor: isSelected ? "#A00D2E" : "#FFF1F4" },
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

export default function PosterSubjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { subject, setSubject, setGeneration, brief, artifactId, isSaving, setIsSaving, getContentPayload } =
    usePosterWizard();
  const [error, setError] = useState<string | null>(null);

  // ── AI state ─────────────────────────────────────────────────────────────────
  const [isGeneratingAppearance, setIsGeneratingAppearance] = useState(false);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);

  // ── Upload state ──────────────────────────────────────────────────────────────
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Unlock confirm modal ──────────────────────────────────────────────────────
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  // ── Validation ────────────────────────────────────────────────────────────────

  const humanModelValid =
    subject.type === "HUMAN_MODEL" &&
    subject.human_model.appearance_keywords.trim().length > 0 &&
    subject.human_model.expression_mood.trim().length > 0 &&
    subject.human_model.full_appearance.trim().length > 0 &&
    subject.human_model.posture_framing !== "";

  const productAssetValid =
    subject.type === "PRODUCT_ASSET" &&
    subject.product_asset.reference_image_ids.length > 0 &&
    subject.product_asset.placement !== "" &&
    subject.product_asset.background_treatment !== "";

  const sceneAbstractValid =
    subject.type === "SCENE_ABSTRACT" &&
    subject.scene_abstract.description.trim().length > 0 &&
    subject.scene_abstract.visual_style !== "";

  const isValid =
    subject.type !== "" && (humanModelValid || productAssetValid || sceneAbstractValid);

  // ── AI actions ────────────────────────────────────────────────────────────────

  const canGenerateAppearance =
    subject.human_model.appearance_keywords.trim().length > 0 &&
    subject.human_model.expression_mood.trim().length > 0 &&
    subject.human_model.posture_framing !== "";

  const handleGenerateAppearance = async () => {
    if (!canGenerateAppearance) return;
    setIsGeneratingAppearance(true);
    try {
      const result = await generateAppearanceParagraph({
        appearance_keywords: subject.human_model.appearance_keywords,
        expression_mood: subject.human_model.expression_mood,
        posture_framing: subject.human_model.posture_framing as PostureFraming,
        brief_context: brief.narrative || undefined,
      });
      setSubject({ human_model: { ...subject.human_model, full_appearance: result.paragraph } });
    } catch {
      setError("Could not generate appearance description. Please try again.");
    } finally {
      setIsGeneratingAppearance(false);
    }
  };

  const handleGenerateSceneDescription = async () => {
    if (subject.scene_abstract.visual_style === "") return;
    setIsGeneratingScene(true);
    try {
      const result = await generateSceneDescription({
        visual_style: subject.scene_abstract.visual_style as SceneVisualStyle,
        brief_context: brief.narrative || undefined,
        seed_hint: subject.scene_abstract.description || undefined,
      });
      setSubject({ scene_abstract: { ...subject.scene_abstract, description: result.description } });
    } catch {
      setError("Could not generate scene description. Please try again.");
    } finally {
      setIsGeneratingScene(false);
    }
  };

  // ── File upload ────────────────────────────────────────────────────────────────

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 3 - uploadedImages.length;
    if (remaining <= 0) return;
    setIsUploading(true);
    setError(null);
    try {
      const toUpload = Array.from(files).slice(0, remaining);
      const results = await Promise.all(toUpload.map((f) => uploadReferenceImage(f, artifactId ?? undefined)));
      const newImages = results.map((r) => ({ id: r.id, url: r.storage_url }));
      setUploadedImages((prev) => [...prev, ...newImages]);
      setSubject({
        product_asset: {
          ...subject.product_asset,
          reference_image_ids: [
            ...subject.product_asset.reference_image_ids,
            ...newImages.map((img) => img.id),
          ],
        },
      });
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    try {
      await deleteReferenceImage(imageId);
    } catch {
      // Non-fatal — remove from local state regardless
    }
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
    setSubject({
      product_asset: {
        ...subject.product_asset,
        reference_image_ids: subject.product_asset.reference_image_ids.filter((id) => id !== imageId),
      },
    });
  };

  const handleDropzoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  // ── Subject lock / unlock ─────────────────────────────────────────────────────

  const handleUnlock = () => {
    setSubject({ locked: false });
    setGeneration({ variants: [], last_generation_job_id: null, turn_count_on_selected: 0 });
    setShowUnlockModal(false);
  };

  // ── Navigation ────────────────────────────────────────────────────────────────

  const handleBack = () => {
    router.push(`/projects/${projectId}/artifacts/new-poster/brief`);
  };

  const handleContinue = async () => {
    if (!artifactId || !isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateArtifact(artifactId, { content: getContentPayload() });
      router.push(`/projects/${projectId}/artifacts/new-poster/copy`);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isLocked = subject.locked;

  return (
    <Box sx={{ borderRadius: "16px", border: "1px solid #E8EAED", bgcolor: "#FFFFFF", p: 4 }}>
      {/* Locked banner */}
      {isLocked && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: "10px",
            bgcolor: "#FFF7ED",
            border: "1px solid #FDD5A4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#92400E" }}>
              Subject locked
            </Typography>
            <Typography sx={{ fontSize: "12px", color: "#78350F", mt: 0.25 }}>
              Variants have been generated. Unlock to edit — this will clear all generated images.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowUnlockModal(true)}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#D97706",
              color: "#B45309",
              fontSize: "12px",
              fontWeight: 600,
              flexShrink: 0,
              "&:hover": { bgcolor: "#FEF3C7", borderColor: "#B45309" },
            }}
          >
            Clear variants &amp; unlock
          </Button>
        </Box>
      )}

      {/* Header */}
      <Typography sx={{ mb: 0.5, fontSize: "22px", fontWeight: 700, color: "#1F1F1F" }}>
        Visual subject
      </Typography>
      <Typography sx={{ mb: 3, fontSize: "14px", color: "#5F6368" }}>
        Choose the hero of your poster. This determines whether the AI uses text-to-image or image-editing mode.
      </Typography>

      {/* Subject type picker */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
        {SUBJECT_TYPES.map((t) => {
          const isSelected = subject.type === t.key;
          return (
            <Box
              key={t.key}
              component="button"
              onClick={() => !isLocked && setSubject({ type: t.key })}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 2,
                p: 2,
                borderRadius: "12px",
                border: "1.5px solid",
                borderColor: isSelected ? "#D0103A" : "#E8EAED",
                bgcolor: isSelected ? "#FFF1F4" : "#FFFFFF",
                textAlign: "left",
                cursor: isLocked ? "default" : "pointer",
                transition: "all 0.15s",
                "&:hover": isLocked ? {} : { borderColor: "#D0103A" },
              }}
            >
              {/* Radio dot */}
              <Box
                sx={{
                  mt: 0.25,
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor: isSelected ? "#D0103A" : "#ABABAB",
                  bgcolor: isSelected ? "#D0103A" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && (
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#FFFFFF" }} />
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#1F1F1F" }}>
                    {t.label}
                  </Typography>
                  {/* Mode badge */}
                  <Box
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: "4px",
                      bgcolor: isSelected ? "#D0103A" : "#F7F7F7",
                      color: isSelected ? "#FFFFFF" : "#5F6368",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.3px",
                    }}
                  >
                    {t.mode}
                  </Box>
                </Box>
                <Typography sx={{ mt: 0.25, fontSize: "13px", color: "#5F6368" }}>
                  {t.desc}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Sub-form: Human model */}
      {subject.type === "HUMAN_MODEL" && (
        <Box
          sx={{
            p: 3,
            borderRadius: "12px",
            bgcolor: "#F7F7F7",
            border: "1px solid #E8EAED",
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#5F6368",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Human model details
          </Typography>
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Appearance keywords <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              disabled={isLocked}
              placeholder="e.g. South-East Asian woman, mid-30s, warm smile, business casual"
              value={subject.human_model.appearance_keywords}
              onChange={(e) =>
                setSubject({ human_model: { ...subject.human_model, appearance_keywords: e.target.value } })
              }
              sx={textFieldSx}
            />
          </Box>
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Expression / mood <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              disabled={isLocked}
              placeholder="e.g. Confident, hopeful, looking toward the future"
              value={subject.human_model.expression_mood}
              onChange={(e) =>
                setSubject({ human_model: { ...subject.human_model, expression_mood: e.target.value } })
              }
              sx={textFieldSx}
            />
          </Box>
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Posture / framing <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <ChipSelector
              options={POSTURES}
              value={subject.human_model.posture_framing}
              onChange={(v) =>
                setSubject({ human_model: { ...subject.human_model, posture_framing: v } })
              }
              disabled={isLocked}
            />
          </Box>
          <Box>
            <Box
              sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
                  Full appearance description <span style={{ color: "#D0103A" }}>*</span>
                </Typography>
                {/* Word count hint */}
                {subject.human_model.full_appearance && (
                  <Typography
                    sx={{
                      fontSize: "11px",
                      color:
                        subject.human_model.full_appearance.trim().split(/\s+/).filter(Boolean)
                          .length < 40 ||
                        subject.human_model.full_appearance.trim().split(/\s+/).filter(Boolean)
                          .length > 80
                          ? "#B45309"
                          : "#9E9E9E",
                    }}
                  >
                    {subject.human_model.full_appearance.trim().split(/\s+/).filter(Boolean).length}{" "}
                    words · optimal 40–80
                  </Typography>
                )}
              </Box>
              {!isLocked && (
                <AiAssistChip
                  onClick={handleGenerateAppearance}
                  loading={isGeneratingAppearance}
                  disabled={!canGenerateAppearance}
                >
                  Generate from keywords
                </AiAssistChip>
              )}
            </Box>
            <TextField
              fullWidth
              multiline
              minRows={4}
              size="small"
              disabled={isLocked}
              placeholder="Describe the person in rich visual detail — will be used directly in the image generation prompt."
              value={subject.human_model.full_appearance}
              onChange={(e) =>
                setSubject({ human_model: { ...subject.human_model, full_appearance: e.target.value } })
              }
              sx={textFieldSx}
            />
          </Box>
        </Box>
      )}

      {/* Sub-form: Product / asset */}
      {subject.type === "PRODUCT_ASSET" && (
        <Box
          sx={{
            p: 3,
            borderRadius: "12px",
            bgcolor: "#F7F7F7",
            border: "1px solid #E8EAED",
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#5F6368",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Product / asset details
          </Typography>

          {/* File upload */}
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Reference images <span style={{ color: "#D0103A" }}>*</span>
              <Typography component="span" sx={{ fontSize: "11px", color: "#9E9E9E", ml: 1, fontWeight: 400 }}>
                PNG / JPG / WEBP · ≤ 20 MB · up to 3 images
              </Typography>
            </Typography>

            {/* Thumbnails */}
            {uploadedImages.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 1.5 }}>
                {uploadedImages.map((img) => (
                  <Box
                    key={img.id}
                    sx={{ position: "relative", width: 80, height: 80, borderRadius: "8px", overflow: "hidden" }}
                  >
                    <Box
                      component="img"
                      src={img.url}
                      alt="Reference"
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    {!isLocked && (
                      <Box
                        component="button"
                        onClick={() => handleRemoveImage(img.id)}
                        sx={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          bgcolor: "rgba(0,0,0,0.6)",
                          border: "none",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Drop zone */}
            {!isLocked && uploadedImages.length < 3 && (
              <Box
                onDrop={handleDropzoneDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                sx={{
                  p: 3,
                  borderRadius: "8px",
                  border: "1.5px dashed #DADCE0",
                  bgcolor: "#FFFFFF",
                  textAlign: "center",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  transition: "border-color 0.15s",
                  "&:hover": isUploading ? {} : { borderColor: "#D0103A", bgcolor: "#FFF9FA" },
                }}
              >
                {isUploading ? (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                    <CircularProgress size={16} sx={{ color: "#D0103A" }} />
                    <Typography sx={{ fontSize: "13px", color: "#5F6368" }}>Uploading…</Typography>
                  </Box>
                ) : (
                  <>
                    <Typography sx={{ fontSize: "13px", color: "#1F1F1F", fontWeight: 500 }}>
                      Drop images here or click to choose
                    </Typography>
                    <Typography sx={{ fontSize: "11px", color: "#9E9E9E", mt: 0.5 }}>
                      {3 - uploadedImages.length} slot{3 - uploadedImages.length !== 1 ? "s" : ""} remaining
                    </Typography>
                  </>
                )}
              </Box>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </Box>

          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Product placement <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <ChipSelector
              options={PLACEMENTS}
              value={subject.product_asset.placement}
              onChange={(v) =>
                setSubject({ product_asset: { ...subject.product_asset, placement: v } })
              }
              disabled={isLocked}
            />
          </Box>
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Background treatment <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <ChipSelector
              options={BACKGROUNDS}
              value={subject.product_asset.background_treatment}
              onChange={(v) =>
                setSubject({ product_asset: { ...subject.product_asset, background_treatment: v } })
              }
              disabled={isLocked}
            />
          </Box>
        </Box>
      )}

      {/* Sub-form: Scene / abstract */}
      {subject.type === "SCENE_ABSTRACT" && (
        <Box
          sx={{
            p: 3,
            borderRadius: "12px",
            bgcolor: "#F7F7F7",
            border: "1px solid #E8EAED",
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#5F6368",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Scene / abstract details
          </Typography>
          <Box>
            <Box
              sx={{ mb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
                Scene description <span style={{ color: "#D0103A" }}>*</span>
              </Typography>
              {!isLocked && (
                <AiAssistChip
                  onClick={handleGenerateSceneDescription}
                  loading={isGeneratingScene}
                  disabled={subject.scene_abstract.visual_style === ""}
                >
                  + AI
                </AiAssistChip>
              )}
            </Box>
            <TextField
              fullWidth
              multiline
              minRows={3}
              size="small"
              disabled={isLocked}
              placeholder="e.g. A family enjoying a picnic in a sunlit Singapore park, warm golden hour lighting"
              value={subject.scene_abstract.description}
              onChange={(e) =>
                setSubject({ scene_abstract: { ...subject.scene_abstract, description: e.target.value } })
              }
              sx={textFieldSx}
            />
            {subject.scene_abstract.visual_style === "" && (
              <Typography sx={{ mt: 0.5, fontSize: "11px", color: "#9E9E9E" }}>
                Select a visual style below to enable AI description.
              </Typography>
            )}
          </Box>
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
              Visual style <span style={{ color: "#D0103A" }}>*</span>
            </Typography>
            <ChipSelector
              options={SCENE_STYLES}
              value={subject.scene_abstract.visual_style}
              onChange={(v) =>
                setSubject({ scene_abstract: { ...subject.scene_abstract, visual_style: v } })
              }
              disabled={isLocked}
            />
          </Box>
        </Box>
      )}

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

      {/* Unlock confirm modal */}
      <Dialog open={showUnlockModal} onClose={() => setShowUnlockModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "16px", fontWeight: 700, color: "#1F1F1F" }}>
          Clear variants and unlock?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "14px", color: "#5F6368" }}>
            All generated poster variants will be cleared. You&apos;ll need to regenerate them after
            making changes to the subject.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setShowUnlockModal(false)}
            variant="outlined"
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
          >
            Keep locked
          </Button>
          <Button
            onClick={handleUnlock}
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
            Clear and unlock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
