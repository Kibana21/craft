export type ExportFormat = "png" | "jpg" | "mp4" | "pdf";
export type ExportAspectRatio = "1:1" | "4:5" | "9:16" | "800x800";
export type ExportStatus = "processing" | "ready" | "failed";

export interface ExportRequest {
  format: ExportFormat;
  aspect_ratio?: ExportAspectRatio;
}

export interface ExportResponse {
  export_id: string;
  status: ExportStatus;
}

export interface ExportStatusResponse {
  export_id: string;
  status: ExportStatus;
  download_url: string | null;
  format: string;
  aspect_ratio: string | null;
  exported_at: string;
}
