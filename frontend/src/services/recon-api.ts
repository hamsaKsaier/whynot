import { apiClient } from "./api";

export type ReconScanStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "stuck";

export type ReconSeverity = "low" | "medium" | "high" | "critical";

export type ReconEnvironmentTag = "production" | "staging" | "development";

export interface ReconSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ReconScanListItem {
  id: string;
  workspace_id: string;
  project_id: string;
  project_name: string;
  environment_id: string;
  environment_name: string;
  environment_tag: ReconEnvironmentTag;
  target_url: string;
  status: ReconScanStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_cost_credits: string;
  duration_seconds: number | null;
  severity_counts: ReconSeverityCounts;
}

export interface ListReconScansResponse {
  scans: ReconScanListItem[];
  next_cursor: string | null;
}

export type ReconListTab = "running" | "completed" | "failed" | "all";

export interface ListReconScansParams {
  tab?: ReconListTab;
  cursor?: string | null;
  project_ids?: string[];
  severities?: ReconSeverity[];
  limit?: number;
}

function serializeParams(params: ListReconScansParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (params.tab && params.tab !== "all") out.tab = params.tab;
  if (params.cursor) out.cursor = params.cursor;
  if (params.project_ids?.length) out.project_ids = params.project_ids.join(",");
  if (params.severities?.length) out.severities = params.severities.join(",");
  if (params.limit) out.limit = String(params.limit);
  return out;
}

export const listReconScans = async (
  params: ListReconScansParams = {},
): Promise<ListReconScansResponse> => {
  const response = await apiClient.get<ListReconScansResponse>("/recon/scans", {
    params: serializeParams(params),
  });
  return response.data;
};

export const cancelReconScan = async (id: string): Promise<void> => {
  await apiClient.post(`/recon/scans/${id}/cancel`);
};

export const resumeReconScan = async (
  id: string,
  targetUrl: string,
): Promise<void> => {
  await apiClient.post(`/recon/scans/${id}/resume`, {
    target_url: targetUrl,
  });
};

export interface ReconAuthorization {
  acknowledged: true;
  justification: string;
  acknowledged_by_user_id: string;
  acknowledged_at: string;
}

export interface CreateReconScanRequest {
  project_id: string;
  environment_id: string;
  target_url: string;
  authorization: ReconAuthorization;
  config_yaml?: string | null;
  allow_local_target?: boolean;
}

export interface CreateReconScanResponse {
  scan: { id: string };
}

export const createReconScan = async (
  payload: CreateReconScanRequest,
): Promise<CreateReconScanResponse> => {
  const response = await apiClient.post<CreateReconScanResponse>(
    "/recon/scans",
    payload,
  );
  return response.data;
};

export type ReconQuotaMode = "included" | "payg";

export interface ReconQuotaResponse {
  mode: ReconQuotaMode;
  remaining: number;
  cost_credits: string;
}

export const getReconQuota = async (): Promise<ReconQuotaResponse> => {
  const response = await apiClient.get<ReconQuotaResponse>(
    "/recon/quota",
  );
  return response.data;
};

export type ReconPhaseName =
  | "fingerprinting"
  | "discovery"
  | "vuln_analysis"
  | "exploitation"
  | "reporting";

export type ReconPhaseStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export interface ReconScanPhase {
  phase: ReconPhaseName;
  status: ReconPhaseStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

export interface ReconScanDetail extends ReconScanListItem {
  phases: ReconScanPhase[];
  authorization?: {
    justification: string;
    acknowledged_by_user_id: string;
    acknowledged_at: string;
  } | null;
}

export type ReconVulnClass =
  | "injection"
  | "xss"
  | "ssrf"
  | "auth"
  | "authz";

export interface ReconProofOfConcept {
  kind: "code" | "http" | "script";
  language: string;
  content: string;
  request?: string;
  response?: string;
}

export interface ReconFinding {
  id: string;
  scan_id: string;
  severity: ReconSeverity;
  vuln_class: ReconVulnClass;
  normalized_endpoint: string;
  description: string;
  proof_of_concept: ReconProofOfConcept | null;
  remediation_summary: string;
  confirmed_at: string | null;
}

export interface ListReconFindingsParams {
  severities?: ReconSeverity[];
  vuln_classes?: ReconVulnClass[];
  sort?: "severity" | "chronological";
}

export interface ReconScanArtifact {
  id: string;
  scan_id: string;
  phase: string;
  kind: string;
  size_bytes: number;
  created_at: string;
  download_url: string;
}

export const getReconScan = async (id: string): Promise<ReconScanDetail> => {
  const response = await apiClient.get<ReconScanDetail>(
    `/recon/scans/${id}`,
  );
  return response.data;
};

export const listReconFindings = async (
  id: string,
  params: ListReconFindingsParams = {},
): Promise<{ findings: ReconFinding[] }> => {
  const query: Record<string, string> = {};
  if (params.severities?.length) query.severities = params.severities.join(",");
  if (params.vuln_classes?.length)
    query.vuln_classes = params.vuln_classes.join(",");
  if (params.sort) query.sort = params.sort;
  const response = await apiClient.get<{ findings: ReconFinding[] }>(
    `/recon/scans/${id}/findings`,
    { params: query },
  );
  return response.data;
};

export const getReconReport = async (
  id: string,
): Promise<{ markdown: string }> => {
  const response = await apiClient.get<{ markdown: string }>(
    `/recon/scans/${id}/report`,
  );
  return response.data;
};

export const listReconArtifacts = async (
  id: string,
): Promise<{ artifacts: ReconScanArtifact[] }> => {
  const response = await apiClient.get<{ artifacts: ReconScanArtifact[] }>(
    `/recon/scans/${id}/artifacts`,
  );
  return response.data;
};

export const getReconReportPdfUrl = (id: string): string =>
  `/api/recon/scans/${id}/report.pdf`;
