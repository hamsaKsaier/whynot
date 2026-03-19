/**
 * integrations-api.ts
 *
 * Frontend API service for ClickUp + GitHub bug-reporting integrations.
 */

import { apiClient } from './api';

// ── ClickUp ───────────────────────────────────────────────────────────────────

export interface ClickUpWorkspace {
  id: string;
  name: string;
  color: string | null;
  avatar: string | null;
  members: number;
}

export interface ClickUpList {
  id: string;
  name: string;
  space: string;
  folder: string | null;
}

export interface ClickUpStatus {
  connected: boolean;
  username?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  listId?: string | null;
  listName?: string | null;
}

export async function connectClickUp(apiToken: string): Promise<{ success: boolean; username: string }> {
  const res = await apiClient.post('/integrations/clickup/connect', { apiToken });
  return res.data;
}

export async function getClickUpWorkspaces(): Promise<{ workspaces: ClickUpWorkspace[] }> {
  const res = await apiClient.get('/integrations/clickup/workspaces');
  return res.data;
}

export async function getClickUpLists(workspaceId: string): Promise<{ lists: ClickUpList[] }> {
  const res = await apiClient.get(`/integrations/clickup/lists/${workspaceId}`);
  return res.data;
}

export async function saveClickUpConfig(config: {
  workspaceId: string;
  workspaceName: string;
  listId: string;
  listName: string;
}): Promise<{ success: boolean }> {
  const res = await apiClient.post('/integrations/clickup/save-config', config);
  return res.data;
}

export async function getClickUpStatus(): Promise<ClickUpStatus> {
  const res = await apiClient.get('/integrations/clickup/status');
  return res.data;
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export interface GitHubStatus {
  connected: boolean;
  githubId: string | null;
  repoOwner: string | null;
  repoName: string | null;
  repoFullName: string | null;
}

export interface GitHubRepo {
  id: string;
  owner: string;
  repo: string;
  default_branch: string;
}

export async function getGitHubStatus(): Promise<GitHubStatus> {
  const res = await apiClient.get('/integrations/github/status');
  return res.data;
}

export async function getGitHubRepos(): Promise<{ repos: GitHubRepo[] }> {
  const res = await apiClient.get('/integrations/github/repos');
  return res.data;
}

export async function saveGitHubConfig(config: {
  repoOwner: string;
  repoName: string;
}): Promise<{ success: boolean }> {
  const res = await apiClient.post('/integrations/github/save-config', config);
  return res.data;
}

// ── Bug Reporting ─────────────────────────────────────────────────────────────

export type BugReportProvider = 'clickup' | 'github';

export interface ReportBugResult {
  success: boolean;
  provider: BugReportProvider;
  externalUrl: string;
}

export interface BatchReportResult {
  success: boolean;
  reported: number;
  total: number;
  results: Array<{
    bugId: string;
    success: boolean;
    externalUrl?: string;
    error?: string;
  }>;
}

export async function reportBug(bugId: string, provider: BugReportProvider): Promise<ReportBugResult> {
  const res = await apiClient.post(`/bugs/${bugId}/report`, { provider });
  return res.data;
}

export async function reportAllBugs(sessionId: string, provider: BugReportProvider): Promise<BatchReportResult> {
  const res = await apiClient.post(`/sessions/${sessionId}/report-all`, { provider });
  return res.data;
}
