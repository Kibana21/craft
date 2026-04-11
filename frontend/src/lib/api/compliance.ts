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
  created_at: string;
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

export async function deleteDocument(id: string): Promise<void> {
  return apiClient.delete(`/api/compliance/documents/${id}`);
}

export async function scoreArtifact(artifactId: string): Promise<ComplianceScore> {
  return apiClient.post<ComplianceScore>(`/api/compliance/score/${artifactId}`);
}

export async function fetchScoreBreakdown(artifactId: string): Promise<ComplianceScore> {
  return apiClient.get<ComplianceScore>(`/api/compliance/score/${artifactId}`);
}
