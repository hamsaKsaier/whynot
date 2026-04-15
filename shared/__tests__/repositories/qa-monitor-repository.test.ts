import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { QAMonitorRepository } from '../../database/repositories/qa-monitor-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('QAMonitorRepository', () => {
  const repo = new QAMonitorRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts monitor with defaults', async () => {
      const monitor = { id: 'm1' };
      mockQuery.mockResolvedValue([monitor]);
      const result = await repo.create({
        workspace_id: 'ws1',
        name: 'Monitor',
        target_url: 'https://example.com',
        cron_expression: '0 */6 * * *',
      });
      expect(result).toEqual(monitor);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO qa_monitors'),
        ['ws1', 'Monitor', 'https://example.com', '0 */6 * * *', 80, 5, true, true, null, null],
      );
    });

    it('passes custom thresholds and credentials', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      await repo.create({
        workspace_id: 'ws1',
        name: 'M',
        target_url: 'https://x.com',
        cron_expression: '* * * * *',
        quality_threshold: 90,
        max_iterations: 10,
        notify_on_failure: false,
        notify_on_regression: false,
        login_credentials: { user: 'admin', pass: 'pass' },
        document_context: 'context',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([90, 10, false, false, JSON.stringify({ user: 'admin', pass: 'pass' }), 'context']),
      );
    });
  });

  describe('findById', () => {
    it('returns monitor when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      expect(await repo.findById('m1')).toEqual({ id: 'm1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByWorkspace', () => {
    it('returns monitors for workspace', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      const result = await repo.findByWorkspace('ws1');
      expect(result).toEqual([{ id: 'm1' }]);
    });
  });

  describe('update', () => {
    it('updates allowed fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1', name: 'New' }]);
      const result = await repo.update('m1', { name: 'New' });
      expect(result).toEqual({ id: 'm1', name: 'New' });
    });

    it('serializes login_credentials as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      await repo.update('m1', { login_credentials: { user: 'test' } } as any);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE qa_monitors SET'),
        expect.arrayContaining([JSON.stringify({ user: 'test' })]),
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      await repo.update('m1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['m1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      expect(await repo.delete('m1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('missing')).toBe(false);
    });
  });

  describe('findDueMonitors', () => {
    it('returns monitors due to run', async () => {
      mockQuery.mockResolvedValue([{ id: 'm1' }]);
      const result = await repo.findDueMonitors();
      expect(result).toEqual([{ id: 'm1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_enabled = true'),
        [],
      );
    });
  });

  describe('getHistory', () => {
    it('returns session history for monitor', async () => {
      mockQuery.mockResolvedValue([{ id: 's1' }]);
      const result = await repo.getHistory('m1');
      expect(result).toEqual([{ id: 's1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('qa_loop_sessions'),
        ['m1', 10],
      );
    });

    it('uses custom limit', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.getHistory('m1', 5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['m1', 5],
      );
    });
  });
});
