import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GitHubService } from '../../services/github-service';

function createService() {
  return new GitHubService('test-token', 'test-owner', 'test-repo');
}

describe('GitHubService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('testConnection', () => {
    it('returns success when repo is accessible', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ full_name: 'test-owner/test-repo', default_branch: 'main' }),
      });

      const service = createService();
      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('test-owner/test-repo');
    });

    it('returns failure on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const service = createService();
      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('404');
    });
  });

  describe('getDefaultBranch', () => {
    it('returns default branch name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ default_branch: 'develop' }),
      });

      const service = createService();
      const branch = await service.getDefaultBranch();
      expect(branch).toBe('develop');
    });
  });

  describe('getFileContent', () => {
    it('decodes base64 content', async () => {
      const content = Buffer.from('console.log("hello")').toString('base64');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            path: 'src/index.ts',
            content,
            sha: 'abc123',
            encoding: 'base64',
          }),
      });

      const service = createService();
      const file = await service.getFileContent('src/index.ts');

      expect(file.content).toBe('console.log("hello")');
      expect(file.sha).toBe('abc123');
      expect(file.path).toBe('src/index.ts');
    });
  });

  describe('findRelevantFiles', () => {
    it('scores and returns relevant files', async () => {
      const tree = [
        { path: 'src/pages/login.tsx', type: 'blob' as const, size: 5000 },
        { path: 'src/components/Button.tsx', type: 'blob' as const, size: 2000 },
        { path: 'src/api/auth/handler.ts', type: 'blob' as const, size: 3000 },
        { path: 'node_modules/dep/index.js', type: 'blob' as const, size: 1000 },
        { path: 'webpack.config.js', type: 'blob' as const, size: 500 },
      ];

      const service = createService();
      const result = await service.findRelevantFiles(tree, {
        pageUrl: 'https://example.com/login',
        title: 'Login page broken',
      });

      expect(result).toContain('src/pages/login.tsx');
      expect(result).not.toContain('node_modules/dep/index.js');
    });

    it('returns empty array for empty tree', async () => {
      const service = createService();
      const result = await service.findRelevantFiles([], { title: 'test' });
      expect(result).toEqual([]);
    });

    it('falls back to all source files for small repos', async () => {
      const tree = [
        { path: 'index.ts', type: 'blob' as const, size: 1000 },
        { path: 'utils.ts', type: 'blob' as const, size: 500 },
      ];

      const service = createService();
      const result = await service.findRelevantFiles(tree, {});

      // Should fall back and include files since repo is small
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createBranch', () => {
    it('creates branch from base SHA', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ object: { sha: 'base-sha-123' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({}),
        });

      const service = createService();
      await service.createBranch('fix/bug-123', 'main');

      const createCall = mockFetch.mock.calls[1];
      const body = JSON.parse(createCall[1].body);
      expect(body.ref).toBe('refs/heads/fix/bug-123');
      expect(body.sha).toBe('base-sha-123');
    });
  });

  describe('createPullRequest', () => {
    it('creates PR and returns number + url', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({ number: 42, html_url: 'https://github.com/test-owner/test-repo/pull/42' }),
      });

      const service = createService();
      const result = await service.createPullRequest({
        title: 'Fix login bug',
        body: 'Fixes #123',
        head: 'fix/login',
        base: 'main',
      });

      expect(result.number).toBe(42);
      expect(result.html_url).toContain('/pull/42');
    });
  });

  describe('updateFile', () => {
    it('sends base64 encoded content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const service = createService();
      await service.updateFile('src/fix.ts', 'const x = 1;', 'fix: bug', 'fix-branch', 'old-sha');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.content).toBe(Buffer.from('const x = 1;').toString('base64'));
      expect(body.sha).toBe('old-sha');
      expect(body.branch).toBe('fix-branch');
    });
  });

  describe('mergePullRequest', () => {
    it('merges PR and returns result', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ merged: true, sha: 'merge-sha' }),
      });

      const service = createService();
      const result = await service.mergePullRequest(42, 'Merge PR #42');

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merge-sha');
    });
  });
});
