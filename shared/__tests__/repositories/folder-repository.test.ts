import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { FolderRepository } from '../../database/repositories/folder-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('FolderRepository', () => {
  const repo = new FolderRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts folder with default color', async () => {
      const folder = { id: 'f1', name: 'Folder' };
      mockQuery.mockResolvedValue([folder]);
      const result = await repo.create({ project_id: 'p1', name: 'Folder' });
      expect(result).toEqual(folder);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_story_folders'),
        ['p1', 'Folder', '#0284c7'],
      );
    });

    it('uses provided color', async () => {
      mockQuery.mockResolvedValue([{ id: 'f1' }]);
      await repo.create({ project_id: 'p1', name: 'F', color: '#ff0000' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_story_folders'),
        ['p1', 'F', '#ff0000'],
      );
    });
  });

  describe('findById', () => {
    it('returns folder when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'f1' }]);
      expect(await repo.findById('f1')).toEqual({ id: 'f1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('listByProject', () => {
    it('returns folders for project', async () => {
      mockQuery.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
      const result = await repo.listByProject('p1');
      expect(result).toHaveLength(2);
    });
  });

  describe('listByProjectWithStats', () => {
    it('returns folders with parsed user_story_count', async () => {
      mockQuery.mockResolvedValue([
        { id: 'f1', user_story_count: '5' },
        { id: 'f2', user_story_count: '0' },
      ]);
      const result = await repo.listByProjectWithStats('p1');
      expect(result[0].user_story_count).toBe(5);
      expect(result[1].user_story_count).toBe(0);
    });
  });

  describe('update', () => {
    it('updates name', async () => {
      mockQuery.mockResolvedValue([{ id: 'f1', name: 'New' }]);
      const result = await repo.update('f1', { name: 'New' });
      expect(result).toEqual({ id: 'f1', name: 'New' });
    });

    it('updates color', async () => {
      mockQuery.mockResolvedValue([{ id: 'f1' }]);
      await repo.update('f1', { color: '#000' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('color = $'),
        ['#000', 'f1'],
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'f1' }]);
      await repo.update('f1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['f1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('f1')).toBe(true);
    });
  });

  describe('assignUserStoryToFolder', () => {
    it('assigns story to folder', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.assignUserStoryToFolder('us1', 'f1');
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stories SET folder_id'),
        ['f1', 'us1'],
      );
    });

    it('unassigns story when null', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.assignUserStoryToFolder('us1', null);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stories SET folder_id'),
        [null, 'us1'],
      );
    });
  });

  describe('getUserStoriesInFolder', () => {
    it('returns story IDs', async () => {
      mockQuery.mockResolvedValue([{ id: 'us1' }, { id: 'us2' }]);
      const result = await repo.getUserStoriesInFolder('f1');
      expect(result).toEqual(['us1', 'us2']);
    });

    it('returns empty array when no stories', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getUserStoriesInFolder('f1')).toEqual([]);
    });
  });
});
