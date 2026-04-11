import { apiClient } from "@/lib/api-client";
import type {
  ExportAspectRatio,
  ExportFormat,
  ExportResponse,
  ExportStatusResponse,
} from "@/types/export";

export async function exportArtifact(
  artifactId: string,
  format: ExportFormat,
  aspectRatio?: ExportAspectRatio
): Promise<ExportResponse> {
  return apiClient.post<ExportResponse>(`/api/artifacts/${artifactId}/export`, {
    format,
    aspect_ratio: aspectRatio ?? null,
  });
}

export async function checkExportStatus(exportId: string): Promise<ExportStatusResponse> {
  return apiClient.get<ExportStatusResponse>(`/api/exports/${exportId}/status`);
}

export function getDownloadUrl(exportId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${base}/api/exports/${exportId}/download`;
}
