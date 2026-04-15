import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { ProjectRepository } from '../../database/repositories/project-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ProjectRepository', () => {
  const repo = new ProjectRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts and returns the new project', async () => {
      const project = { id: 'p1', name: 'Proj' };
      mockQuery.mockResolvedValue([project]);
      const result = await repo.create({ name: 'Proj' });
      expect(result).toEqual(project);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['Proj', null, null, null],
      );
    });

    it('passes optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      await repo.create({ name: 'P', description: 'desc', website_url: 'http://x.com', workspace_id: 'ws1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['P', 'desc', 'http://x.com', 'ws1'],
      );
    });
  });

  describe('findById', () => {
    it('returns project when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      expect(await repo.findById('p1')).toEqual({ id: 'p1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByIdForWorkspace', () => {
    it('returns project scoped to workspace', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      const result = await repo.findByIdForWorkspace('p1', 'ws1');
      expect(result).toEqual({ id: 'p1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $2'),
        ['p1', 'ws1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByIdForWorkspace('p1', 'ws1')).toBeNull();
    });
  });

  describe('findByDomain', () => {
    it('returns project when domain matches', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', website_url: 'https://example.com/path' }]);
      const result = await repo.findByDomain('example.com', 'ws1');
      expect(result).toEqual({ id: 'p1', website_url: 'https://example.com/path' });
    });

    it('returns null when no matching domain', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByDomain('nope.com', 'ws1')).toBeNull();
    });

    it('skips rows with non-matching hostname', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', website_url: 'https://other.com/path' }]);
      expect(await repo.findByDomain('example.com', 'ws1')).toBeNull();
    });

    it('skips malformed URLs', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', website_url: 'not-a-url' }]);
      expect(await repo.findByDomain('example.com', 'ws1')).toBeNull();
    });
  });

  describe('list', () => {
    it('returns projects with workspace scope', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      const result = await repo.list(0, 50, 'ws1');
      expect(result).toEqual([{ id: 'p1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $1'),
        ['ws1', 50, 0],
      );
    });

    it('returns all projects without workspace scope', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      const result = await repo.list(0, 50);
      expect(result).toEqual([{ id: 'p1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [50, 0],
      );
    });
  });

  describe('count', () => {
    it('returns count scoped to workspace', async () => {
      mockQuery.mockResolvedValue([{ count: '5' }]);
      expect(await repo.count('ws1')).toBe(5);
    });

    it('returns total count without workspace', async () => {
      mockQuery.mockResolvedValue([{ count: '10' }]);
      expect(await repo.count()).toBe(10);
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', name: 'New' }]);
      const result = await repo.update('p1', { name: 'New' });
      expect(result).toEqual({ id: 'p1', name: 'New' });
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      await repo.update('p1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['p1'],
      );
    });

    it('serializes context as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      await repo.update('p1', { context: { key: 'val' } });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET'),
        [JSON.stringify({ key: 'val' }), 'p1'],
      );
    });

    it('returns null when project not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('p1')).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projects'),
        ['p1'],
      );
    });
  });

  describe('findByIdWithStats', () => {
    it('returns project with user_story_count as number', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', user_story_count: '3' }]);
      const result = await repo.findByIdWithStats('p1');
      expect(result).toEqual({ id: 'p1', user_story_count: 3 });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByIdWithStats('missing')).toBeNull();
    });

    it('scopes to workspace when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', user_story_count: '0' }]);
      await repo.findByIdWithStats('p1', 'ws1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $2'),
        ['p1', 'ws1'],
      );
    });
  });

  describe('listWithStats', () => {
    it('returns projects with parsed user_story_count', async () => {
      mockQuery.mockResolvedValue([
        { id: 'p1', user_story_count: '2' },
        { id: 'p2', user_story_count: '0' },
      ]);
      const result = await repo.listWithStats(0, 50, 'ws1');
      expect(result).toEqual([
        { id: 'p1', user_story_count: 2 },
        { id: 'p2', user_story_count: 0 },
      ]);
    });

    it('works without workspace scope', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.listWithStats();
      expect(result).toEqual([]);
    });
  });
});
