import { apiClient } from "@/lib/api-client";
import type { BrandLibraryListResponse } from "@/types/brand-library";

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
