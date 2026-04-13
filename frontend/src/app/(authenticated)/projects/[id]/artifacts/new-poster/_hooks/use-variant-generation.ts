"use client";

// Hook for generating and retrying poster image variants (Phase C).
// Generation is async: POST /generate-variants returns a job_id immediately,
// then we poll GET /generate-variants/{job_id}/status every 2 s until done.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateVariants as apiGenerateVariants,
  getVariantJobStatus,
  retryVariant as apiRetryVariant,
  type GeneratedVariant,
} from "@/lib/api/poster-wizard";
import type { CompositionFormat, SubjectType } from "@/types/poster-wizard";

export type GenerationStatus = "idle" | "loading" | "success" | "error";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000; // 2 min safety cap

interface UseVariantGenerationOptions {
  artifactId: string | null;
  onVariantsReady?: (variants: GeneratedVariant[]) => void;
  // Seeds the variants list on first mount so existing posters display the
  // previously-generated images without re-running generation. Ignored on
  // subsequent renders (the hook owns state thereafter).
  initialVariants?: GeneratedVariant[];
}

export function useVariantGeneration({
  artifactId,
  onVariantsReady,
  initialVariants,
}: UseVariantGenerationOptions) {
  const [status, setStatus] = useState<GenerationStatus>(
    initialVariants && initialVariants.length > 0 ? "success" : "idle",
  );
  const [variants, setVariants] = useState<GeneratedVariant[]>(() => initialVariants ?? []);
  const [jobId, setJobId] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAppending, setIsAppending] = useState(false);

  // Refs so the polling interval can read the latest values without stale closures
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const isAppendingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isAppendingRef.current = isAppending;
  }, [isAppending]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  /** Start polling a job until READY / FAILED / timeout. */
  const startPolling = useCallback(
    (pollJobId: string, isAppend: boolean) => {
      stopPolling();
      pollStartRef.current = Date.now();

      pollingRef.current = setInterval(async () => {
        // Safety timeout
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          stopPolling();
          const msg = "Image generation timed out. Please try again.";
          setError(msg);
          if (isAppend) {
            setIsAppending(false);
          } else {
            setStatus("error");
          }
          return;
        }

        try {
          const job = await getVariantJobStatus(pollJobId);

          if (job.status === "READY" || job.status === "FAILED") {
            stopPolling();

            if (isAppend) {
              setVariants((prev) => [...prev, ...job.variants]);
              setIsAppending(false);
              if (job.variants.some((v) => v.status === "READY")) {
                onVariantsReady?.(job.variants);
              }
              if (job.error) setError(job.error);
            } else {
              setVariants(job.variants);
              setPartialFailure(job.partial_failure);
              setStatus(job.variants.length > 0 ? "success" : "error");
              if (job.variants.length > 0) {
                onVariantsReady?.(job.variants);
              }
              if (job.error) setError(job.error);
            }
          }
          // QUEUED / RUNNING → keep polling
        } catch (err) {
          const msg =
            err && typeof err === "object" && "detail" in err
              ? String((err as { detail: string }).detail)
              : "Image generation failed. Please try again.";
          stopPolling();
          setError(msg);
          if (isAppend) {
            setIsAppending(false);
          } else {
            setStatus("error");
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, onVariantsReady],
  );

  /** Generate the first image (or a full new batch). Resets existing variants. */
  const generate = useCallback(
    async (params: {
      mergedPrompt: string;
      subjectType: SubjectType;
      format: CompositionFormat;
      referenceImageIds?: string[];
      count?: number;
    }) => {
      if (!artifactId) return;
      stopPolling();
      setStatus("loading");
      setError(null);
      setVariants([]);

      try {
        const { job_id } = await apiGenerateVariants({
          artifact_id: artifactId,
          merged_prompt: params.mergedPrompt,
          subject_type: params.subjectType,
          format: params.format,
          reference_image_ids: params.referenceImageIds ?? [],
          count: params.count ?? 1,
        });
        setJobId(job_id);
        startPolling(job_id, false);
      } catch (err) {
        const msg =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail: string }).detail)
            : "Image generation failed. Please try again.";
        setError(msg);
        setStatus("error");
      }
    },
    [artifactId, stopPolling, startPolling],
  );

  /** Generates one more variant and appends it to the strip. */
  const appendOne = useCallback(
    async (params: {
      mergedPrompt: string;
      subjectType: SubjectType;
      format: CompositionFormat;
      referenceImageIds?: string[];
    }) => {
      if (!artifactId || isAppendingRef.current || status === "loading") return;
      setIsAppending(true);
      setError(null);

      try {
        const { job_id } = await apiGenerateVariants({
          artifact_id: artifactId,
          merged_prompt: params.mergedPrompt,
          subject_type: params.subjectType,
          format: params.format,
          reference_image_ids: params.referenceImageIds ?? [],
          count: 1,
        });
        setJobId(job_id);
        startPolling(job_id, true);
      } catch (err) {
        const msg =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail: string }).detail)
            : "Image generation failed. Please try again.";
        setError(msg);
        setIsAppending(false);
      }
    },
    [artifactId, status, startPolling],
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
      } catch (err) {
        const msg =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail: string }).detail)
            : "Retry failed. Please try again.";
        setError(msg);
      }
    },
    [artifactId, jobId],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setVariants([]);
    setJobId(null);
    setPartialFailure(false);
    setError(null);
    setIsAppending(false);
  }, [stopPolling]);

  const updateVariantImage = useCallback((variantId: string, newImageUrl: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, image_url: newImageUrl, status: "READY" as const } : v)),
    );
  }, []);

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
    appendOne,
    retrySlot,
    reset,
    updateVariantImage,
    addVariant,
    isLoading: status === "loading",
    isAppending,
  };
}
