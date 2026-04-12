import { apiClient } from "@/lib/api-client";
import type { VideoSession, AssignPresenterData } from "@/types/presenter";
import type { Script, ScriptVersion, RewriteTone } from "@/types/video-script";

export async function fetchVideoSession(sessionId: string): Promise<VideoSession> {
  return apiClient.get<VideoSession>(`/api/video-sessions/${sessionId}`);
}

/** Alias for fetchVideoSession — preferred name in layout/context usage. */
export const getSession = fetchVideoSession;

export async function assignPresenter(
  sessionId: string,
  data: AssignPresenterData
): Promise<VideoSession> {
  return apiClient.patch<VideoSession>(`/api/video-sessions/${sessionId}/presenter`, data);
}

// ── Script ────────────────────────────────────────────────────────────────────

export async function getScript(sessionId: string): Promise<Script> {
  return apiClient.get<Script>(`/api/video-sessions/${sessionId}/script`);
}

export async function updateScript(sessionId: string, content: string): Promise<Script> {
  return apiClient.patch<Script>(`/api/video-sessions/${sessionId}/script`, { content });
}

export async function draftScript(
  sessionId: string,
  overrides?: { target_audience?: string; key_message?: string; tone?: string; cta_text?: string; video_brief?: string }
): Promise<Script> {
  return apiClient.post<Script>(`/api/video-sessions/${sessionId}/script/draft`, overrides ?? {});
}

export async function rewriteScript(sessionId: string, tone: RewriteTone): Promise<Script> {
  return apiClient.post<Script>(`/api/video-sessions/${sessionId}/script/rewrite`, { tone });
}

// ── Video generation ──────────────────────────────────────────────────────────

export async function triggerGeneration(sessionId: string): Promise<import("@/types/generated-video").GeneratedVideo> {
  return apiClient.post(`/api/video-sessions/${sessionId}/generate`, {});
}

export async function listGeneratedVideos(sessionId: string): Promise<import("@/types/generated-video").GeneratedVideoListResponse> {
  return apiClient.get(`/api/video-sessions/${sessionId}/videos`);
}

// ── Scenes ────────────────────────────────────────────────────────────────────

export async function generateScenes(sessionId: string): Promise<import("@/types/scene").Scene[]> {
  return apiClient.post(`/api/video-sessions/${sessionId}/scenes/generate`, {});
}

export async function regenerateScenes(sessionId: string): Promise<import("@/types/scene").Scene[]> {
  return apiClient.post(`/api/video-sessions/${sessionId}/scenes/regenerate`, {});
}

export async function listScenes(sessionId: string): Promise<import("@/types/scene").SceneListResponse> {
  return apiClient.get(`/api/video-sessions/${sessionId}/scenes`);
}

export async function listScriptVersions(sessionId: string): Promise<ScriptVersion[]> {
  return apiClient.get<ScriptVersion[]>(`/api/video-sessions/${sessionId}/script-versions`);
}

export async function restoreScriptVersion(sessionId: string, versionId: string): Promise<Script> {
  return apiClient.post<Script>(
    `/api/video-sessions/${sessionId}/script-versions/${versionId}/restore`,
    {}
  );
}

// ── Brief ─────────────────────────────────────────────────────────────────────

export async function draftBrief(sessionId: string): Promise<{
  key_message: string;
  target_audience: string;
  tone: string;
  cta_text: string;
}> {
  return apiClient.post(`/api/video-sessions/${sessionId}/brief/draft`, {});
}

export interface BriefImproveRequest {
  field: "key_message" | "target_audience" | "cta_text" | "video_brief";
  title: string;
  key_message: string;
  target_audience: string;
  tone: string;
  cta_text: string;
  video_brief: string;
}

export async function improveBriefField(
  sessionId: string,
  data: BriefImproveRequest
): Promise<{ value: string }> {
  return apiClient.post(`/api/video-sessions/${sessionId}/brief/improve`, data);
}
