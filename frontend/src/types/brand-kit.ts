export interface FontsConfig {
  heading?: string;
  body?: string;
  accent?: string;
  heading_url?: string;
  body_url?: string;
  accent_url?: string;
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
}

export interface UpdateBrandKitRequest {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  fonts?: FontsConfig;
}
