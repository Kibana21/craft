export type ScriptAction =
  | "draft"
  | "warm"
  | "professional"
  | "shorter"
  | "stronger_cta"
  | "manual";

export type RewriteTone = Extract<ScriptAction, "warm" | "professional" | "shorter" | "stronger_cta">;

export interface Script {
  id: string;
  video_session_id: string;
  content: string;
  word_count: number;
  estimated_duration_seconds: number;
  updated_at: string;
}

export interface ScriptVersion {
  id: string;
  video_session_id: string;
  action: ScriptAction;
  preview: string;
  created_at: string;
}
