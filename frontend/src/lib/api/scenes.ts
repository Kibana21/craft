import { apiClient } from "@/lib/api-client";
import type { Scene, SceneUpdateData, SceneInsertData } from "@/types/scene";

export async function updateScene(sceneId: string, data: SceneUpdateData): Promise<Scene> {
  return apiClient.patch<Scene>(`/api/scenes/${sceneId}`, data);
}

export async function deleteScene(sceneId: string): Promise<void> {
  return apiClient.delete(`/api/scenes/${sceneId}`);
}

export async function insertScene(sessionId: string, data: SceneInsertData): Promise<Scene> {
  return apiClient.post<Scene>(`/api/video-sessions/${sessionId}/scenes`, data);
}

export async function refineSceneDialogue(sceneId: string): Promise<string> {
  const res = await apiClient.post<{ dialogue: string }>(`/api/scenes/${sceneId}/refine-dialogue`, {});
  return res.dialogue;
}

export async function suggestSceneSetting(sceneId: string): Promise<string> {
  const res = await apiClient.post<{ setting: string }>(`/api/scenes/${sceneId}/suggest-setting`, {});
  return res.setting;
}
