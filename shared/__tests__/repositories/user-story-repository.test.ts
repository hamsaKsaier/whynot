import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { UserStoryRepository } from '../../database/repositories/user-story-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('UserStoryRepository', () => {
  const repo = new UserStoryRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts user story with defaults', async () => {
      const story = { id: 'us1' };
      mockQuery.mockResolvedValue([story]);
      const result = await repo.create({ project_id: 'p1', story: 'As a user...' });
      expect(result).toEqual(story);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_stories'),
        ['p1', 'As a user...', null, null, null],
      );
    });

    it('passes all optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }]);
      await repo.create({
        project_id: 'p1',
        story: 'Story',
        website_url: 'https://x.com',
        additional_context: 'context',
        workspace_id: 'ws1',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['p1', 'Story', 'https://x.com', 'context', 'ws1'],
      );
    });
  });

  describe('findById', () => {
    it('returns story when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }]);
      expect(await repo.findById('us1')).toEqual({ id: 'us1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByProjectId', () => {
    it('returns stories for project', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }, { id: 'us2' }]);
      const result = await repo.findByProjectId('p1');
      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('project_id = $1'),
        ['p1', 100, 0],
      );
    });

    it('uses custom offset and limit', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.findByProjectId('p1', 10, 25);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['p1', 25, 10],
      );
    });
  });

  describe('countByProjectId', () => {
    it('returns count', async () => {
      mockQuery.mockResolvedValue([{ count: '15' }]);
      expect(await repo.countByProjectId('p1')).toBe(15);
    });

    it('returns 0 when no stories', async () => {
      mockQuery.mockResolvedValue([{}]);
      expect(await repo.countByProjectId('p1')).toBe(0);
    });
  });

  describe('update', () => {
    it('updates story text', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }]);
      await repo.update('us1', { story: 'Updated story' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stories SET'),
        ['Updated story', 'us1'],
      );
    });

    it('updates multiple fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }]);
      await repo.update('us1', {
        story: 'S',
        website_url: 'https://x.com',
        additional_context: 'ctx',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stories SET'),
        ['S', 'https://x.com', 'ctx', 'us1'],
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }]);
      await repo.update('us1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['us1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { story: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('us1')).toBe(true);
    });
  });

  describe('findByIdWithStats', () => {
    it('returns story with test_case_count as number', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1', test_case_count: '5' }]);
      const result = await repo.findByIdWithStats('us1');
      expect(result).toEqual({ id: 'us1', test_case_count: 5 });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByIdWithStats('missing')).toBeNull();
    });
  });

  describe('findByProjectIdWithStats', () => {
    it('returns stories with parsed test_case_count', async () => {
      mockQuery.mockResolvedValue([
        { id: 'us1', test_case_count: '3' },
        { id: 'us2', test_case_count: '0' },
      ]);
      const result = await repo.findByProjectIdWithStats('p1');
      expect(result).toEqual([
        { id: 'us1', test_case_count: 3 },
        { id: 'us2', test_case_count: 0 },
      ]);
    });
  });
});
