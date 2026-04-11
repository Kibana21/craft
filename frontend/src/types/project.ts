export type ProjectType = "personal" | "team";
export type ProjectPurpose = "product_launch" | "campaign" | "seasonal" | "agent_enablement";

export interface ProjectOwner {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  purpose: ProjectPurpose;
  owner: ProjectOwner;
  product: string | null;
  target_audience: string | null;
  campaign_period: string | null;
  key_message: string | null;
  status: string;
  artifact_count: number;
  member_count: number;
  created_at: string;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  per_page: number;
}
