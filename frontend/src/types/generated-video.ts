export type VideoStatus = "queued" | "rendering" | "ready" | "failed";

export interface GeneratedVideo {
  id: string;
  video_session_id: string;
  version: number;
  status: VideoStatus;
  progress_percent: number;
  current_scene: number | null;
  file_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GeneratedVideoListResponse {
  videos: GeneratedVideo[];
  any_active: boolean;
}
