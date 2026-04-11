import { apiClient } from "@/lib/api-client";
import type { BrandLibraryListResponse, BrandLibraryItem } from "@/types/brand-library";

export interface BrandLibraryDetailItem extends BrandLibraryItem {
  artifact: BrandLibraryItem["artifact"] & {
    content: Record<string, unknown> | null;
    compliance_score: number | null;
  };
  rejection_reason: string | null;
}

export async function fetchLibraryItems(
  filters?: { search?: string; product?: string },
  page = 1,
  perPage = 20
): Promise<BrandLibraryListResponse> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.product) params.set("product", filters.product);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  return apiClient.get<BrandLibraryListResponse>(`/api/brand-library?${params}`);
}

export async function fetchLibraryItemDetail(
  id: string
): Promise<BrandLibraryDetailItem> {
  return apiClient.get<BrandLibraryDetailItem>(`/api/brand-library/${id}`);
}

export async function publishToLibrary(
  artifactId: string
): Promise<BrandLibraryDetailItem> {
  return apiClient.post<BrandLibraryDetailItem>("/api/brand-library", {
    artifact_id: artifactId,
  });
}

export async function reviewLibraryItem(
  id: string,
  action: "approve" | "reject" | "unpublish",
  reason?: string
): Promise<BrandLibraryDetailItem> {
  return apiClient.patch<BrandLibraryDetailItem>(`/api/brand-library/${id}`, {
    action,
    reason,
  });
}

export async function remixLibraryItem(
  id: string
): Promise<{ project_id: string; artifact_id: string }> {
  return apiClient.post<{ project_id: string; artifact_id: string }>(
    `/api/brand-library/${id}/remix`
  );
}
