// My Studio — TypeScript types (mirrors backend StudioImage + StudioWorkflowRun).
// Phase A covers the library surface; workflow-run fields are included now so
// Phase B can build on top without another round-trip through this file.

export type StudioImageType =
  | "PHOTO"
  | "AI_GENERATED"
  | "ENHANCED"
  | "POSTER_EXPORT";

export type StudioIntent =
  | "MAKE_PROFESSIONAL"
  | "CHANGE_BACKGROUND"
  | "ENHANCE_QUALITY"
  | "VARIATION"
  | "CUSTOM";

export type WorkflowStatus =
  | "QUEUED"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "PARTIAL";

export interface StudioImage {
  id: string;
  name: string;
  type: StudioImageType;
  storage_url: string;
  thumbnail_url: string | null;
  mime_type: string;
  size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  source_image_id: string | null;
  workflow_run_id: string | null;
  created_at: string;
}

export interface StudioImageListResponse {
  items: StudioImage[];
  total: number;
  page: number;
  per_page: number;
}

export interface WorkflowRunSummary {
  id: string;
  intent: StudioIntent;
  is_batch: boolean;
  status: WorkflowStatus;
  progress_percent: number;
  created_at: string;
}

export interface StudioImageDetail extends StudioImage {
  source_image: StudioImage | null;
  workflow_run: WorkflowRunSummary | null;
  prompt_used: string | null;
}

export interface ListImagesParams {
  type?: StudioImageType;
  q?: string;
  page?: number;
  per_page?: number;
}

// Small UI helper — consistent labels for the type pills across the app.
export const STUDIO_IMAGE_TYPE_LABEL: Record<StudioImageType, string> = {
  PHOTO: "Photo",
  AI_GENERATED: "AI Generated",
  ENHANCED: "Enhanced",
  POSTER_EXPORT: "Poster Export",
};

// Pill colours — plan doc 05 §Styling.
export const STUDIO_IMAGE_TYPE_COLOR: Record<
  StudioImageType,
  { bg: string; fg: string }
> = {
  PHOTO:         { bg: "#EEEEEE", fg: "#5F6368" },
  AI_GENERATED:  { bg: "#E8F0FE", fg: "#1967D2" },
  ENHANCED:      { bg: "#EDE7F6", fg: "#6A3FB5" },
  POSTER_EXPORT: { bg: "#FFE4EA", fg: "#D0103A" },
};

// ── Intent-scoped style-input shapes (mirror backend schemas/studio.py) ──────

export type SettingToken = "OFFICE" | "OUTDOOR" | "STUDIO" | "BLURRED";
export type AttireToken = "KEEP" | "MORE_FORMAL";
export type MoodToken = "CONFIDENT" | "WARM" | "APPROACHABLE";

export interface MakeProfessionalInputs {
  setting: SettingToken[];
  attire: AttireToken;
  mood: MoodToken;
  notes?: string;
}

export type BackgroundType =
  | "OFFICE_INTERIOR"
  | "OUTDOOR_NATURE"
  | "CITY_SKYLINE"
  | "ABSTRACT"
  | "PLAIN_COLOUR"
  | "CUSTOM";
export type LightingMatch = "MATCH" | "RELIGHT";

export interface ChangeBackgroundInputs {
  new_background: BackgroundType;
  lighting_match: LightingMatch;
  description?: string;
}

export type FocusArea = "LIGHTING" | "SHARPNESS" | "COLOUR" | "SKIN_TONES" | "BG_BLUR";
export type OutputResolution = "SAME" | "UPSCALE_2X" | "UPSCALE_4X";

export interface EnhanceQualityInputs {
  focus_areas: FocusArea[];
  output_resolution: OutputResolution;
}

export type KeepConsistent = "IDENTITY" | "PALETTE" | "COMPOSITION" | "MOOD";
export type StyleDirection = "SAME" | "MORE_PROFESSIONAL" | "MORE_ARTISTIC" | "MORE_VIBRANT";

export interface VariationInputs {
  difference_level: number;
  keep_consistent: KeepConsistent[];
  style_direction: StyleDirection;
}

export interface CustomInputs {
  description: string;
  use_source_as_reference: boolean;
}

// Discriminated union helper — callers narrow via `intent` since the backend
// keys validation on the sibling field, not an embedded discriminator.
export type StyleInputsByIntent = {
  MAKE_PROFESSIONAL: MakeProfessionalInputs;
  CHANGE_BACKGROUND: ChangeBackgroundInputs;
  ENHANCE_QUALITY: EnhanceQualityInputs;
  VARIATION: VariationInputs;
  CUSTOM: CustomInputs;
};

// ── Prompt builder / workflow responses ──────────────────────────────────────

export interface PromptBuilderResponse {
  merged_prompt: string;
  ai_enrichments: string[];
}

export interface GenerateWorkflowResponse {
  run_id: string;
  status: WorkflowStatus;
}

export interface WorkflowRunStatusResponse {
  id: string;
  intent: StudioIntent;
  is_batch: boolean;
  status: WorkflowStatus;
  progress_percent: number;
  created_at: string;
  outputs: StudioImage[];
  error: string | null;
}

export interface RetrySlotResponse {
  output: StudioImage;
}

export interface DiscardOutputsResponse {
  discarded_count: number;
}

export type VariationCount = 1 | 2 | 4 | 8;

// ── Intent catalogue — labels + descriptions for the Intent picker ────────────
export const INTENT_COPY: Record<StudioIntent, { label: string; description: string; icon: string }> = {
  MAKE_PROFESSIONAL: {
    label: "Make it professional",
    description: "Transform a casual photo into a polished, professional headshot or portrait.",
    icon: "✨",
  },
  CHANGE_BACKGROUND: {
    label: "Change the background",
    description: "Keep the subject; replace or extend the background.",
    icon: "🎨",
  },
  ENHANCE_QUALITY: {
    label: "Enhance quality",
    description: "Improve lighting, sharpness, colour, and overall quality.",
    icon: "🌟",
  },
  VARIATION: {
    label: "Generate a variation",
    description: "Create a new image inspired by this photo's style and mood.",
    icon: "🔀",
  },
  CUSTOM: {
    label: "Custom",
    description: "Describe what you want in your own words.",
    icon: "✏️",
  },
};
