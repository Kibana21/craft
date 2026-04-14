// My Studio API client — mirrors `/api/studio/*` endpoints.
// Covers library CRUD (Phase A) + workflow endpoints (Phase B).
import { apiClient } from "@/lib/api-client";

// Direct URL to an image file served by the backend's static /uploads mount.
// The stored `storage_url` / `thumbnail_url` are relative (e.g. "/uploads/...").
// Browsers resolve those against the frontend origin (localhost:3000) and rely
// on the Next.js rewrite to proxy to the backend — which is flaky in dev when
// NEXT_PUBLIC_API_URL points at the backend directly. Prefixing with the API
// base here sidesteps the proxy and works identically in dev + prod.
function backendBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" ? "" : "http://localhost:8000")
  );
}

export function staticStudioUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Already-absolute URLs (S3 / R2 / remote CDN) pass through untouched.
  if (/^https?:\/\//i.test(url)) return url;
  return `${backendBase()}${url}`;
}
import type {
  DiscardOutputsResponse,
  GenerateWorkflowResponse,
  ListImagesParams,
  PromptBuilderResponse,
  RetrySlotResponse,
  StudioImage,
  StudioImageDetail,
  StudioImageListResponse,
  StudioIntent,
  VariationCount,
  WorkflowRunStatusResponse,
  WorkflowStatus,
} from "@/types/studio";

export async function listImages(
  params?: ListImagesParams,
): Promise<StudioImageListResponse> {
  const search = new URLSearchParams();
  if (params?.type) search.set("type", params.type);
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.per_page) search.set("per_page", String(params.per_page));
  const qs = search.toString();
  return apiClient.get<StudioImageListResponse>(
    `/api/studio/images${qs ? `?${qs}` : ""}`,
  );
}

export async function uploadImages(files: File[]): Promise<StudioImage[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  return apiClient.upload<StudioImage[]>(`/api/studio/images`, formData);
}

export async function getImage(imageId: string): Promise<StudioImageDetail> {
  return apiClient.get<StudioImageDetail>(`/api/studio/images/${imageId}`);
}

export async function renameImage(
  imageId: string,
  payload: { name: string; tags?: string[] },
): Promise<StudioImage> {
  return apiClient.patch<StudioImage>(
    `/api/studio/images/${imageId}`,
    payload,
  );
}

export async function deleteImage(imageId: string): Promise<void> {
  return apiClient.delete<void>(`/api/studio/images/${imageId}`);
}

// ── Workflow endpoints (Phase B) ─────────────────────────────────────────────

export async function buildPrompt(body: {
  intent: StudioIntent;
  style_inputs: Record<string, unknown>;
  source_image_id?: string;
  variation_count?: VariationCount;
}): Promise<PromptBuilderResponse> {
  return apiClient.post<PromptBuilderResponse>(
    `/api/studio/workflows/prompt-builder`,
    body,
  );
}

export async function generateRun(body: {
  intent: StudioIntent;
  style_inputs: Record<string, unknown>;
  source_image_ids?: string[];
  merged_prompt: string;
  variation_count?: VariationCount;
  is_batch?: boolean;
}): Promise<GenerateWorkflowResponse> {
  return apiClient.post<GenerateWorkflowResponse>(
    `/api/studio/workflows/generate`,
    {
      source_image_ids: [],
      variation_count: 4,
      is_batch: false,
      ...body,
    },
  );
}

export async function getRunStatus(
  runId: string,
): Promise<WorkflowRunStatusResponse> {
  return apiClient.get<WorkflowRunStatusResponse>(
    `/api/studio/workflows/${runId}/status`,
  );
}

export async function retrySlot(
  runId: string,
  body: { source_image_id: string | null; slot: number },
): Promise<RetrySlotResponse> {
  return apiClient.post<RetrySlotResponse>(
    `/api/studio/workflows/${runId}/retry-slot`,
    body,
  );
}

export async function discardOutputs(
  runId: string,
): Promise<DiscardOutputsResponse> {
  return apiClient.post<DiscardOutputsResponse>(
    `/api/studio/workflows/${runId}/discard-outputs`,
  );
}

export async function listRecentRuns(): Promise<
  Array<{
    id: string;
    intent: StudioIntent;
    is_batch: boolean;
    status: WorkflowStatus;
    progress_percent: number;
    created_at: string;
  }>
> {
  return apiClient.get(`/api/studio/workflows/recent`);
}
