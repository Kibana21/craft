"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { fetchArtifactDetail } from "@/lib/api/artifacts";
import {
  getScript,
  updateScript,
  draftScript,
  rewriteScript,
  listScriptVersions,
  restoreScriptVersion,
} from "@/lib/api/video-sessions";
import { fetchVideoSession } from "@/lib/api/video-sessions";
import { ScriptEditor } from "@/components/video/script-editor";
import { ToneChips } from "@/components/video/tone-chips";
import { ScriptVersionDrawer } from "@/components/video/script-version-drawer";
import type { Script, ScriptVersion, RewriteTone } from "@/types/video-script";

export default function ScriptStepPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [briefOverrides, setBriefOverrides] = useState<{
    key_message?: string;
    target_audience?: string;
    tone?: string;
    cta_text?: string;
    video_brief?: string;
  }>({});
  const [targetDuration, setTargetDuration] = useState(60);
  const [script, setScript] = useState<Script | null>(null);
  const [localContent, setLocalContent] = useState("");
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState("");
  // Tracks the most recent autosave failure. Surfaced inline so the user
  // doesn't think their edits were committed when they weren't.
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRef = useRef<((c: string) => void) | null>(null);

  useEffect(() => {
    if (!artifactId) return;
    fetchArtifactDetail(artifactId).then(async (art) => {
      const vsId = art.video_session_id;
      if (!vsId) {
        router.push(`/projects/${projectId}/artifacts/${artifactId}/video/presenter`);
        return;
      }
      setSessionId(vsId);

      // Extract brief fields from artifact content for use as script draft overrides
      const c = (art.content ?? {}) as Record<string, unknown>;
      setBriefOverrides({
        key_message: c.key_message ? String(c.key_message) : undefined,
        target_audience: c.target_audience ? String(c.target_audience) : undefined,
        tone: c.tone ? String(c.tone) : undefined,
        cta_text: c.cta_text ? String(c.cta_text) : undefined,
        video_brief: c.video_brief ? String(c.video_brief) : undefined,
      });

      const [vs, sc] = await Promise.all([
        fetchVideoSession(vsId),
        getScript(vsId),
      ]);
      setTargetDuration(vs.target_duration_seconds);
      setScript(sc);
      setLocalContent(sc.content);
    }).catch(() => router.push(`/projects/${projectId}`));
  }, [artifactId, projectId, router]);

  const handleSave = useCallback(
    async (content: string) => {
      if (!sessionId) return;
      setIsSaving(true);
      try {
        const updated = await updateScript(sessionId, content);
        setScript(updated);
        setSaveError(null);
      } catch (err: unknown) {
        // Surface the failure so the user knows their edit didn't persist.
        // Previously we silently swallowed it — the editor showed "Saved"
        // and the user moved on with unsaved changes.
        const e = err as { detail?: unknown };
        const detail =
          typeof e.detail === "string"
            ? e.detail
            : typeof e.detail === "object" && e.detail !== null
              ? (e.detail as { detail?: string }).detail ?? null
              : null;
        setSaveError(detail ?? "Couldn't save — your edits aren't persisted yet.");
      } finally {
        setIsSaving(false);
      }
    },
    [sessionId]
  );

  // Expose save so AI actions can flush before firing
  saveRef.current = handleSave;

  const handleDraft = async () => {
    if (!sessionId) return;
    // Flush any pending auto-save first
    if (localContent !== script?.content) {
      await saveRef.current?.(localContent);
    }
    setIsDrafting(true);
    setError("");
    try {
      const updated = await draftScript(sessionId, briefOverrides);
      setScript(updated);
      setLocalContent(updated.content);
    } catch {
      setError("AI draft failed. Please try again.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleRewrite = async (tone: RewriteTone) => {
    if (!sessionId) return;
    // Flush pending save first
    if (localContent !== script?.content) {
      await saveRef.current?.(localContent);
    }
    const updated = await rewriteScript(sessionId, tone);
    setScript(updated);
    setLocalContent(updated.content);
  };

  const handleOpenVersions = async () => {
    if (!sessionId) return;
    const v = await listScriptVersions(sessionId);
    setVersions(v);
    setDrawerOpen(true);
  };

  const handleRestore = async (versionId: string) => {
    if (!sessionId) return;
    const updated = await restoreScriptVersion(sessionId, versionId);
    setScript(updated);
    setLocalContent(updated.content);
  };

  const handleProceed = async () => {
    if (!sessionId) return;
    // Flush any pending save before navigating
    if (localContent !== script?.content) {
      await handleSave(localContent);
    }
    router.push(`/projects/${projectId}/artifacts/${artifactId}/video/storyboard`);
  };

  if (!script) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress sx={{ color: "#D0103A" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 860 }}>
      {/* Heading + actions */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Write your script
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Target: {targetDuration}s (~{Math.round(targetDuration / 60 * 150)} words at 150 wpm)
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleOpenVersions}
            sx={{
              textTransform: "none",
              borderColor: "#E5E5E5",
              color: "#222222",
              "&:hover": { borderColor: "#ABABAB", bgcolor: "transparent" },
            }}
          >
            History
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={isDrafting}
            onClick={handleDraft}
            startIcon={isDrafting ? <CircularProgress size={14} /> : undefined}
            sx={{
              textTransform: "none",
              borderColor: "#D0103A",
              color: "#D0103A",
              "&:hover": { borderColor: "#A00D2E", bgcolor: "transparent" },
              "&:disabled": { borderColor: "#E5E5E5", color: "#ABABAB" },
            }}
          >
            {isDrafting ? "Drafting…" : "Auto-draft from brief"}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {saveError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      <ScriptEditor
        content={localContent}
        wordCount={script.word_count}
        estimatedDurationSeconds={script.estimated_duration_seconds}
        targetDurationSeconds={targetDuration}
        isSaving={isSaving}
        onChange={setLocalContent}
        onSave={handleSave}
      />

      {/* Tone chips */}
      <Box sx={{ mt: 3 }}>
        <ToneChips onRewrite={handleRewrite} />
      </Box>

      {/* Proceed */}
      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disabled={!script.content.trim()}
          onClick={handleProceed}
          sx={{
            bgcolor: "#D0103A",
            "&:hover": { bgcolor: "#A00D2E" },
            "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
            px: 4,
            py: 1.25,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          Continue to storyboard
        </Button>
      </Box>

      <ScriptVersionDrawer
        open={drawerOpen}
        versions={versions}
        onClose={() => setDrawerOpen(false)}
        onRestore={handleRestore}
      />
    </Box>
  );
}
