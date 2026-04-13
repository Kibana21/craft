"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { WizardProgress } from "@/components/projects/wizard/wizard-progress";
import { createArtifact, fetchArtifactDetail } from "@/lib/api/artifacts";
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

// Parallel array — index-aligned with WIZARD_STEPS. Used to map a step index
// back to the URL segment when the user clicks a step in the progress bar.
const STEP_INDEX_TO_SEGMENT = ["brief", "subject", "copy", "compose", "generate"];

// Returns the deepest wizard segment that has populated data. Used to land the
// user on the last step they worked on when they re-open an existing poster.
function resolveDeepestSegment(content: Record<string, unknown>): string {
  const generation = content.generation as PosterGenerationState | undefined;
  if (generation?.variants && generation.variants.length > 0) return "generate";

  const composition = content.composition as PosterCompositionContent | undefined;
  if (
    composition &&
    (composition.merged_prompt ||
      composition.format ||
      composition.layout_template ||
      composition.visual_style)
  ) {
    return "compose";
  }

  const copy = content.copy as PosterCopyContent | undefined;
  if (
    copy &&
    (copy.headline || copy.subheadline || copy.body || copy.cta_text || copy.brand_tagline)
  ) {
    return "copy";
  }

  const subject = content.subject as PosterSubjectContent | undefined;
  if (subject?.type) return "subject";

  return "brief";
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function PosterWizardLayout({ children }: { children: React.ReactNode }) {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadArtifactId = searchParams.get("load");

  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // Track which artifact / "new" session we have already initialised.
  // Using the load-key (artifact id or "new") as the guard is more robust
  // than a simple boolean ref: it survives Next.js router-cache restores and
  // correctly re-initialises when the user opens a *different* existing poster.
  const loadedKeyRef = useRef<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [artifactName, setArtifactName] = useState<string>("");

  const [brief, setBriefState] = useState<PosterBriefContent>(DEFAULT_BRIEF);
  const [subject, setSubjectState] = useState<PosterSubjectContent>(DEFAULT_SUBJECT);
  const [copy, setCopyState] = useState<PosterCopyContent>(DEFAULT_COPY);
  const [composition, setCompositionState] = useState<PosterCompositionContent>(DEFAULT_COMPOSITION);
  const [generation, setGenerationState] = useState<PosterGenerationState>(DEFAULT_GENERATION);

  // On mount / when the load target changes: fetch project + artifact.
  useEffect(() => {
    if (!projectId) return;
    const requestedKey = loadArtifactId ?? "new";
    // Skip only when we already handled this exact key.  Using the key (not a
    // boolean) means navigating to a *different* existing poster correctly
    // re-initialises, and StrictMode double-invokes are still blocked.
    if (loadedKeyRef.current === requestedKey) return;
    loadedKeyRef.current = requestedKey;
    setIsInitializing(true);

    const init = async () => {
      try {
        if (loadArtifactId) {
          // Loading an existing poster artifact
          const [project, artifact] = await Promise.all([
            fetchProjectDetail(projectId),
            fetchArtifactDetail(loadArtifactId),
          ]);
          setProjectName(project.name);
          setArtifactName(artifact.name || "Untitled poster");
          setArtifactId(artifact.id);
          // Reset wizard state to defaults before applying saved content so
          // stale state from a previous session doesn't bleed through.
          setBriefState(DEFAULT_BRIEF);
          setSubjectState(DEFAULT_SUBJECT);
          setCopyState(DEFAULT_COPY);
          setCompositionState(DEFAULT_COMPOSITION);
          setGenerationState(DEFAULT_GENERATION);
          // Restore saved sections
          const c = (artifact.content ?? {}) as Record<string, unknown>;
          if (c.brief) setBriefState((prev) => ({ ...prev, ...(c.brief as Partial<PosterBriefContent>) }));
          if (c.subject) setSubjectState((prev) => ({ ...prev, ...(c.subject as Partial<PosterSubjectContent>) }));
          if (c.copy) setCopyState((prev) => ({ ...prev, ...(c.copy as Partial<PosterCopyContent>) }));
          if (c.composition) setCompositionState((prev) => ({ ...prev, ...(c.composition as Partial<PosterCompositionContent>) }));
          if (c.generation) setGenerationState((prev) => ({ ...prev, ...(c.generation as Partial<PosterGenerationState>) }));

          // If the user entered via the default /brief route, jump to the
          // deepest step that has data so they don't have to click through.
          const currentSegment = pathname.split("/").pop() ?? "";
          if (currentSegment === "brief") {
            const target = resolveDeepestSegment(c);
            if (target !== "brief") {
              router.replace(
                `/projects/${projectId}/artifacts/new-poster/${target}?load=${loadArtifactId}`,
              );
            }
          }
        } else {
          // Creating a new poster artifact
          const [project, artifact] = await Promise.all([
            fetchProjectDetail(projectId),
            createArtifact(projectId, {
              type: "poster",
              name: "Untitled poster",
              content: { schema_version: 1 },
            }),
          ]);
          setProjectName(project.name);
          setArtifactName("New poster");
          setArtifactId(artifact.id);
        }
      } catch {
        router.push(`/projects/${projectId}`);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loadArtifactId]);

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
          <Typography sx={{ fontSize: "14px", color: "#222222" }}>
            {brief.title?.trim() || artifactName || "Poster"}
          </Typography>
        </Box>

        {/* Step indicator */}
        <WizardProgress
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={(idx) => {
            const target = STEP_INDEX_TO_SEGMENT[idx];
            if (!target || !artifactId) return;
            router.push(
              `/projects/${projectId}/artifacts/new-poster/${target}?load=${artifactId}`,
            );
          }}
        />

        {/* Step content */}
        {children}
      </Box>
    </PosterWizardContext.Provider>
  );
}
