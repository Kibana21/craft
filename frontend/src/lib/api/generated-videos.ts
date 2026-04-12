import { apiClient } from "@/lib/api-client";

function backendBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" ? "" : "http://localhost:8000")
  );
}

/**
 * Direct URL to the video file via the static /uploads mount (no auth required).
 * Use this for <video src> and download links.
 * file_url looks like "/uploads/videos/<artifact_id>/v1.mp4"
 */
export function staticVideoUrl(fileUrl: string): string {
  return `${backendBase()}${fileUrl}`;
}

/**
 * Authenticated streaming endpoint — kept for cases where auth is needed.
 */
export function streamUrl(videoId: string): string {
  return `${backendBase()}/api/generated-videos/${videoId}/stream`;
}

/**
 * Delete a generated video (and cancel if in progress).
 * Returns void on success (204 No Content).
 */
export async function deleteVideo(videoId: string): Promise<void> {
  await apiClient.delete(`/api/generated-videos/${videoId}`);
}
