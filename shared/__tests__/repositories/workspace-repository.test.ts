import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { WorkspaceRepository } from '../../database/repositories/workspace-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('WorkspaceRepository', () => {
  const repo = new WorkspaceRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts and returns the new workspace', async () => {
      const ws = { id: 'ws1', name: 'My Workspace', owner_id: 'u1' };
      mockQuery.mockResolvedValue([ws]);
      const result = await repo.create({ name: 'My Workspace', owner_id: 'u1' });
      expect(result).toEqual(ws);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workspaces'),
        ['My Workspace', 'u1'],
      );
    });
  });

  describe('findById', () => {
    it('returns workspace when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'ws1' }]);
      expect(await repo.findById('ws1')).toEqual({ id: 'ws1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findAllByUserId', () => {
    it('returns all workspaces for user', async () => {
      const workspaces = [{ id: 'ws1' }, { id: 'ws2' }];
      mockQuery.mockResolvedValue(workspaces);
      const result = await repo.findAllByUserId('u1');
      expect(result).toEqual(workspaces);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE owner_id = $1'),
        ['u1'],
      );
    });

    it('returns empty array when no workspaces', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findAllByUserId('u1')).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates name and returns workspace', async () => {
      const updated = { id: 'ws1', name: 'New Name' };
      mockQuery.mockResolvedValue([updated]);
      const result = await repo.update('ws1', 'New Name');
      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workspaces SET name'),
        ['New Name', 'ws1'],
      );
    });

    it('returns null when workspace not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', 'Name')).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes workspace and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.delete('ws1');
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM workspaces'),
        ['ws1'],
      );
    });
  });

  describe('countByUserId', () => {
    it('returns count of workspaces for user', async () => {
      mockQuery.mockResolvedValue([{ count: '3' }]);
      expect(await repo.countByUserId('u1')).toBe(3);
    });

    it('returns 0 when no workspaces', async () => {
      mockQuery.mockResolvedValue([{}]);
      expect(await repo.countByUserId('u1')).toBe(0);
    });
  });
});
