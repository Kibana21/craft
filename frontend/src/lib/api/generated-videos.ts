import { apiClient } from "@/lib/api-client";

/**
 * Returns the URL used for streaming/playing a video.
 * The backend streams with Range support, so this URL works both as
 * the HTML5 <video src> and as a download href.
 */
export function streamUrl(videoId: string): string {
  // Point directly at the backend — Next.js does not proxy binary streams
  const base =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" ? "" : "http://localhost:8000");
  return `${base}/api/generated-videos/${videoId}/stream`;
}

/**
 * Delete a generated video (and cancel if in progress).
 * Returns void on success (204 No Content).
 */
export async function deleteVideo(videoId: string): Promise<void> {
  await apiClient.delete(`/api/generated-videos/${videoId}`);
}
