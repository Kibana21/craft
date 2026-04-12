export type SpeakingStyle = "authoritative" | "conversational" | "enthusiastic" | "empathetic";

export interface Presenter {
  id: string;
  name: string;
  age_range: string;
  appearance_keywords: string;
  full_appearance_description: string;
  speaking_style: SpeakingStyle;
  is_library: boolean;
  created_by_id: string;
  created_at: string;
}

export interface CreatePresenterData {
  name: string;
  age_range: string;
  appearance_keywords: string;
  full_appearance_description: string;
  speaking_style: SpeakingStyle;
  is_library?: boolean;
}

export interface UpdatePresenterData {
  name?: string;
  age_range?: string;
  appearance_keywords?: string;
  full_appearance_description?: string;
  speaking_style?: SpeakingStyle;
  is_library?: boolean;
}

export interface VideoSession {
  id: string;
  artifact_id: string;
  current_step: "presenter" | "script" | "storyboard" | "generation";
  target_duration_seconds: number;
  presenter_id: string | null;
  created_at: string;
}

export interface AssignPresenterData {
  // Library path
  presenter_id?: string;
  // Inline-create path
  name?: string;
  age_range?: string;
  appearance_keywords?: string;
  full_appearance_description?: string;
  speaking_style?: SpeakingStyle;
  save_to_library?: boolean;
}
