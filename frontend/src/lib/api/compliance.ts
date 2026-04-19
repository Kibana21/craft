import { apiClient } from "@/lib/api-client";

export interface ComplianceRule {
  id: string;
  rule_text: string;
  category: string;
  severity: "error" | "warning";
  is_active: boolean;
  created_at: string;
}

export interface ComplianceDocument {
  id: string;
  title: string;
  document_type: string;
  chunk_index: number;
  content_preview: string;
  source_document_id: string | null;
  file_url: string | null;
  original_filename: string | null;
  file_size: number | null;
  created_at: string;
}

export interface ComplianceDocumentDetail extends ComplianceDocument {
  content: string;
}

export interface ComplianceScore {
  score: number;
  breakdown: {
    rules: Array<{
      rule_id: string;
      rule_text: string;
      category: string;
      severity: string;
      passed: boolean;
      details: string | null;
    }>;
    disclaimers: Array<{
      disclaimer: string;
      present: boolean;
      required: boolean;
    }>;
    suggestions: string[];
  };
  suggestions: string[];
}

export async function fetchRules(activeOnly = false): Promise<ComplianceRule[]> {
  const params = activeOnly ? "?active_only=true" : "";
  return apiClient.get<ComplianceRule[]>(`/api/compliance/rules${params}`);
}

export async function createRule(data: {
  rule_text: string;
  category: string;
  severity: "error" | "warning";
}): Promise<ComplianceRule> {
  return apiClient.post<ComplianceRule>("/api/compliance/rules", data);
}

export async function updateRule(
  id: string,
  data: { rule_text?: string; category?: string; severity?: string; is_active?: boolean }
): Promise<ComplianceRule> {
  return apiClient.patch<ComplianceRule>(`/api/compliance/rules/${id}`, data);
}

export async function fetchDocuments(): Promise<ComplianceDocument[]> {
  return apiClient.get<ComplianceDocument[]>("/api/compliance/documents");
}

export async function uploadDocument(data: {
  title: string;
  content: string;
  document_type: string;
}): Promise<ComplianceDocument> {
  return apiClient.post<ComplianceDocument>("/api/compliance/documents", data);
}

export async function uploadDocumentFile(
  file: File,
  title: string,
  document_type: string,
): Promise<ComplianceDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("document_type", document_type);
  return apiClient.upload<ComplianceDocument>("/api/compliance/documents/upload-file", formData);
}

export async function fetchDocumentDetail(id: string): Promise<ComplianceDocumentDetail> {
  return apiClient.get<ComplianceDocumentDetail>(`/api/compliance/documents/${id}`);
}

export async function deleteDocument(id: string): Promise<void> {
  return apiClient.delete(`/api/compliance/documents/${id}`);
}

export async function suggestRule(category: string, hint?: string): Promise<{ rule_text: string }> {
  return apiClient.post<{ rule_text: string }>("/api/compliance/rules/suggest", { category, hint: hint || null });
}

export async function scoreArtifact(artifactId: string): Promise<ComplianceScore> {
  return apiClient.post<ComplianceScore>(`/api/compliance/score/${artifactId}`);
}

export async function fetchScoreBreakdown(artifactId: string): Promise<ComplianceScore> {
  return apiClient.get<ComplianceScore>(`/api/compliance/score/${artifactId}`);
}
