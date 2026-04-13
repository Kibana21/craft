"use client";

// Hook for generating and retrying poster image variants (Phase C).
// Wraps POST /api/ai/poster/generate-variants and /generate-variants/retry.

import { useCallback, useState } from "react";
import {
  generateVariants as apiGenerateVariants,
  retryVariant as apiRetryVariant,
  type GeneratedVariant,
} from "@/lib/api/poster-wizard";
import type { CompositionFormat, SubjectType } from "@/types/poster-wizard";

export type GenerationStatus = "idle" | "loading" | "success" | "error";

interface UseVariantGenerationOptions {
  artifactId: string | null;
  initialVariants?: GeneratedVariant[];
  onVariantsReady?: (variants: GeneratedVariant[]) => void;
}

export function useVariantGeneration({ artifactId, initialVariants, onVariantsReady }: UseVariantGenerationOptions) {
  const [status, setStatus] = useState<GenerationStatus>(
    initialVariants && initialVariants.length > 0 ? "success" : "idle",
  );
  const [variants, setVariants] = useState<GeneratedVariant[]>(initialVariants ?? []);
  const [jobId, setJobId] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (params: {
      mergedPrompt: string;
      subjectType: SubjectType;
      format: CompositionFormat;
      referenceImageIds?: string[];
      count?: number;
    }) => {
      if (!artifactId) return;
      setStatus("loading");
      setError(null);
      setVariants([]);

      try {
        const result = await apiGenerateVariants({
          artifact_id: artifactId,
          merged_prompt: params.mergedPrompt,
          subject_type: params.subjectType,
          format: params.format,
          reference_image_ids: params.referenceImageIds ?? [],
          count: params.count ?? 4,
        });

        setJobId(result.job_id);
        setVariants(result.variants);
        setPartialFailure(result.partial_failure);
        setStatus("success");
        onVariantsReady?.(result.variants);
      } catch (err) {
        const msg =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail: string }).detail)
            : "Image generation failed. Please try again.";
        setError(msg);
        setStatus("error");
      }
    },
    [artifactId, onVariantsReady],
  );

  const retrySlot = useCallback(
    async (params: {
      slot: number;
      retryToken: string;
      mergedPrompt: string;
      subjectType: SubjectType;
      referenceImageIds?: string[];
    }) => {
      if (!artifactId || !jobId) return;
      setError(null);

      // Optimistically mark the slot as loading
      setVariants((prev) =>
        prev.map((v) => (v.slot === params.slot ? { ...v, status: "FAILED" as const } : v)),
      );

      try {
        const result = await apiRetryVariant({
          artifact_id: artifactId,
          job_id: jobId,
          slot: params.slot,
          retry_token: params.retryToken,
          merged_prompt: params.mergedPrompt,
          subject_type: params.subjectType,
          reference_image_ids: params.referenceImageIds ?? [],
        });

        setVariants((prev) =>
          prev.map((v) => (v.slot === params.slot ? result.variant : v)),
        );
        const stillFailed = variants.some(
          (v) => v.slot !== params.slot && v.status === "FAILED",
        );
        setPartialFailure(stillFailed || result.variant.status === "FAILED");
      } catch (err) {
        const msg =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail: string }).detail)
            : "Retry failed. Please try again.";
        setError(msg);
      }
    },
    [artifactId, jobId, variants],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setVariants([]);
    setJobId(null);
    setPartialFailure(false);
    setError(null);
  }, []);

  // Update a single variant's image URL (used by chat refinement and inpainting)
  const updateVariantImage = useCallback((variantId: string, newImageUrl: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, image_url: newImageUrl, status: "READY" as const } : v)),
    );
  }, []);

  // Append a new variant (used by save-as-variant)
  const addVariant = useCallback((variant: GeneratedVariant) => {
    setVariants((prev) => [...prev, variant]);
  }, []);

  return {
    status,
    variants,
    jobId,
    partialFailure,
    error,
    generate,
    retrySlot,
    reset,
    updateVariantImage,
    addVariant,
    isLoading: status === "loading",
  };
}
