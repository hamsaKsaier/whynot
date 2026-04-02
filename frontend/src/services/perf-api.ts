/**
 * perf-api.ts
 *
 * API client for performance testing endpoints.
 */

import { apiClient } from './api';

export interface PerfRunConfig {
  projectId?: string;
  testType: 'smoke' | 'load' | 'stress' | 'spike';
  targetUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  config?: {
    vus?: number;
    duration?: string;
    stages?: Array<{ duration: string; target: number }>;
  };
  thresholds?: Record<string, string[]>;
  additionalRequests?: Array<{
    name: string;
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  }>;
}

export interface PerfRun {
  id: string;
  project_id: string | null;
  workspace_id: string;
  test_type: string;
  target_url: string;
  method: string;
  config: any;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  total_requests: number | null;
  failed_requests: number | null;
  avg_response_time_ms: number | null;
  p50_response_time_ms: number | null;
  p90_response_time_ms: number | null;
  p95_response_time_ms: number | null;
  p99_response_time_ms: number | null;
  max_response_time_ms: number | null;
  min_response_time_ms: number | null;
  requests_per_second: number | null;
  raw_metrics: any;
  created_at: string;
}

export interface StartPerfRunResponse {
  success: boolean;
  runId: string;
  testType: string;
  targetUrl: string;
  preset: string;
  wsPath: string;
}

export const startPerfRun = async (config: PerfRunConfig): Promise<StartPerfRunResponse> => {
  const response = await apiClient.post<StartPerfRunResponse>('/perf/run', config);
  return response.data;
};

export const stopPerfRun = async (runId: string): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<{ success: boolean; message: string }>(`/perf/stop/${runId}`);
  return response.data;
};

export const getPerfRuns = async (options?: {
  projectId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ runs: PerfRun[]; total: number }> => {
  const params: Record<string, any> = {};
  if (options?.projectId) params.projectId = options.projectId;
  if (options?.limit) params.limit = options.limit;
  if (options?.offset) params.offset = options.offset;

  const response = await apiClient.get<{ runs: PerfRun[]; total: number }>('/perf/runs', { params });
  return response.data;
};

export const getPerfRun = async (runId: string): Promise<{ run: PerfRun }> => {
  const response = await apiClient.get<{ run: PerfRun }>(`/perf/runs/${runId}`);
  return response.data;
};

export const getPerfPresets = async () => {
  const response = await apiClient.get('/perf/presets');
  return response.data;
};
