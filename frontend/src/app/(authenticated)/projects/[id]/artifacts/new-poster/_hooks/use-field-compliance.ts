"use client";

// Per-field compliance hook (Phase E integration point, doc 05 §Compliance Inline).
// Debounces 600ms, hashes text to avoid redundant calls, caches results in memory.
//
// Calls POST /api/compliance/check-field.
// Returns flags → rendered below the field as an amber warning card.

import { useCallback, useEffect, useRef, useState } from "react";
import { checkField, type ComplianceFlag } from "@/lib/api/poster-wizard";
import type { PosterTone } from "@/types/poster-wizard";

const DEBOUNCE_MS = 600;

// ── Simple hash ───────────────────────────────────────────────────────────────

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// ── In-memory result cache ────────────────────────────────────────────────────

const cache = new Map<string, ComplianceFlag[]>();

// ── Hook ──────────────────────────────────────────────────────────────────────

type CopyField = "headline" | "subheadline" | "body" | "cta_text";

interface UseFieldComplianceOptions {
  field: CopyField;
  text: string;
  tone: PosterTone | "";
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Returns:
 *  - `flags` — active compliance flags for this field (empty while loading or when clean)
 *  - `isChecking` — true while the server call is in-flight
 *
 * Phase E: the `enabled` prop defaults to `true`. Set it to `false` until Phase E ships
 * to prevent hitting the 501 endpoint.
 */
export function useFieldCompliance({
  field,
  text,
  tone,
  debounceMs = DEBOUNCE_MS,
  enabled = false, // Phase E — set true when check-field endpoint is live
}: UseFieldComplianceOptions) {
  const [flags, setFlags] = useState<ComplianceFlag[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(
    async (currentText: string, currentTone: PosterTone | "") => {
      if (!currentText.trim() || currentTone === "") {
        setFlags([]);
        return;
      }

      const hash = simpleHash(`${field}:${currentTone}:${currentText}`);
      const cached = cache.get(hash);
      if (cached !== undefined) {
        setFlags(cached);
        return;
      }

      setIsChecking(true);
      try {
        const result = await checkField({
          field,
          text: currentText,
          tone_context: currentTone,
          content_hash: hash,
        });
        cache.set(hash, result.flags);
        setFlags(result.flags);
      } catch {
        // Non-fatal — compliance check failure should not block editing
        setFlags([]);
      } finally {
        setIsChecking(false);
      }
    },
    [field],
  );

  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      check(text, tone).catch(() => {
        // already handled
      });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, text, tone, debounceMs, check]);

  return { flags, isChecking };
}
