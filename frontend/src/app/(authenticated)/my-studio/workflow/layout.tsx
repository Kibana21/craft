"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { StudioIntent, VariationCount } from "@/types/studio";

// Plan doc 05 §Context.

export type WorkflowMode = "single" | "batch";

export interface StudioWorkflowContextValue {
  mode: WorkflowMode;
  sourceImageIds: string[];
  intent: StudioIntent | null;
  styleInputs: Record<string, unknown>;
  mergedPrompt: string;
  aiEnrichments: string[];
  variationCount: VariationCount;
  runId: string | null;
  regenerationHistory: string[];

  setMode: (m: WorkflowMode) => void;
  setSourceImageIds: (ids: string[]) => void;
  setIntent: (i: StudioIntent | null) => void;
  setStyleInputs: (v: Record<string, unknown>) => void;
  setMergedPrompt: (p: string, enrichments?: string[]) => void;
  setVariationCount: (n: VariationCount) => void;
  setRunId: (id: string | null) => void;
  pushRegeneration: (prev: string) => void;
  undoRegeneration: () => string | null;
  reset: () => void;
}

const StudioWorkflowContext = createContext<StudioWorkflowContextValue | null>(null);

export function useStudioWorkflow(): StudioWorkflowContextValue {
  const ctx = useContext(StudioWorkflowContext);
  if (!ctx) throw new Error("useStudioWorkflow must be called inside the workflow layout");
  return ctx;
}

export default function StudioWorkflowLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [mode, setMode] = useState<WorkflowMode>("single");
  const [sourceImageIds, setSourceImageIds] = useState<string[]>([]);
  const [intent, setIntent] = useState<StudioIntent | null>(null);
  const [styleInputs, setStyleInputs] = useState<Record<string, unknown>>({});
  const [mergedPrompt, setMergedPromptState] = useState("");
  const [aiEnrichments, setAiEnrichments] = useState<string[]>([]);
  const [variationCount, setVariationCount] = useState<VariationCount>(4);
  const [runId, setRunId] = useState<string | null>(null);
  const [regenerationHistory, setRegenerationHistory] = useState<string[]>([]);

  const setMergedPrompt = useCallback((p: string, enrichments?: string[]) => {
    setMergedPromptState(p);
    if (enrichments) setAiEnrichments(enrichments);
  }, []);

  const pushRegeneration = useCallback((prev: string) => {
    // Cap at 3 so the "undo" stack doesn't grow unbounded (doc 03 §Prompt
    // regeneration). Keeps client memory small.
    setRegenerationHistory((h) => [prev, ...h].slice(0, 3));
  }, []);

  const undoRegeneration = useCallback((): string | null => {
    let popped: string | null = null;
    setRegenerationHistory((h) => {
      if (h.length === 0) return h;
      popped = h[0];
      return h.slice(1);
    });
    return popped;
  }, []);

  const reset = useCallback(() => {
    setSourceImageIds([]);
    setIntent(null);
    setStyleInputs({});
    setMergedPromptState("");
    setAiEnrichments([]);
    setVariationCount(4);
    setRunId(null);
    setRegenerationHistory([]);
  }, []);

  const value = useMemo<StudioWorkflowContextValue>(
    () => ({
      mode,
      sourceImageIds,
      intent,
      styleInputs,
      mergedPrompt,
      aiEnrichments,
      variationCount,
      runId,
      regenerationHistory,
      setMode,
      setSourceImageIds,
      setIntent,
      setStyleInputs,
      setMergedPrompt,
      setVariationCount,
      setRunId,
      pushRegeneration,
      undoRegeneration,
      reset,
    }),
    [
      mode,
      sourceImageIds,
      intent,
      styleInputs,
      mergedPrompt,
      aiEnrichments,
      variationCount,
      runId,
      regenerationHistory,
      setMergedPrompt,
      pushRegeneration,
      undoRegeneration,
      reset,
    ],
  );

  return (
    <StudioWorkflowContext.Provider value={value}>
      <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 3 }}>
        {/* Breadcrumb */}
        <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
          <ButtonBase
            onClick={() => router.push("/my-studio")}
            sx={{ fontSize: "14px", color: "#717171", "&:hover": { color: "#1F1F1F" } }}
          >
            My Studio
          </ButtonBase>
          <Typography sx={{ fontSize: "14px", color: "#9E9E9E" }}>/</Typography>
          <Typography sx={{ fontSize: "14px", color: "#1F1F1F", fontWeight: 500 }}>
            {mode === "batch" ? "Batch workflow" : "Enhancement workflow"}
          </Typography>
        </Box>
        {children}
      </Box>
    </StudioWorkflowContext.Provider>
  );
}
