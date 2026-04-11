export interface GenerateTaglinesRequest {
  product: string;
  audience: string;
  tone: string;
  count?: number;
}

export interface GenerateTaglinesResponse {
  taglines: string[];
}

export interface GenerateImageRequest {
  prompt_context: string;
  artifact_type: string;
  tone: string;
  style?: string;
  aspect_ratio: string;
}

export interface GenerateImageResponse {
  image_url: string;
  prompt_used: string;
}

export interface StoryboardFrame {
  frame_number: number;
  duration_seconds: number;
  text_overlay: string;
  visual_description: string;
  transition: string;
}

export interface GenerateStoryboardResponse {
  frames: StoryboardFrame[];
}
