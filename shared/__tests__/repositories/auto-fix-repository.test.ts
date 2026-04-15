import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { AutoFixRepository } from '../../database/repositories/auto-fix-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('AutoFixRepository', () => {
  const repo = new AutoFixRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ─── GitHub Repos ───

  describe('createRepo', () => {
    it('inserts or updates repo on conflict and returns it', async () => {
      const ghRepo = { id: 'r1', owner: 'owner', repo: 'repo' };
      mockQuery.mockResolvedValue([ghRepo]);
      const result = await repo.createRepo({
        workspace_id: 'ws1',
        owner: 'owner',
        repo: 'repo',
      });
      expect(result).toEqual(ghRepo);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO github_repos'),
        ['ws1', 'owner', 'repo', 'main', null],
      );
    });

    it('passes optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'r1' }]);
      await repo.createRepo({
        workspace_id: 'ws1',
        owner: 'o',
        repo: 'r',
        default_branch: 'dev',
        access_token: 'tok',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['ws1', 'o', 'r', 'dev', 'tok'],
      );
    });
  });

  describe('findRepoById', () => {
    it('returns repo when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'r1' }]);
      expect(await repo.findRepoById('r1')).toEqual({ id: 'r1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findRepoById('missing')).toBeNull();
    });
  });

  describe('findReposByWorkspace', () => {
    it('returns repos for workspace', async () => {
      mockQuery.mockResolvedValue([{ id: 'r1' }]);
      const result = await repo.findReposByWorkspace('ws1');
      expect(result).toEqual([{ id: 'r1' }]);
    });
  });

  describe('deleteRepo', () => {
    it('returns true when repo deleted', async () => {
      mockQuery.mockResolvedValue([{ id: 'r1' }]);
      expect(await repo.deleteRepo('r1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.deleteRepo('missing')).toBe(false);
    });
  });

  // ─── Auto Fix Attempts ───

  describe('createAttempt', () => {
    it('inserts attempt with pending status', async () => {
      const attempt = { id: 'a1', bug_id: 'b1', status: 'pending' };
      mockQuery.mockResolvedValue([attempt]);
      const result = await repo.createAttempt({ bug_id: 'b1', github_repo_id: 'r1' });
      expect(result).toEqual(attempt);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'pending'"),
        ['b1', 'r1'],
      );
    });
  });

  describe('updateAttempt', () => {
    it('updates allowed fields and returns attempt', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1', status: 'analyzing' }]);
      const result = await repo.updateAttempt('a1', { status: 'analyzing' });
      expect(result).toEqual({ id: 'a1', status: 'analyzing' });
    });

    it('falls back to findAttemptById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1' }]);
      await repo.updateAttempt('a1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['a1'],
      );
    });

    it('serializes relevant_files as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1' }]);
      await repo.updateAttempt('a1', { relevant_files: ['file.ts'] } as any);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auto_fix_attempts SET'),
        expect.arrayContaining([JSON.stringify(['file.ts'])]),
      );
    });

    it('returns null when attempt not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateAttempt('missing', { status: 'failed' })).toBeNull();
    });
  });

  describe('findAttemptById', () => {
    it('returns attempt when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1' }]);
      expect(await repo.findAttemptById('a1')).toEqual({ id: 'a1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findAttemptById('missing')).toBeNull();
    });
  });

  describe('findAttemptsByBug', () => {
    it('returns attempts for a bug', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      const result = await repo.findAttemptsByBug('b1');
      expect(result).toHaveLength(2);
    });
  });

  describe('findActiveAttemptBySession', () => {
    it('returns active attempt for session', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1', status: 'retesting' }]);
      expect(await repo.findActiveAttemptBySession('s1')).toEqual({ id: 'a1', status: 'retesting' });
    });

    it('returns null when no active attempt', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findActiveAttemptBySession('s1')).toBeNull();
    });
  });

  describe('findLatestAttemptForBug', () => {
    it('returns latest attempt', async () => {
      mockQuery.mockResolvedValue([{ id: 'a1' }]);
      expect(await repo.findLatestAttemptForBug('b1')).toEqual({ id: 'a1' });
    });

    it('returns null when no attempts', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findLatestAttemptForBug('b1')).toBeNull();
    });
  });
});
