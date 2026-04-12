import { apiClient } from "@/lib/api-client";
import type { Presenter, CreatePresenterData, UpdatePresenterData } from "@/types/presenter";

export async function fetchPresenters(): Promise<Presenter[]> {
  return apiClient.get<Presenter[]>("/api/presenters");
}

export async function fetchPresenter(id: string): Promise<Presenter> {
  return apiClient.get<Presenter>(`/api/presenters/${id}`);
}

export async function createPresenter(data: CreatePresenterData): Promise<Presenter> {
  return apiClient.post<Presenter>("/api/presenters", data);
}

export async function updatePresenter(id: string, data: UpdatePresenterData): Promise<Presenter> {
  return apiClient.patch<Presenter>(`/api/presenters/${id}`, data);
}

export async function deletePresenter(id: string): Promise<void> {
  return apiClient.delete(`/api/presenters/${id}`);
}

export async function generateAppearanceDescription(
  appearance_keywords: string,
  speaking_style: string
): Promise<string> {
  const res = await apiClient.post<{ full_appearance_description: string }>(
    "/api/presenters/generate-appearance",
    { appearance_keywords, speaking_style }
  );
  return res.full_appearance_description;
}

export async function suggestAppearanceKeywords(
  name: string,
  age_range: string,
  speaking_style: string
): Promise<string> {
  const res = await apiClient.post<{ appearance_keywords: string }>(
    "/api/presenters/suggest-keywords",
    { name, age_range, speaking_style }
  );
  return res.appearance_keywords;
}
