// Poster Wizard AI endpoints — wraps /api/ai/poster/* and /api/compliance/check-field
import { apiClient } from "@/lib/api-client";
import type {
  PosterBriefContent,
  PosterCopyContent,
  PosterCompositionContent,
  PosterSubjectContent,
  PosterTone,
  CampaignObjective,
  PostureFraming,
  SceneVisualStyle,
  CompositionFormat,
} from "@/types/poster-wizard";

// ── Request / response shapes ─────────────────────────────────────────────────

export interface GenerateBriefResponse {
  brief: string;
  generation_id: string;
}

export interface AppearanceParagraphResponse {
  paragraph: string;
  word_count: number;
}

export interface SceneDescriptionResponse {
  description: string;
}

export interface CopyDraftAllResponse {
  headline: string;
  subheadline: string;
  body: string;
  cta_text: string;
}

export interface CopyValues {
  headline: string;
  subheadline: string;
  body: string;
  cta_text: string;
}

export interface ToneRewriteResponse {
  rewritten: CopyValues;
}

export interface ClassifyStructuralChangeResponse {
  is_structural: boolean;
  target: "STEP_2_SUBJECT" | "STEP_3_COPY" | "STEP_4_COMPOSITION" | null;
  confidence: number;
}

export interface CompositionPromptResponse {
  merged_prompt: string;
  style_sentence: string;
}

export interface GeneratedVariant {
  id: string;
  slot: number;
  status: "READY" | "FAILED";
  image_url: string | null;
  error_code: string | null;
  retry_token: string | null;
}

/** Returned immediately (202) when a generation job is dispatched. */
export interface GenerateVariantsJobResponse {
  job_id: string;
  status: "QUEUED";
}

/** Polling response — poll until status is READY or FAILED. */
export interface VariantJobStatusResponse {
  job_id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  variants: GeneratedVariant[];
  partial_failure: boolean;
  error: string | null;
}

/** @deprecated kept for the retry endpoint only */
export interface GenerateVariantsResponse {
  job_id: string;
  variants: GeneratedVariant[];
  partial_failure: boolean;
}

export interface RetryVariantResponse {
  variant: GeneratedVariant;
}

export interface RefineChatResponse {
  turn_id: string;
  ai_response: string;
  change_description: string;
  new_image_url: string | null;
  action_type: "CHAT_REFINE" | "REDIRECT" | "TURN_LIMIT_NUDGE";
  redirect_target: "STEP_2_SUBJECT" | "STEP_3_COPY" | "STEP_4_COMPOSITION" | null;
  turn_index: number;
}

export interface InpaintResponse {
  turn_id: string;
  new_image_url: string;
  change_description: string;
}

export interface ComplianceFlag {
  field: string;
  pattern_type: string;
  matched_phrase: string;
  severity: "WARNING" | "ERROR";
  mas_basis?: string;
  suggestion?: string | null;
  rule_id?: string | null;
}

export interface CheckFieldResponse {
  flags: ComplianceFlag[];
  cached: boolean;
}

// ── Phase B — Text AI ─────────────────────────────────────────────────────────

export async function generateBrief(params: {
  campaign_objective: CampaignObjective;
  target_audience: string;
  tone: PosterTone;
  call_to_action: string;
  existing_brief?: string;
}): Promise<GenerateBriefResponse> {
  return apiClient.post<GenerateBriefResponse>("/api/ai/poster/generate-brief", params);
}

export async function generateAppearanceParagraph(params: {
  appearance_keywords: string;
  expression_mood: string;
  posture_framing: PostureFraming;
  brief_context?: string;
}): Promise<AppearanceParagraphResponse> {
  return apiClient.post<AppearanceParagraphResponse>(
    "/api/ai/poster/generate-appearance-paragraph",
    params,
  );
}

export async function generateSceneDescription(params: {
  visual_style: SceneVisualStyle;
  brief_context?: string;
  seed_hint?: string;
}): Promise<SceneDescriptionResponse> {
  return apiClient.post<SceneDescriptionResponse>(
    "/api/ai/poster/generate-scene-description",
    params,
  );
}

export async function copyDraftAll(params: {
  brief: string;
  tone: PosterTone;
  campaign_objective: CampaignObjective;
  audience?: string;
}): Promise<CopyDraftAllResponse> {
  return apiClient.post<CopyDraftAllResponse>("/api/ai/poster/copy-draft-all", params);
}

export async function copyDraftField(params: {
  field: "headline" | "subheadline" | "body" | "cta_text";
  brief: string;
  tone: PosterTone;
  current_values: CopyValues;
}): Promise<{ value: string }> {
  return apiClient.post<{ value: string }>("/api/ai/poster/copy-draft-field", params);
}

export async function toneRewrite(params: {
  rewrite_tone: "SHARPER" | "WARMER" | "MORE_URGENT" | "SHORTER";
  current_copy: CopyValues;
}): Promise<ToneRewriteResponse> {
  return apiClient.post<ToneRewriteResponse>("/api/ai/poster/tone-rewrite", params);
}

export async function classifyStructuralChange(
  message: string,
): Promise<ClassifyStructuralChangeResponse> {
  return apiClient.post<ClassifyStructuralChangeResponse>(
    "/api/ai/poster/classify-structural-change",
    { message },
  );
}

// ── Phase B/C — Composition prompt (deterministic, no LLM cost) ───────────────

export async function generateCompositionPrompt(params: {
  brief: Pick<PosterBriefContent, "narrative" | "tone">;
  subject: PosterSubjectContent;
  copy: Pick<PosterCopyContent, "headline" | "cta_text">;
  composition_settings: Pick<
    PosterCompositionContent,
    "format" | "layout_template" | "visual_style" | "palette"
  >;
}): Promise<CompositionPromptResponse> {
  return apiClient.post<CompositionPromptResponse>(
    "/api/ai/poster/generate-composition-prompt",
    params,
  );
}

// ── Phase C — Image generation ─────────────────────────────────────────────────

export async function generateVariants(params: {
  artifact_id: string;
  merged_prompt: string;
  subject_type: "HUMAN_MODEL" | "PRODUCT_ASSET" | "SCENE_ABSTRACT";
  reference_image_ids?: string[];
  count?: number;
  format: CompositionFormat;
}): Promise<GenerateVariantsJobResponse> {
  return apiClient.post<GenerateVariantsJobResponse>("/api/ai/poster/generate-variants", params);
}

export async function getVariantJobStatus(jobId: string): Promise<VariantJobStatusResponse> {
  return apiClient.get<VariantJobStatusResponse>(
    `/api/ai/poster/generate-variants/${jobId}/status`,
  );
}

export async function retryVariant(params: {
  artifact_id: string;
  job_id: string;
  slot: number;
  retry_token: string;
  merged_prompt: string;
  subject_type: "HUMAN_MODEL" | "PRODUCT_ASSET" | "SCENE_ABSTRACT";
  reference_image_ids?: string[];
}): Promise<RetryVariantResponse> {
  return apiClient.post<RetryVariantResponse>("/api/ai/poster/generate-variants/retry", params);
}

// ── Phase D — Chat refinement ─────────────────────────────────────────────────

export async function refineChat(params: {
  artifact_id: string;
  variant_id: string;
  user_message: string;
  change_history: { id: string; description: string; accepted_at: string }[];
  original_merged_prompt: string;
}): Promise<RefineChatResponse> {
  return apiClient.post<RefineChatResponse>("/api/ai/poster/refine-chat", params);
}

export async function inpaintRegion(
  artifactId: string,
  variantId: string,
  description: string,
  originalMergedPrompt: string,
  maskPng: File,
): Promise<InpaintResponse> {
  const formData = new FormData();
  formData.append("artifact_id", artifactId);
  formData.append("variant_id", variantId);
  formData.append("description", description);
  formData.append("original_merged_prompt", originalMergedPrompt);
  formData.append("mask_png", maskPng);
  return apiClient.upload<InpaintResponse>("/api/ai/poster/inpaint", formData);
}

// ── Phase E — Per-field compliance ────────────────────────────────────────────

export async function checkField(params: {
  field: "headline" | "subheadline" | "body" | "cta_text";
  text: string;
  tone_context: PosterTone;
  content_hash?: string;
}): Promise<CheckFieldResponse> {
  return apiClient.post<CheckFieldResponse>("/api/compliance/check-field", params);
}

// ── Reference image upload ────────────────────────────────────────────────────

export async function uploadReferenceImage(
  file: File,
  artifactId?: string,
): Promise<{ id: string; storage_url: string; expires_at: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const url = artifactId
    ? `/api/uploads/reference-image-temp?artifact_id=${artifactId}`
    : "/api/uploads/reference-image-temp";
  return apiClient.upload<{ id: string; storage_url: string; expires_at: string }>(url, formData);
}

export async function deleteReferenceImage(imageId: string): Promise<void> {
  await apiClient.delete(`/api/uploads/reference-image-temp/${imageId}`);
}

// ── Phase E — 2× Upscale ─────────────────────────────────────────────────────

export interface UpscaleVariantResponse {
  image_url: string;
  width: number;
  height: number;
}

export async function upscaleVariant(
  artifactId: string,
  variantId: string,
): Promise<UpscaleVariantResponse> {
  return apiClient.post<UpscaleVariantResponse>("/api/ai/poster/upscale", {
    artifact_id: artifactId,
    variant_id: variantId,
  });
}

// ── Phase D — Save as variant ──────────────────────────────────────────────────

export async function saveAsVariant(
  artifactId: string,
  variantId: string,
): Promise<{ new_variant: GeneratedVariant }> {
  return apiClient.post<{ new_variant: GeneratedVariant }>(
    `/api/artifacts/${artifactId}/save-as-variant`,
    { variant_id: variantId },
  );
}

// ── Phase D — Variant refinement history ─────────────────────────────────────

export interface VariantTurnItem {
  turn_id: string;
  turn_index: number;
  action_type: "CHAT_REFINE" | "INPAINT" | "TURN_LIMIT_NUDGE";
  user_message: string;
  ai_response: string;
  resulting_image_url: string;
  created_at: string;
}

export async function listVariantTurns(
  artifactId: string,
  variantId: string,
): Promise<{ turns: VariantTurnItem[] }> {
  return apiClient.get<{ turns: VariantTurnItem[] }>(
    `/api/artifacts/${artifactId}/variants/${variantId}/turns`,
  );
}

export async function restoreVariantTurn(
  artifactId: string,
  variantId: string,
  turnId: string,
): Promise<{ image_url: string }> {
  return apiClient.post<{ image_url: string }>(
    `/api/artifacts/${artifactId}/variants/${variantId}/restore-turn`,
    { turn_id: turnId },
  );
}
