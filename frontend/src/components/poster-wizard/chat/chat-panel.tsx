"use client";

// Chat refinement panel — Step 5 of the Poster Wizard.
// Implements the turn model, message types, change-log pills, suggestion chips,
// redirect notices, turn-limit nudge, and save-as-variant (doc 07).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { refineChat, saveAsVariant } from "@/lib/api/poster-wizard";
import type { GeneratedVariant } from "@/lib/api/poster-wizard";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  type: "system" | "user" | "ai" | "redirect" | "turn_limit_nudge";
  text: string;
  redirectTarget?: "STEP_2_SUBJECT" | "STEP_3_COPY" | "STEP_4_COMPOSITION" | null;
}

interface ChangeLogItem {
  id: string;
  description: string;
  accepted_at: string;
}

export interface PendingInpaintTurn {
  turn_id: string;
  new_image_url: string;
  change_description: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TURN_LIMIT = 6;

const SUGGESTION_CHIPS = [
  "Darken the background",
  "Try a different CTA colour",
  "More breathing room",
  "Stronger contrast on the headline",
];

const REDIRECT_STEP_LABELS: Record<string, string> = {
  STEP_2_SUBJECT: "Step 2 — Subject",
  STEP_3_COPY: "Step 3 — Copy",
  STEP_4_COMPOSITION: "Step 4 — Composition",
};

const REDIRECT_STEP_PATHS: Record<string, string> = {
  STEP_2_SUBJECT: "subject",
  STEP_3_COPY: "copy",
  STEP_4_COMPOSITION: "compose",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
      <Box
        sx={{
          maxWidth: "82%",
          px: 1.5,
          py: 1,
          borderRadius: "16px 16px 4px 16px",
          bgcolor: "#D0103A",
          color: "white",
          fontSize: "13px",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {text}
      </Box>
    </Box>
  );
}

function AiBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1.5 }}>
      <Box
        sx={{
          maxWidth: "82%",
          px: 1.5,
          py: 1,
          borderRadius: "4px 16px 16px 16px",
          bgcolor: "#F5F5F5",
          color: "#1F1F1F",
          fontSize: "13px",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {text}
      </Box>
    </Box>
  );
}

function SystemNotice({ text }: { text: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
      <Typography sx={{ fontSize: "12px", color: "#9E9E9E", fontStyle: "italic", textAlign: "center", px: 1 }}>
        {text}
      </Typography>
    </Box>
  );
}

function RedirectNotice({
  text,
  target,
  onNavigate,
}: {
  text: string;
  target: string;
  onNavigate: () => void;
}) {
  return (
    <Box sx={{ mb: 1.5, p: 1.5, borderRadius: "10px", bgcolor: "#E8F0FE", border: "1px solid #C5D4F7" }}>
      <Typography sx={{ fontSize: "12px", color: "#174EA6", mb: 1 }}>
        ℹ {text}
      </Typography>
      <Button
        size="small"
        onClick={onNavigate}
        sx={{
          borderRadius: 9999,
          textTransform: "none",
          bgcolor: "#174EA6",
          color: "white",
          fontSize: "11px",
          py: 0.4,
          px: 1.5,
          minHeight: 0,
          "&:hover": { bgcolor: "#1557B0" },
        }}
      >
        {REDIRECT_STEP_LABELS[target] ?? target} ←
      </Button>
    </Box>
  );
}

function TurnLimitNudge({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) {
  return (
    <Box sx={{ mb: 1.5, p: 1.5, borderRadius: "10px", bgcolor: "#F5F5F5", border: "1px solid #E8EAED" }}>
      <Typography sx={{ fontSize: "12px", color: "#5F6368", mb: 1 }}>
        You've made several refinements. Save as variant to continue refining.
      </Typography>
      <Button
        size="small"
        onClick={onSave}
        disabled={isSaving}
        variant="outlined"
        startIcon={isSaving ? <CircularProgress size={10} sx={{ color: "#D0103A" }} /> : undefined}
        sx={{
          borderRadius: 9999,
          textTransform: "none",
          borderColor: "#D0103A",
          color: "#D0103A",
          fontSize: "11px",
          py: 0.4,
          px: 1.5,
          minHeight: 0,
          "&:hover": { bgcolor: "#FFF1F4" },
        }}
      >
        Save as variant
      </Button>
    </Box>
  );
}

function TypingIndicator({ slowStatus }: { slowStatus: "none" | "slow" | "very_slow" }) {
  return (
    <Box>
      {slowStatus !== "none" && (
        <SystemNotice
          text={slowStatus === "very_slow" ? "Taking longer than usual…" : "Still working…"}
        />
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1.5, pl: 0.5 }}>
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: "4px 16px 16px 16px",
            bgcolor: "#F5F5F5",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "#9E9E9E",
                animation: "chatBounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
                "@keyframes chatBounce": {
                  "0%, 80%, 100%": { transform: "scale(0.8)", opacity: 0.5 },
                  "40%": { transform: "scale(1.2)", opacity: 1 },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ChatPanelProps {
  artifactId: string | null;
  variantId: string | null;
  mergedPrompt: string;
  onVariantImageUpdate: (variantId: string, newImageUrl: string) => void;
  onSaveAsVariant: (newVariant: GeneratedVariant) => void;
  pendingInpaintTurn: PendingInpaintTurn | null;
  onInpaintTurnConsumed: () => void;
  projectId: string;
}

export function ChatPanel({
  artifactId,
  variantId,
  mergedPrompt,
  onVariantImageUpdate,
  onSaveAsVariant,
  pendingInpaintTurn,
  onInpaintTurnConsumed,
  projectId,
}: ChatPanelProps) {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "init", type: "system", text: "Poster generated. Refine below." },
  ]);
  const [changeLog, setChangeLog] = useState<ChangeLogItem[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [slowStatus, setSlowStatus] = useState<"none" | "slow" | "very_slow">("none");
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verySlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset per-variant state when the selected variant changes
  useEffect(() => {
    setMessages([{ id: `init-${variantId ?? "none"}`, type: "system", text: "Poster generated. Refine below." }]);
    setChangeLog([]);
    setTurnCount(0);
    setInput("");
  }, [variantId]);

  // Consume inpaint result from parent — add it as a turn + change-log pill
  useEffect(() => {
    if (!pendingInpaintTurn) return;
    const { turn_id, new_image_url, change_description } = pendingInpaintTurn;

    setMessages((prev) => [
      ...prev,
      { id: turn_id, type: "ai", text: `Done — region updated: ${change_description}` },
    ]);
    setChangeLog((prev) => [
      ...prev,
      { id: turn_id, description: `Region edit: ${change_description}`, accepted_at: new Date().toISOString() },
    ]);
    setTurnCount((c) => c + 1);

    if (variantId) onVariantImageUpdate(variantId, new_image_url);
    onInpaintTurnConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInpaintTurn]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const clearSlowTimers = useCallback(() => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    if (verySlowTimerRef.current) clearTimeout(verySlowTimerRef.current);
    setSlowStatus("none");
  }, []);

  const startSlowTimers = useCallback(() => {
    slowTimerRef.current = setTimeout(() => setSlowStatus("slow"), 15_000);
    verySlowTimerRef.current = setTimeout(() => setSlowStatus("very_slow"), 30_000);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearSlowTimers(), [clearSlowTimers]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || turnCount >= TURN_LIMIT || !artifactId || !variantId) return;
    setInput("");

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, type: "user", text }]);
    setIsLoading(true);
    startSlowTimers();

    try {
      const result = await refineChat({
        artifact_id: artifactId,
        variant_id: variantId,
        user_message: text,
        change_history: changeLog,
        original_merged_prompt: mergedPrompt,
      });

      setTurnCount(result.turn_index + 1);

      if (result.action_type === "REDIRECT") {
        setMessages((prev) => [
          ...prev,
          {
            id: result.turn_id,
            type: "redirect",
            text: `That looks like a change to your ${redirectLabel(result.redirect_target)}. Want to go back to:`,
            redirectTarget: result.redirect_target,
          },
        ]);
      } else {
        // CHAT_REFINE or TURN_LIMIT_NUDGE — both may carry a new image
        if (result.new_image_url) {
          onVariantImageUpdate(variantId, result.new_image_url);
          setChangeLog((prev) => [
            ...prev,
            {
              id: result.turn_id,
              description: result.change_description,
              accepted_at: new Date().toISOString(),
            },
          ]);
        }
        if (result.action_type === "TURN_LIMIT_NUDGE") {
          setMessages((prev) => [
            ...prev,
            { id: result.turn_id, type: "turn_limit_nudge", text: result.ai_response },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: result.turn_id, type: "ai", text: result.ai_response },
          ]);
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { detail?: unknown; status?: number };
      const detail = typeof apiErr.detail === "object" && apiErr.detail !== null
        ? (apiErr.detail as { error_code?: string; detail?: string })
        : null;
      let friendly = "Something went wrong. Try rephrasing or try again.";
      if (detail?.error_code === "TURN_LIMIT_REACHED") {
        friendly = "You've hit the 6-turn limit. Save as a new variant to keep refining.";
        // Keep the counter correct so the input locks.
        setTurnCount(TURN_LIMIT);
      } else if (apiErr.status === 501) {
        friendly = "This refinement feature isn't available yet — please try again shortly.";
      } else if (detail?.detail) {
        friendly = String(detail.detail);
      }
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: "ai", text: friendly },
      ]);
    } finally {
      setIsLoading(false);
      clearSlowTimers();
    }
  };

  // Undo a change-log pill — re-sends refineChat with the pill removed
  const handleRemovePill = async (pillId: string) => {
    const pill = changeLog.find((p) => p.id === pillId);
    if (!pill || !artifactId || !variantId || isLoading) return;

    const newLog = changeLog.filter((p) => p.id !== pillId);
    setChangeLog(newLog);
    setIsLoading(true);
    startSlowTimers();

    try {
      const result = await refineChat({
        artifact_id: artifactId,
        variant_id: variantId,
        user_message: `undo the change: ${pill.description}`,
        change_history: newLog,
        original_merged_prompt: mergedPrompt,
      });

      if (result.new_image_url) onVariantImageUpdate(variantId, result.new_image_url);
      setMessages((prev) => [
        ...prev,
        { id: result.turn_id, type: "ai", text: `Undone: ${pill.description}` },
      ]);
    } catch {
      setChangeLog((prev) => [...prev, pill]); // rollback pill removal
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: "ai", text: "Undo failed. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
      clearSlowTimers();
    }
  };

  const handleSaveAsVariant = async () => {
    if (!artifactId || !variantId || isSavingVariant) return;
    setIsSavingVariant(true);
    try {
      const result = await saveAsVariant(artifactId, variantId);
      onSaveAsVariant(result.new_variant);
      // Reset chat for the new variant (the variantId prop change will also reset via the effect)
      setMessages([{ id: `init-new-${Date.now()}`, type: "system", text: "Saved as new variant. Continue refining." }]);
      setChangeLog([]);
      setTurnCount(0);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: "ai", text: "Save failed. Please try again." },
      ]);
    } finally {
      setIsSavingVariant(false);
    }
  };

  const turnLimitReached = turnCount >= TURN_LIMIT;
  const hasVariant = !!variantId;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#D0103A" />
          </svg>
          <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1F1F1F" }}>
            Refine
          </Typography>
        </Box>
        {hasVariant && (
          <Typography
            sx={{
              fontSize: "11px",
              color: turnLimitReached ? "#D0103A" : "#9E9E9E",
              fontWeight: turnLimitReached ? 600 : 400,
            }}
          >
            {turnCount} / {TURN_LIMIT} turns
          </Typography>
        )}
      </Box>

      {/* Message list */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 1.5,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {messages.map((msg) => {
          if (msg.type === "system") return <SystemNotice key={msg.id} text={msg.text} />;
          if (msg.type === "user") return <UserBubble key={msg.id} text={msg.text} />;
          if (msg.type === "redirect")
            return (
              <RedirectNotice
                key={msg.id}
                text={msg.text}
                target={msg.redirectTarget ?? ""}
                onNavigate={() => {
                  const seg = REDIRECT_STEP_PATHS[msg.redirectTarget ?? ""];
                  if (seg) router.push(`/projects/${projectId}/artifacts/new-poster/${seg}`);
                }}
              />
            );
          if (msg.type === "turn_limit_nudge")
            return (
              <Box key={msg.id}>
                <AiBubble text={msg.text} />
                <TurnLimitNudge onSave={handleSaveAsVariant} isSaving={isSavingVariant} />
              </Box>
            );
          return <AiBubble key={msg.id} text={msg.text} />;
        })}

        {isLoading && <TypingIndicator slowStatus={slowStatus} />}
      </Box>

      {/* Change-log pills */}
      {changeLog.length > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderTop: "1px solid #E8EAED",
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            flexShrink: 0,
          }}
        >
          {changeLog.map((pill) => (
            <Box
              key={pill.id}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.4,
                borderRadius: "9999px",
                bgcolor: "#F0F4FF",
                border: "1px solid #C5D4F7",
                fontSize: "11px",
                color: "#174EA6",
                fontWeight: 500,
              }}
            >
              <Typography sx={{ fontSize: "11px", color: "#174EA6", fontWeight: 500 }}>
                {pill.description}
              </Typography>
              <Box
                component="button"
                onClick={() => handleRemovePill(pill.id)}
                disabled={isLoading}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: isLoading ? "default" : "pointer",
                  p: 0,
                  color: "#174EA6",
                  opacity: isLoading ? 0.5 : 1,
                  "&:hover:not(:disabled)": { color: "#D0103A" },
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Suggestion chips — visible when input is empty and we're not loading */}
      {!isLoading && !input && hasVariant && !turnLimitReached && (
        <Box
          sx={{
            px: 1.5,
            py: 0.75,
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            flexShrink: 0,
          }}
        >
          {SUGGESTION_CHIPS.map((chip) => (
            <Box
              key={chip}
              component="button"
              onClick={() => setInput(chip)}
              sx={{
                px: 1.25,
                py: 0.4,
                borderRadius: "9999px",
                border: "1px solid #E8EAED",
                bgcolor: "#FFFFFF",
                color: "#484848",
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.15s",
                "&:hover": { borderColor: "#D0103A", color: "#D0103A", bgcolor: "#FFF1F4" },
              }}
            >
              {chip}
            </Box>
          ))}
        </Box>
      )}

      {/* Input area */}
      <Box sx={{ px: 1.5, pb: 1.5, pt: 0.75, flexShrink: 0 }}>
        {!hasVariant ? (
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: "10px",
              bgcolor: "#F7F7F7",
              border: "1px solid #E8EAED",
              fontSize: "12px",
              color: "#9E9E9E",
              textAlign: "center",
            }}
          >
            Generate a poster first to enable refinement.
          </Box>
        ) : turnLimitReached ? (
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: "10px",
              bgcolor: "#FFF1F4",
              border: "1px solid #F5C6D0",
              fontSize: "12px",
              color: "#5F6368",
              textAlign: "center",
            }}
          >
            Turn limit reached.{" "}
            <Box
              component="button"
              onClick={handleSaveAsVariant}
              disabled={isSavingVariant}
              sx={{
                background: "none",
                border: "none",
                color: "#D0103A",
                fontWeight: 600,
                cursor: isSavingVariant ? "default" : "pointer",
                fontSize: "12px",
                p: 0,
              }}
            >
              {isSavingVariant ? "Saving…" : "Save as variant"}
            </Box>{" "}
            to continue.
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder="Describe a change… (Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "13px",
                  borderRadius: "10px",
                  "& fieldset": { borderColor: "#E5E5E5" },
                  "&:hover fieldset": { borderColor: "#ABABAB" },
                  "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
                },
              }}
            />
            <Box
              component="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                bgcolor: !input.trim() || isLoading ? "#E5E5E5" : "#D0103A",
                border: "none",
                cursor: !input.trim() || isLoading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background-color 0.15s",
                "&:hover:not(:disabled)": { bgcolor: "#A00D2E" },
              }}
            >
              {isLoading ? (
                <CircularProgress size={14} sx={{ color: "white" }} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function redirectLabel(target: string | null | undefined): string {
  const map: Record<string, string> = {
    STEP_2_SUBJECT: "subject",
    STEP_3_COPY: "copy",
    STEP_4_COMPOSITION: "composition",
  };
  return map[target ?? ""] ?? "content";
}
