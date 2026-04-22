import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { IntegrationRepository } from '../../database/repositories/integration-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('IntegrationRepository', () => {
  const repo = new IntegrationRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts integration with JSON config', async () => {
      const integration = { id: 'i1', type: 'jira' };
      mockQuery.mockResolvedValue([integration]);
      const result = await repo.create({
        workspace_id: 'ws1',
        type: 'jira',
        name: 'My Jira',
        config: { url: 'https://jira.example.com' },
      });
      expect(result).toEqual(integration);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO integrations'),
        ['ws1', 'jira', 'My Jira', JSON.stringify({ url: 'https://jira.example.com' })],
      );
    });
  });

  describe('findById', () => {
    it('returns integration when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'i1' }]);
      expect(await repo.findById('i1')).toEqual({ id: 'i1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByWorkspace', () => {
    it('returns integrations for workspace', async () => {
      mockQuery.mockResolvedValue([{ id: 'i1' }]);
      const result = await repo.findByWorkspace('ws1');
      expect(result).toEqual([{ id: 'i1' }]);
    });
  });

  describe('update', () => {
    it('updates name', async () => {
      mockQuery.mockResolvedValue([{ id: 'i1', name: 'New' }]);
      const result = await repo.update('i1', { name: 'New' });
      expect(result).toEqual({ id: 'i1', name: 'New' });
    });

    it('serializes config as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'i1' }]);
      await repo.update('i1', { config: { key: 'val' } });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE integrations SET'),
        expect.arrayContaining([JSON.stringify({ key: 'val' })]),
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'i1' }]);
      await repo.update('i1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['i1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue([{ id: 'i1' }]);
      expect(await repo.delete('i1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('missing')).toBe(false);
    });
  });

  describe('createBugTask', () => {
    it('inserts bug task and returns it', async () => {
      const task = { id: 'bt1', bug_id: 'b1' };
      mockQuery.mockResolvedValue([task]);
      const result = await repo.createBugTask({
        bug_id: 'b1',
        integration_id: 'i1',
        external_id: 'ext1',
      });
      expect(result).toEqual(task);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO bug_tasks'),
        ['b1', 'i1', 'ext1', null],
      );
    });

    it('passes external_url when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'bt1' }]);
      await repo.createBugTask({
        bug_id: 'b1',
        integration_id: 'i1',
        external_id: 'ext1',
        external_url: 'https://jira.example.com/issue/123',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['b1', 'i1', 'ext1', 'https://jira.example.com/issue/123'],
      );
    });
  });

  describe('findBugTasks', () => {
    it('returns bug tasks with join data', async () => {
      mockQuery.mockResolvedValue([{ id: 'bt1', integration_type: 'jira' }]);
      const result = await repo.findBugTasks('b1');
      expect(result).toEqual([{ id: 'bt1', integration_type: 'jira' }]);
    });
  });

  describe('findBugTasksBySession', () => {
    it('returns bug tasks for session with joins', async () => {
      mockQuery.mockResolvedValue([{ id: 'bt1' }]);
      const result = await repo.findBugTasksBySession('s1');
      expect(result).toEqual([{ id: 'bt1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('JOIN qa_loop_bugs'),
        ['s1'],
      );
    });
  });
});
