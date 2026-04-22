import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../api';
import {
  connectClickUp,
  getClickUpWorkspaces,
  getClickUpLists,
  saveClickUpConfig,
  getClickUpStatus,
  getGitHubStatus,
  getGitHubRepos,
  saveGitHubConfig,
  reportBug,
  reportAllBugs,
} from '../integrations-api';

describe('Integrations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ClickUp', () => {
    it('connectClickUp sends API token', async () => {
      const response = { success: true, username: 'user1' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await connectClickUp('token-123');
      expect(apiClient.post).toHaveBeenCalledWith('/integrations/clickup/connect', { apiToken: 'token-123' });
      expect(result).toEqual(response);
    });

    it('getClickUpWorkspaces fetches workspaces', async () => {
      const response = { workspaces: [{ id: '1', name: 'WS1' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getClickUpWorkspaces();
      expect(apiClient.get).toHaveBeenCalledWith('/integrations/clickup/workspaces');
      expect(result).toEqual(response);
    });

    it('getClickUpLists fetches lists for a workspace', async () => {
      const response = { lists: [{ id: '1', name: 'List1' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getClickUpLists('ws-1');
      expect(apiClient.get).toHaveBeenCalledWith('/integrations/clickup/lists/ws-1');
      expect(result).toEqual(response);
    });

    it('saveClickUpConfig saves configuration', async () => {
      const config = {
        workspaceId: 'ws-1',
        workspaceName: 'WS1',
        listId: 'list-1',
        listName: 'List1',
      };
      const response = { success: true };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await saveClickUpConfig(config);
      expect(apiClient.post).toHaveBeenCalledWith('/integrations/clickup/save-config', config);
      expect(result).toEqual(response);
    });

    it('getClickUpStatus fetches status', async () => {
      const response = { connected: true, username: 'user1' };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getClickUpStatus();
      expect(apiClient.get).toHaveBeenCalledWith('/integrations/clickup/status');
      expect(result).toEqual(response);
    });
  });

  describe('GitHub', () => {
    it('getGitHubStatus fetches status', async () => {
      const response = { connected: false, githubId: null };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getGitHubStatus();
      expect(apiClient.get).toHaveBeenCalledWith('/integrations/github/status');
      expect(result).toEqual(response);
    });

    it('getGitHubRepos fetches repos', async () => {
      const response = { repos: [{ id: '1', owner: 'user', repo: 'repo' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getGitHubRepos();
      expect(apiClient.get).toHaveBeenCalledWith('/integrations/github/repos');
      expect(result).toEqual(response);
    });

    it('saveGitHubConfig saves repo config', async () => {
      const config = { repoOwner: 'user', repoName: 'repo' };
      const response = { success: true };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await saveGitHubConfig(config);
      expect(apiClient.post).toHaveBeenCalledWith('/integrations/github/save-config', config);
      expect(result).toEqual(response);
    });
  });

  describe('Bug Reporting', () => {
    it('reportBug reports a single bug', async () => {
      const response = { success: true, provider: 'clickup', externalUrl: 'https://...' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await reportBug('bug-1', 'clickup');
      expect(apiClient.post).toHaveBeenCalledWith('/bugs/bug-1/report', { provider: 'clickup' });
      expect(result).toEqual(response);
    });

    it('reportAllBugs reports all session bugs', async () => {
      const response = { success: true, reported: 3, total: 3, results: [] };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await reportAllBugs('session-1', 'github');
      expect(apiClient.post).toHaveBeenCalledWith('/sessions/session-1/report-all', { provider: 'github' });
      expect(result).toEqual(response);
    });
  });
});
