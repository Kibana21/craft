"use client";

// Per-field inline compliance hook for Step 3 copy fields (doc 08).
//
// Debounces 600 ms, maintains a session-local cache keyed by normalised text + tone
// so rapid same-text queries don't round-trip to the server.
// Tracks dismissed flags per session; dismissed flags re-appear if the offending
// text is re-introduced after being deleted.

import { useCallback, useEffect, useRef, useState } from "react";
import { checkField } from "@/lib/api/poster-wizard";
import type { ComplianceFlag } from "@/lib/api/poster-wizard";
import type { PosterTone } from "@/types/poster-wizard";

// Module-level session cache — survives component re-mounts within the same page session
const sessionCache = new Map<string, ComplianceFlag[]>();

function normaliseKey(text: string, tone: string): string {
  const normalised = text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  return `${normalised}:${tone}`;
}

function flagDismissKey(flag: ComplianceFlag): string {
  return `${flag.pattern_type}:${flag.matched_phrase.toLowerCase()}`;
}

interface UseFieldComplianceOptions {
  field: "headline" | "subheadline" | "body" | "cta_text";
  text: string;
  tone: PosterTone | "";
  enabled?: boolean; // set false to disable entirely (e.g., when not on copy step)
}

interface UseFieldComplianceResult {
  visibleFlags: ComplianceFlag[];
  isChecking: boolean;
  dismiss: (flag: ComplianceFlag) => void;
  totalFlagCount: number; // includes dismissed (for badge counting)
}

export function useFieldCompliance({
  field,
  text,
  tone,
  enabled = true,
}: UseFieldComplianceOptions): UseFieldComplianceResult {
  const [allFlags, setAllFlags] = useState<ComplianceFlag[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isChecking, setIsChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When text changes, un-dismiss flags whose matched phrase is no longer present
  useEffect(() => {
    if (dismissed.size === 0) return;
    setDismissed((prev) => {
      const textLower = text.toLowerCase();
      const next = new Set(prev);
      for (const key of prev) {
        const phrase = key.split(":").slice(1).join(":"); // everything after pattern_type:
        if (phrase && !textLower.includes(phrase)) {
          next.delete(key);
        }
      }
      return next.size === prev.size ? prev : next; // avoid re-render if unchanged
    });
  }, [text, dismissed.size]);

  // Debounced check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!enabled || !text || text.trim().length < 3) {
      setAllFlags([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const cacheKey = normaliseKey(text, tone || "PROFESSIONAL");

      // Session cache hit
      if (sessionCache.has(cacheKey)) {
        setAllFlags(sessionCache.get(cacheKey)!);
        return;
      }

      setIsChecking(true);
      try {
        const result = await checkField({
          field,
          text,
          tone_context: (tone as PosterTone) || "PROFESSIONAL",
        });
        sessionCache.set(cacheKey, result.flags);
        setAllFlags(result.flags);
      } catch {
        // Compliance is advisory — silently ignore errors
      } finally {
        setIsChecking(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [field, text, tone, enabled]);

  const dismiss = useCallback((flag: ComplianceFlag) => {
    setDismissed((prev) => new Set(prev).add(flagDismissKey(flag)));
  }, []);

  const visibleFlags = allFlags.filter((f) => !dismissed.has(flagDismissKey(f)));

  return {
    visibleFlags,
    isChecking,
    dismiss,
    totalFlagCount: allFlags.length,
  };
}
