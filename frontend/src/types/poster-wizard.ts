// ── Poster Wizard TypeScript types ───────────────────────────────────────────
// Mirrors the backend PosterContent JSONB schema (see 01-data-model-and-migrations.md).
// schema_version: 1

// ── Step 1: Brief ─────────────────────────────────────────────────────────────

// Enums match backend schemas/poster.py exactly
export type CampaignObjective =
  | "PRODUCT_LAUNCH"
  | "BRAND_AWARENESS"
  | "SEASONAL_PROMOTION"
  | "AGENT_ENABLEMENT"
  | "CUSTOMER_RETENTION";

export type PosterTone =
  | "PROFESSIONAL"
  | "INSPIRATIONAL"
  | "WARM"
  | "URGENT"
  | "EMPATHETIC";

export interface PosterBriefContent {
  title: string;
  campaign_objective: CampaignObjective | "";
  target_audience: string;
  tone: PosterTone | "";
  call_to_action: string;
  narrative: string;
}

// ── Step 2: Subject ───────────────────────────────────────────────────────────

export type SubjectType = "HUMAN_MODEL" | "PRODUCT_ASSET" | "SCENE_ABSTRACT";

export type PostureFraming = "FACING_CAMERA" | "THREE_QUARTER" | "PROFILE" | "LOOKING_UP";
export type ProductPlacement = "HERO_CENTRED" | "LIFESTYLE_CONTEXT" | "DETAIL_CLOSE" | "FLOATING";
export type BackgroundTreatment = "REPLACE" | "EXTEND" | "KEEP_ORIGINAL" | "ABSTRACT_BLEND";
// Matches backend VisualStyle enum (used for scene_abstract.visual_style)
export type SceneVisualStyle =
  | "PHOTOREALISTIC"
  | "EDITORIAL_GRAPHIC"
  | "ILLUSTRATED"
  | "ABSTRACT";

export interface HumanModelSubject {
  appearance_keywords: string;
  expression_mood: string;
  full_appearance: string;
  posture_framing: PostureFraming | "";
}

export interface ProductAssetSubject {
  reference_image_ids: string[];
  placement: ProductPlacement | "";
  background_treatment: BackgroundTreatment | "";
}

export interface SceneAbstractSubject {
  description: string;
  visual_style: SceneVisualStyle | "";
}

export interface PosterSubjectContent {
  type: SubjectType | "";
  human_model: HumanModelSubject;
  product_asset: ProductAssetSubject;
  scene_abstract: SceneAbstractSubject;
  locked: boolean;
}

// ── Step 3: Copy ──────────────────────────────────────────────────────────────

export interface ComplianceFlag {
  field: string;
  pattern_type: string;
  matched_phrase: string;
  severity: "WARNING" | "ERROR";
  at: string;
}

export interface PosterCopyContent {
  headline: string;
  subheadline: string;
  body: string;
  cta_text: string;
  brand_tagline: string;
  regulatory_disclaimer: string;
  compliance_flags: ComplianceFlag[];
}

// ── Step 4: Composition ───────────────────────────────────────────────────────

export type CompositionFormat = "PORTRAIT" | "SQUARE" | "LANDSCAPE" | "STORY" | "CUSTOM";
export type LayoutTemplate =
  | "HERO_DOMINANT"
  | "SPLIT"
  | "FRAME_BORDER"
  | "TYPOGRAPHIC"
  | "FULL_BLEED";
export type VisualStyle =
  | "CLEAN_CORPORATE"
  | "WARM_HUMAN"
  | "BOLD_HIGH_CONTRAST"
  | "SOFT_ASPIRATIONAL"
  | "DARK_PREMIUM"
  | "ILLUSTRATED_GRAPHIC";

export interface PosterCompositionContent {
  format: CompositionFormat | "";
  layout_template: LayoutTemplate | "";
  visual_style: VisualStyle | "";
  palette: string[];
  merged_prompt: string;
  merged_prompt_stale: boolean;
  prompt_generated_at: string | null;
}

// ── Step 5: Generation ────────────────────────────────────────────────────────

export interface ChangeLogEntry {
  id: string;
  description: string;
  accepted_at: string;
}

export type VariantStatus = "PENDING" | "GENERATING" | "READY" | "FAILED";

export interface PosterVariant {
  id: string;
  image_url: string | null;
  generated_at: string | null;
  status: VariantStatus;
  selected: boolean;
  parent_variant_id: string | null;
  change_log: ChangeLogEntry[];
}

export interface PosterGenerationState {
  variants: PosterVariant[];
  last_generation_job_id: string | null;
  turn_count_on_selected: number;
}

// ── Full content payload (written to artifacts.content JSONB) ─────────────────

export interface PosterContent {
  schema_version: 1;
  brief: PosterBriefContent;
  subject: PosterSubjectContent;
  copy: PosterCopyContent;
  composition: PosterCompositionContent;
  generation: PosterGenerationState;
}

// ── Context value ─────────────────────────────────────────────────────────────

export interface PosterWizardContextValue {
  projectId: string;
  artifactId: string | null;
  isSaving: boolean;
  brief: PosterBriefContent;
  subject: PosterSubjectContent;
  copy: PosterCopyContent;
  composition: PosterCompositionContent;
  generation: PosterGenerationState;
  setBrief: (value: Partial<PosterBriefContent>) => void;
  setSubject: (value: Partial<PosterSubjectContent>) => void;
  setCopy: (value: Partial<PosterCopyContent>) => void;
  setComposition: (value: Partial<PosterCompositionContent>) => void;
  setGeneration: (value: Partial<PosterGenerationState>) => void;
  setArtifactId: (id: string) => void;
  setIsSaving: (v: boolean) => void;
  getContentPayload: () => Record<string, unknown>;
}
