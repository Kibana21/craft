export type ArtifactType = "poster" | "whatsapp_card" | "reel" | "story" | "video" | "deck" | "infographic" | "slide_deck";
export type ArtifactChannel = "instagram" | "whatsapp" | "print" | "social" | "internal";
export type ArtifactFormat = "1:1" | "4:5" | "9:16" | "A4" | "800x800";
export type ArtifactStatus = "draft" | "ready" | "exported";

export interface ArtifactCreator {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface Artifact {
  id: string;
  project_id: string;
  creator: ArtifactCreator;
  type: ArtifactType;
  name: string;
  channel: ArtifactChannel | null;
  format: ArtifactFormat | null;
  thumbnail_url: string | null;
  compliance_score: number | null;
  status: ArtifactStatus;
  version: number;
  created_at: string;
}

export interface ArtifactDetail extends Artifact {
  content: Record<string, unknown> | null;
  locks: string[] | null;
  video_session_id: string | null;
}

export interface ArtifactListResponse {
  items: Artifact[];
  total: number;
  page: number;
  per_page: number;
}
