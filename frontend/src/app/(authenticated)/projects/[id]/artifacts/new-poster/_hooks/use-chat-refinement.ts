"use client";

// Hook for chat-based poster refinement (Phase D).
// Wraps POST /api/ai/poster/refine-chat.
// Turn limit: 6 per selected variant (enforced by backend; client shows nudge).

import { useCallback, useState } from "react";
import { refineChat, type RefineChatResponse } from "@/lib/api/poster-wizard";
import type { ChangeLogEntry } from "@/types/poster-wizard";

export interface ChatTurn {
  role: "user" | "ai" | "system";
  content: string;
  turn_index: number;
  action_type?: RefineChatResponse["action_type"];
  redirect_target?: RefineChatResponse["redirect_target"];
  new_image_url?: string | null;
}

const MAX_TURNS = 6;

interface UseChatRefinementOptions {
  artifactId: string | null;
  variantId: string | null;
  originalMergedPrompt: string;
  changeHistory: ChangeLogEntry[];
  onImageUpdate?: (newImageUrl: string) => void;
  onRedirect?: (target: RefineChatResponse["redirect_target"]) => void;
}

export function useChatRefinement({
  artifactId,
  variantId,
  originalMergedPrompt,
  changeHistory,
  onImageUpdate,
  onRedirect,
}: UseChatRefinementOptions) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnCount = turns.filter((t) => t.role === "user").length;
  const isAtLimit = turnCount >= MAX_TURNS;

  const submit = useCallback(
    async (userMessage: string) => {
      if (!artifactId || !variantId || isLoading || isAtLimit) return;

      const userTurn: ChatTurn = {
        role: "user",
        content: userMessage,
        turn_index: turnCount,
      };
      setTurns((prev) => [...prev, userTurn]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await refineChat({
          artifact_id: artifactId,
          variant_id: variantId,
          user_message: userMessage,
          change_history: changeHistory,
          original_merged_prompt: originalMergedPrompt,
        });

        const aiTurn: ChatTurn = {
          role: "ai",
          content: response.ai_response,
          turn_index: response.turn_index,
          action_type: response.action_type,
          redirect_target: response.redirect_target,
          new_image_url: response.new_image_url,
        };
        setTurns((prev) => [...prev, aiTurn]);

        if (response.new_image_url) {
          onImageUpdate?.(response.new_image_url);
        }
        if (response.action_type === "REDIRECT" && response.redirect_target) {
          onRedirect?.(response.redirect_target);
        }
      } catch (err) {
        const msg =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail: string }).detail)
            : "Chat refinement failed. Please try again.";
        setError(msg);
        // Remove the optimistically added user turn on failure
        setTurns((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [
      artifactId,
      variantId,
      isLoading,
      isAtLimit,
      turnCount,
      changeHistory,
      originalMergedPrompt,
      onImageUpdate,
      onRedirect,
    ],
  );

  const reset = useCallback(() => {
    setTurns([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    turns,
    turnCount,
    isAtLimit,
    isLoading,
    error,
    submit,
    reset,
    maxTurns: MAX_TURNS,
  };
}
