"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { WizardProgress } from "@/components/projects/wizard/wizard-progress";
import { createArtifact } from "@/lib/api/artifacts";
import { fetchProjectDetail } from "@/lib/api/projects";
import type {
  PosterBriefContent,
  PosterCompositionContent,
  PosterCopyContent,
  PosterGenerationState,
  PosterSubjectContent,
  PosterWizardContextValue,
  PosterContent,
} from "@/types/poster-wizard";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_BRIEF: PosterBriefContent = {
  title: "",
  campaign_objective: "",
  target_audience: "",
  tone: "",
  call_to_action: "",
  narrative: "",
};

const DEFAULT_SUBJECT: PosterSubjectContent = {
  type: "",
  human_model: { appearance_keywords: "", expression_mood: "", full_appearance: "", posture_framing: "" },
  product_asset: { reference_image_ids: [], placement: "", background_treatment: "" },
  scene_abstract: { description: "", visual_style: "" },
  locked: false,
};

const DEFAULT_COPY: PosterCopyContent = {
  headline: "",
  subheadline: "",
  body: "",
  cta_text: "",
  brand_tagline: "",
  regulatory_disclaimer: "",
  compliance_flags: [],
};

const DEFAULT_COMPOSITION: PosterCompositionContent = {
  format: "",
  layout_template: "",
  visual_style: "",
  palette: ["#D0103A", "#1A1A18", "#FFFFFF"],
  merged_prompt: "",
  merged_prompt_stale: false,
  prompt_generated_at: null,
};

const DEFAULT_GENERATION: PosterGenerationState = {
  variants: [],
  last_generation_job_id: null,
  turn_count_on_selected: 0,
};

// ── Context ───────────────────────────────────────────────────────────────────

export const PosterWizardContext = createContext<PosterWizardContextValue | null>(null);

export function usePosterWizard(): PosterWizardContextValue {
  const ctx = useContext(PosterWizardContext);
  if (!ctx) throw new Error("usePosterWizard must be used inside PosterWizardLayout");
  return ctx;
}

// ── Step map ──────────────────────────────────────────────────────────────────

const WIZARD_STEPS = ["Brief", "Subject", "Copy", "Composition", "Generate"];

const SEGMENT_TO_STEP: Record<string, number> = {
  brief: 0,
  subject: 1,
  copy: 2,
  compose: 3,
  generate: 4,
};

// ── Layout ────────────────────────────────────────────────────────────────────

export default function PosterWizardLayout({ children }: { children: React.ReactNode }) {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();

  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // Guard against React StrictMode double-invoking the effect (which would create two draft artifacts)
  const initRanRef = useRef(false);
  const [projectName, setProjectName] = useState<string>("");

  const [brief, setBriefState] = useState<PosterBriefContent>(DEFAULT_BRIEF);
  const [subject, setSubjectState] = useState<PosterSubjectContent>(DEFAULT_SUBJECT);
  const [copy, setCopyState] = useState<PosterCopyContent>(DEFAULT_COPY);
  const [composition, setCompositionState] = useState<PosterCompositionContent>(DEFAULT_COMPOSITION);
  const [generation, setGenerationState] = useState<PosterGenerationState>(DEFAULT_GENERATION);

  // On mount: fetch project name and create a draft artifact for this session.
  useEffect(() => {
    if (!projectId || initRanRef.current) return;
    initRanRef.current = true;

    const init = async () => {
      try {
        const [project, artifact] = await Promise.all([
          fetchProjectDetail(projectId),
          createArtifact(projectId, {
            type: "poster",
            name: "Untitled poster",
            content: { schema_version: 1 },
          }),
        ]);
        setProjectName(project.name);
        setArtifactId(artifact.id);
      } catch {
        router.push(`/projects/${projectId}`);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const getContentPayload = (): Record<string, unknown> => ({
    schema_version: 1,
    brief,
    subject,
    copy,
    composition,
    generation,
  });

  const contextValue: PosterWizardContextValue = {
    projectId,
    artifactId,
    isSaving,
    brief,
    subject,
    copy,
    composition,
    generation,
    setBrief: (value) => setBriefState((prev) => ({ ...prev, ...value })),
    setSubject: (value) => setSubjectState((prev) => ({ ...prev, ...value })),
    setCopy: (value) => setCopyState((prev) => ({ ...prev, ...value })),
    setComposition: (value) => setCompositionState((prev) => ({ ...prev, ...value })),
    setGeneration: (value) => setGenerationState((prev) => ({ ...prev, ...value })),
    setArtifactId,
    setIsSaving,
    getContentPayload,
  };

  // Derive current step from URL segment
  const segment = pathname.split("/").pop() ?? "";
  const currentStep = SEGMENT_TO_STEP[segment] ?? 0;
  const isGenerateStep = segment === "generate";

  if (isInitializing) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#D0103A" }} />
      </Box>
    );
  }

  return (
    <PosterWizardContext.Provider value={contextValue}>
      <Box sx={{ mx: "auto", maxWidth: isGenerateStep ? 1200 : 800, px: 3, py: 6 }}>
        {/* Breadcrumb */}
        <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 1 }}>
          <ButtonBase
            onClick={() => router.push("/home")}
            sx={{ fontSize: "14px", color: "#717171", "&:hover": { color: "#222222" } }}
          >
            Home
          </ButtonBase>
          <Typography sx={{ fontSize: "14px", color: "#717171" }}>/</Typography>
          <ButtonBase
            onClick={() => router.push(`/projects/${projectId}`)}
            sx={{ fontSize: "14px", color: "#717171", "&:hover": { color: "#222222" } }}
          >
            {projectName || "Project"}
          </ButtonBase>
          <Typography sx={{ fontSize: "14px", color: "#717171" }}>/</Typography>
          <Typography sx={{ fontSize: "14px", color: "#222222" }}>New poster</Typography>
        </Box>

        {/* Step indicator */}
        <WizardProgress steps={WIZARD_STEPS} currentStep={currentStep} />

        {/* Step content */}
        {children}
      </Box>
    </PosterWizardContext.Provider>
  );
}
