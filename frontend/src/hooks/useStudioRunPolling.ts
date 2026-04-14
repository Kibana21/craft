"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRunStatus } from "@/lib/api/studio";
import type { WorkflowRunStatusResponse } from "@/types/studio";

// Plan doc 05 §Polling pattern.
// - 2 s interval while status is QUEUED or RUNNING.
// - Stops when DONE / FAILED / PARTIAL.
// - Pauses when the tab is hidden so we don't burn quota / requests in bg.
// - Safe across run switches: swapping `runId` cancels the previous interval.
const POLL_INTERVAL_MS = 2000;

export function useStudioRunPolling(runId: string | null) {
  const [status, setStatus] = useState<WorkflowRunStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const tick = useCallback(async (id: string) => {
    try {
      const res = await getRunStatus(id);
      setStatus(res);
      setError(null);
      if (res.status === "DONE" || res.status === "FAILED" || res.status === "PARTIAL") {
        stop();
      }
    } catch (err: unknown) {
      const e = err as { detail?: unknown; status?: number };
      const detail =
        typeof e.detail === "string"
          ? e.detail
          : typeof e.detail === "object" && e.detail !== null
            ? (e.detail as { detail?: string }).detail ?? null
            : null;
      setError(detail ?? "Could not fetch run status.");
      // Transient errors: keep polling. 404 means the run was wiped — stop.
      if (e.status === 404) stop();
    }
  }, [stop]);

  useEffect(() => {
    if (!runId) {
      stop();
      setStatus(null);
      return;
    }
    // Immediate tick so the UI gets fresh state without waiting 2 s.
    tick(runId);
    intervalRef.current = setInterval(() => {
      // Pause when hidden — resumes on next tick after becoming visible.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      tick(runId);
    }, POLL_INTERVAL_MS);
    isPollingRef.current = true;
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Visibility change: force an immediate tick when tab re-shows so the user
  // sees the latest state without waiting for the next interval.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "visible" && runId && isPollingRef.current) {
        tick(runId);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [runId, tick]);

  const isActive = status?.status === "QUEUED" || status?.status === "RUNNING";
  return { status, error, isActive, stop };
}
