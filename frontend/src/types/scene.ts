export type CameraFraming =
  | "wide_shot"
  | "medium_shot"
  | "close_up"
  | "over_the_shoulder"
  | "two_shot"
  | "aerial"
  | "pov";

export interface Scene {
  id: string;
  video_session_id: string;
  sequence: number;
  name: string;
  dialogue: string;
  setting: string;
  camera_framing: CameraFraming;
  merged_prompt_present: boolean;
  created_at: string;
  updated_at: string;
}

export interface SceneListResponse {
  scenes: Scene[];
  scenes_script_version_id: string | null;
  current_script_version_id: string | null;
}

export interface SceneInsertData {
  position: number;
  name: string;
  dialogue: string;
  setting: string;
  camera_framing: CameraFraming;
}

export interface SceneUpdateData {
  name?: string;
  dialogue?: string;
  setting?: string;
  camera_framing?: CameraFraming;
}
