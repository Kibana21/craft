"use client";

// Dual-layer draft persistence for the Poster Wizard (doc 05 §Draft Persistence).
//
// Layer 1 — localStorage: written with 500ms debounce on every state change.
//   Key: `poster-wizard-draft:{projectId}`
//   Hydrates context on mount before the first server fetch.
//
// Layer 2 — Server: PATCH /api/artifacts/{id} with full PosterContent.
//   Cadence: step-change (explicit), AI-accept (explicit), 2s debounce on free-text edits.

import { useCallback, useEffect, useRef } from "react";
import { updateArtifact } from "@/lib/api/artifacts";

const LOCAL_DEBOUNCE_MS = 500;
const SERVER_DEBOUNCE_MS = 2000;

// ── Local storage helpers ─────────────────────────────────────────────────────

function localKey(projectId: string) {
  return `poster-wizard-draft:${projectId}`;
}

export function readLocalDraft(projectId: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function clearLocalDraft(projectId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(localKey(projectId));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UsePosterDraftOptions {
  projectId: string;
  artifactId: string | null;
  getContentPayload: () => Record<string, unknown>;
  onSavingChange?: (saving: boolean) => void;
}

/**
 * Returns:
 *  - `saveNow(reason)` — immediately flush both localStorage and the server PATCH.
 *    Call this on step-change and AI-accept.
 *
 * The hook also installs a debounced auto-save that fires automatically when the
 * content returned by `getContentPayload` changes. Callers trigger re-renders
 * whenever wizard state changes, which re-invokes the debounce timer.
 */
export function usePosterDraft({
  projectId,
  artifactId,
  getContentPayload,
  onSavingChange,
}: UsePosterDraftOptions) {
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const getPayloadRef = useRef(getContentPayload);
  getPayloadRef.current = getContentPayload;

  // ── Flush to localStorage ──────────────────────────────────────────────────
  const writeLocal = useCallback(() => {
    if (!projectId) return;
    try {
      localStorage.setItem(localKey(projectId), JSON.stringify(getPayloadRef.current()));
    } catch {
      // storage full — non-fatal
    }
  }, [projectId]);

  // ── Flush to server ────────────────────────────────────────────────────────
  const writeServer = useCallback(async () => {
    if (!artifactId || isSavingRef.current) return;
    isSavingRef.current = true;
    onSavingChange?.(true);
    try {
      await updateArtifact(artifactId, { content: getPayloadRef.current() });
    } catch {
      // non-fatal: draft is safely in localStorage
    } finally {
      isSavingRef.current = false;
      onSavingChange?.(false);
    }
  }, [artifactId, onSavingChange]);

  // ── Debounced auto-save (triggered by callers re-rendering this hook) ─────
  useEffect(() => {
    // Debounce localStorage write
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(writeLocal, LOCAL_DEBOUNCE_MS);

    // Debounce server write (only when we have an artifact)
    if (artifactId) {
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
      serverTimerRef.current = setTimeout(() => {
        writeServer().catch(() => {
          // non-fatal
        });
      }, SERVER_DEBOUNCE_MS);
    }

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
    };
  }); // no deps — intentionally fires on every render

  // ── Immediate flush (step-change / AI-accept) ─────────────────────────────
  const saveNow = useCallback(
    async (reason: "step-change" | "ai-accept" | "manual") => {
      // Cancel pending debounced timers
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current);

      writeLocal();
      await writeServer();
      void reason; // logging hook-point (telemetry optional)
    },
    [writeLocal, writeServer],
  );

  return { saveNow };
}
