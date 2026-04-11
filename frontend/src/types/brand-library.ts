export type LibraryItemStatus = "pending_review" | "approved" | "published" | "rejected";

export interface LibraryArtifact {
  id: string;
  name: string;
  type: string;
  thumbnail_url: string | null;
  product: string | null;
}

export interface LibraryPublisher {
  id: string;
  name: string;
}

export interface BrandLibraryItem {
  id: string;
  artifact: LibraryArtifact;
  published_by: LibraryPublisher;
  status: LibraryItemStatus;
  remix_count: number;
  published_at: string | null;
  created_at: string;
}

export interface BrandLibraryListResponse {
  items: BrandLibraryItem[];
  total: number;
  page: number;
  per_page: number;
}
