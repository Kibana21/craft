export type SuggestionAudience = "internal" | "external" | "both";

export interface ArtifactSuggestion {
  id: string;
  artifact_type: string;
  artifact_name: string;
  description: string | null;
  audience: SuggestionAudience;
  selected: boolean;
  created_at: string;
}
