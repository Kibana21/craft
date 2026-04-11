import { apiClient } from "@/lib/api-client";
import type { GenerateTaglinesResponse, GenerateImageResponse, GenerateStoryboardResponse } from "@/types/ai";

export async function generateTaglines(
  product: string,
  audience: string,
  tone: string,
  count = 5
): Promise<string[]> {
  const res = await apiClient.post<GenerateTaglinesResponse>("/api/ai/generate-taglines", {
    product,
    audience,
    tone,
    count,
  });
  return res.taglines;
}

export async function generateImage(
  promptContext: string,
  artifactType: string,
  tone: string,
  aspectRatio: string
): Promise<GenerateImageResponse> {
  return apiClient.post<GenerateImageResponse>("/api/ai/generate-image", {
    prompt_context: promptContext,
    artifact_type: artifactType,
    tone,
    aspect_ratio: aspectRatio,
  });
}

export async function generateStoryboard(
  topic: string,
  keyMessage: string,
  product: string,
  tone: string
): Promise<GenerateStoryboardResponse> {
  return apiClient.post<GenerateStoryboardResponse>("/api/ai/generate-storyboard", {
    topic,
    key_message: keyMessage,
    product,
    tone,
  });
}
