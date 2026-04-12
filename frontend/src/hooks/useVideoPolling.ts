"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { listGeneratedVideos } from "@/lib/api/video-sessions";
import type { GeneratedVideo, GeneratedVideoListResponse } from "@/types/generated-video";

const POLL_INTERVAL_MS = 5000;

interface UseVideoPollingResult {
  videos: GeneratedVideo[];
  setVideos: React.Dispatch<React.SetStateAction<GeneratedVideo[]>>;
  anyActive: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useVideoPolling(sessionId: string | null): UseVideoPollingResult {
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [anyActive, setAnyActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef(sessionId);
  const anyActiveRef = useRef(anyActive);
  sessionIdRef.current = sessionId;
  anyActiveRef.current = anyActive;

  const fetch = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const data: GeneratedVideoListResponse = await listGeneratedVideos(sessionIdRef.current);
      setVideos(data.videos);
      setAnyActive(data.any_active);
      return data.any_active;
    } catch {
      // On network error, keep polling if we last knew something was active
      return anyActiveRef.current;
    }
  }, []);

  const scheduleNext = useCallback(
    (active: boolean) => {
      if (!active) return; // nothing polling — stop
      timerRef.current = setTimeout(async () => {
        // Pause polling when tab is hidden — resume on visibility
        if (document.visibilityState === "hidden") {
          scheduleNext(true);
          return;
        }
        const stillActive = await fetch();
        scheduleNext(stillActive ?? false);
      }, POLL_INTERVAL_MS);
    },
    [fetch]
  );

  const refresh = useCallback(async () => {
    const active = await fetch();
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleNext(active ?? false);
  }, [fetch, scheduleNext]);

  // Initial load
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const active = await fetch();
      if (!cancelled) {
        setIsLoading(false);
        scheduleNext(active ?? false);
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId, fetch, scheduleNext]);

  return { videos, setVideos, anyActive, isLoading, refresh };
}
