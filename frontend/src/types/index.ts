export type UserRole = "brand_admin" | "district_leader" | "agency_leader" | "fsc";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  agent_id: string | null;
}
