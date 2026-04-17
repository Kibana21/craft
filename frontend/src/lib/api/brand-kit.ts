import { apiClient } from "@/lib/api-client";
import type {
  BrandKit,
  BrandKitTemplate,
  BrandKitVersionSummary,
  TemplateZone,
  UpdateBrandKitRequest,
} from "@/types/brand-kit";

export async function fetchBrandKit(): Promise<BrandKit> {
  return apiClient.get<BrandKit>("/api/brand-kit");
}

export async function updateBrandKit(data: UpdateBrandKitRequest): Promise<BrandKit> {
  return apiClient.patch<BrandKit>("/api/brand-kit", data);
}

export async function uploadLogo(file: File, variant: "primary" | "secondary"): Promise<BrandKit> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.upload<BrandKit>(`/api/brand-kit/logo?variant=${variant}`, formData);
}

export async function uploadFont(
  file: File,
  slot: "heading" | "body" | "disclaimer"
): Promise<BrandKit> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.upload<BrandKit>(`/api/brand-kit/font?slot=${slot}`, formData);
}

export async function fetchBrandKitVersions(): Promise<BrandKitVersionSummary[]> {
  return apiClient.get<BrandKitVersionSummary[]>("/api/brand-kit/versions");
}

export async function restoreBrandKitVersion(versionId: string): Promise<BrandKit> {
  return apiClient.post<BrandKit>(`/api/brand-kit/versions/${versionId}/restore`, {});
}

export async function fetchTemplates(): Promise<BrandKitTemplate[]> {
  return apiClient.get<BrandKitTemplate[]>("/api/brand-kit/templates");
}

export async function createTemplate(data: {
  name: string;
  layout_key: string;
  zones: TemplateZone[];
}): Promise<BrandKitTemplate> {
  return apiClient.post<BrandKitTemplate>("/api/brand-kit/templates", data);
}

export async function updateTemplate(
  id: string,
  data: { name?: string; zones?: TemplateZone[] },
): Promise<BrandKitTemplate> {
  return apiClient.patch<BrandKitTemplate>(`/api/brand-kit/templates/${id}`, data);
}

export async function deleteTemplate(id: string): Promise<void> {
  return apiClient.delete(`/api/brand-kit/templates/${id}`);
}
