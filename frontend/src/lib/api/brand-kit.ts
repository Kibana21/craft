import { apiClient } from "@/lib/api-client";
import type { BrandKit, UpdateBrandKitRequest } from "@/types/brand-kit";

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
  slot: "heading" | "body" | "accent"
): Promise<BrandKit> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.upload<BrandKit>(`/api/brand-kit/font?slot=${slot}`, formData);
}
