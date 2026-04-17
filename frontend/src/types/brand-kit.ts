export interface FontsConfig {
  heading?: string;
  body?: string;
  disclaimer?: string;
  heading_url?: string;
  body_url?: string;
  disclaimer_url?: string;
  disclaimer_inherited?: boolean;
  size_scale?: Record<string, Record<string, number>>;
}

export type ZoneColorRole = "primary" | "secondary" | "accent" | "white";

export interface ZoneRoles {
  poster_background?: ZoneColorRole;
  cta_fill?: ZoneColorRole;
  disclaimer_strip?: ZoneColorRole;
  badge_callout?: ZoneColorRole;
  headline_text?: ZoneColorRole;
}

export interface ColorNames {
  primary_name?: string;
  secondary_name?: string;
  accent_name?: string;
  primary_usage?: string;
  secondary_usage?: string;
  accent_usage?: string;
}

export interface BrandKit {
  id: string;
  name: string;
  logo_url: string | null;
  secondary_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  fonts: FontsConfig | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
  is_active: boolean;
  changelog: string | null;
  activated_by_info: { id: string; name: string } | null;
  activated_at: string | null;
  color_names: ColorNames | null;
  zone_roles: ZoneRoles | null;
}

export interface UpdateBrandKitRequest {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  fonts?: FontsConfig;
  color_names?: ColorNames;
  zone_roles?: ZoneRoles;
  changelog?: string;
}

export interface BrandKitVersionSummary {
  id: string;
  version: number;
  name: string;
  changelog: string | null;
  activated_by_info: { id: string; name: string } | null;
  activated_at: string | null;
  is_active: boolean;
  created_at: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  secondary_logo_url: string | null;
  fonts: FontsConfig | null;
  color_names: ColorNames | null;
  zone_roles: ZoneRoles | null;
}

export interface TemplateZone {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrandKitTemplate {
  id: string;
  name: string;
  layout_key: string;
  zones: TemplateZone[];
  is_default: boolean;
}
