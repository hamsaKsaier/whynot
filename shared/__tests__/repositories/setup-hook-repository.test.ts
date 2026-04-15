import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { SetupHookRepository } from '../../database/repositories/setup-hook-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('SetupHookRepository', () => {
  const repo = new SetupHookRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts hook with JSON steps', async () => {
      const hook = { id: 'h1', name: 'Login' };
      mockQuery.mockResolvedValue([hook]);
      const steps = [{ action: 'navigate', target: 'https://example.com' }] as any;
      const result = await repo.create({ name: 'Login', level: 'global', steps });
      expect(result).toEqual(hook);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO setup_hooks'),
        ['Login', 'global', JSON.stringify(steps), true, null, null],
      );
    });

    it('passes optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      await repo.create({
        name: 'H',
        level: 'test_case',
        steps: [],
        enabled: false,
        test_case_id: 'tc1',
        folder_id: 'f1',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['H', 'test_case', '[]', false, 'tc1', 'f1'],
      );
    });
  });

  describe('findById', () => {
    it('returns hook when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      expect(await repo.findById('h1')).toEqual({ id: 'h1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByLevel', () => {
    it('returns hooks at specified level', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      const result = await repo.findByLevel('global');
      expect(result).toEqual([{ id: 'h1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('level = $1 AND enabled = true'),
        ['global'],
      );
    });

    it('returns empty array when table does not exist', async () => {
      const err: any = new Error('table not found');
      err.code = '42P01';
      mockQuery.mockRejectedValue(err);
      expect(await repo.findByLevel('global')).toEqual([]);
    });

    it('rethrows non-42P01 errors', async () => {
      mockQuery.mockRejectedValue(new Error('connection lost'));
      await expect(repo.findByLevel('global')).rejects.toThrow('connection lost');
    });
  });

  describe('findByTestCaseId', () => {
    it('returns hooks for test case', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      const result = await repo.findByTestCaseId('tc1');
      expect(result).toEqual([{ id: 'h1' }]);
    });

    it('returns empty array when table missing', async () => {
      const err: any = new Error();
      err.code = '42P01';
      mockQuery.mockRejectedValue(err);
      expect(await repo.findByTestCaseId('tc1')).toEqual([]);
    });
  });

  describe('findByFolderId', () => {
    it('returns hooks for folder', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      const result = await repo.findByFolderId('f1');
      expect(result).toEqual([{ id: 'h1' }]);
    });

    it('returns empty array when table missing', async () => {
      const err: any = new Error();
      err.code = '42P01';
      mockQuery.mockRejectedValue(err);
      expect(await repo.findByFolderId('f1')).toEqual([]);
    });
  });

  describe('findAllForTestCase', () => {
    it('returns hooks at all levels', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'h1', level: 'global' }])  // findByLevel('global')
        .mockResolvedValueOnce([{ id: 'h2', level: 'suite' }])   // findByFolderId
        .mockResolvedValueOnce([{ id: 'h3', level: 'test_case' }]); // findByTestCaseId
      const result = await repo.findAllForTestCase('tc1', 'f1');
      expect(result.global).toHaveLength(1);
      expect(result.suite).toHaveLength(1);
      expect(result.testCase).toHaveLength(1);
    });

    it('skips suite hooks when no folderId', async () => {
      mockQuery
        .mockResolvedValueOnce([])  // global
        .mockResolvedValueOnce([]); // test_case
      const result = await repo.findAllForTestCase('tc1');
      expect(result.suite).toEqual([]);
    });
  });

  describe('list', () => {
    it('returns hooks with pagination', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      const result = await repo.list(0, 10);
      expect(result).toEqual([{ id: 'h1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 0],
      );
    });
  });

  describe('update', () => {
    it('updates name and enabled', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      await repo.update('h1', { name: 'New', enabled: false });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE setup_hooks SET'),
        ['New', false, 'h1'],
      );
    });

    it('serializes steps as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      const steps = [{ action: 'click' }] as any;
      await repo.update('h1', { steps });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('steps = $'),
        [JSON.stringify(steps), 'h1'],
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'h1' }]);
      await repo.update('h1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['h1'],
      );
    });
  });

  describe('delete', () => {
    it('deletes and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('h1')).toBe(true);
    });
  });
});
