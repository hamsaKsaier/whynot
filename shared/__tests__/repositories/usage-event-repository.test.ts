import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { UsageEventRepository } from '../../database/repositories/usage-event-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('UsageEventRepository', () => {
  const repo = new UsageEventRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('insertBatch', () => {
    it('returns empty array for empty input', async () => {
      expect(await repo.insertBatch([])).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('inserts multiple events and returns ids', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
      const result = await repo.insertBatch([
        { workspace_id: 'ws1', event_type: 'qa_run' },
        { workspace_id: 'ws1', event_type: 'qa_run', quantity: 2, credits_consumed: 10n },
      ]);
      expect(result).toEqual(['e1', 'e2']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_events'),
        expect.any(Array),
      );
    });

    it('passes defaults for optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1' }]);
      await repo.insertBatch([{ workspace_id: 'ws1', event_type: 'test' }]);
      const params = mockQuery.mock.calls[0][1];
      expect(params).toEqual(['ws1', null, 'test', 1, '0', '{}']);
    });
  });

  describe('listByOrg', () => {
    it('returns entries with no cursor', async () => {
      mockQuery.mockResolvedValue([
        { id: 'e1', credits_consumed: '10', metadata: null, created_at: new Date() },
      ]);
      const result = await repo.listByOrg('ws1');
      expect(result.entries).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(result.entries[0].credits_consumed).toBe(10n);
    });

    it('returns nextCursor when hasMore', async () => {
      const rows = Array.from({ length: 51 }, (_, i) => ({
        id: `e-${i}`,
        credits_consumed: '0',
        metadata: null,
        created_at: new Date('2025-01-01'),
      }));
      mockQuery.mockResolvedValue(rows);
      const result = await repo.listByOrg('ws1', { limit: 50 });
      expect(result.entries).toHaveLength(50);
      expect(result.nextCursor).toBeTruthy();
    });

    it('decodes cursor and applies it', async () => {
      const cursor = Buffer.from('2025-01-01T00:00:00.000Z|abc').toString('base64');
      mockQuery.mockResolvedValue([]);
      await repo.listByOrg('ws1', { cursor });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('(created_at, id) <'),
        expect.arrayContaining(['2025-01-01T00:00:00.000Z', 'abc']),
      );
    });

    it('applies eventType filter', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByOrg('ws1', { eventType: 'qa_run' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('event_type = $'),
        expect.arrayContaining(['qa_run']),
      );
    });

    it('caps limit at 100', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByOrg('ws1', { limit: 200 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([101]),
      );
    });

    it('hydrates metadata from string', async () => {
      mockQuery.mockResolvedValue([
        { id: 'e1', credits_consumed: '5', metadata: '{"k":"v"}', created_at: new Date() },
      ]);
      const result = await repo.listByOrg('ws1');
      expect(result.entries[0].metadata).toEqual({ k: 'v' });
    });
  });

  describe('listByUser', () => {
    it('returns entries for user', async () => {
      mockQuery.mockResolvedValue([
        { id: 'e1', credits_consumed: '0', metadata: {}, created_at: new Date() },
      ]);
      const result = await repo.listByUser('u1');
      expect(result.entries).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('applies cursor and eventType', async () => {
      const cursor = Buffer.from('2025-01-01T00:00:00.000Z|id1').toString('base64');
      mockQuery.mockResolvedValue([]);
      await repo.listByUser('u1', { cursor, eventType: 'login' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('(created_at, id) <'),
        expect.arrayContaining(['u1']),
      );
    });

    it('returns nextCursor when hasMore', async () => {
      const rows = Array.from({ length: 51 }, (_, i) => ({
        id: `e-${i}`,
        credits_consumed: '0',
        metadata: {},
        created_at: new Date('2025-06-01'),
      }));
      mockQuery.mockResolvedValue(rows);
      const result = await repo.listByUser('u1');
      expect(result.entries).toHaveLength(50);
      expect(result.nextCursor).toBeTruthy();
    });
  });

  describe('aggregateByType', () => {
    it('returns parsed aggregates', async () => {
      mockQuery.mockResolvedValue([
        { event_type: 'qa_run', total_events: '10', total_quantity: '20', total_credits: '100' },
      ]);
      const result = await repo.aggregateByType('ws1', new Date('2025-01-01'));
      expect(result).toEqual([
        { event_type: 'qa_run', total_events: 10, total_quantity: 20, total_credits: 100n },
      ]);
    });
  });

  describe('aggregateByDay', () => {
    it('returns daily aggregates', async () => {
      mockQuery.mockResolvedValue([
        { day: '2025-01-01', total_events: '5', total_quantity: '10', total_credits: '50' },
      ]);
      const result = await repo.aggregateByDay('ws1', {
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      });
      expect(result).toEqual([
        { day: '2025-01-01', total_events: 5, total_quantity: 10, total_credits: 50n },
      ]);
    });
  });

  describe('aggregateByDayAndType', () => {
    it('returns daily+type aggregates', async () => {
      mockQuery.mockResolvedValue([
        { day: '2025-01-01', event_type: 'qa_run', total_events: '3', total_quantity: '3', total_credits: '30' },
      ]);
      const result = await repo.aggregateByDayAndType('ws1', {
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      });
      expect(result).toEqual([
        { day: '2025-01-01', event_type: 'qa_run', total_events: 3, total_quantity: 3, total_credits: 30n },
      ]);
    });
  });

  describe('summaryForOrg', () => {
    it('returns summary with parsed values', async () => {
      mockQuery.mockResolvedValue([
        { total_events: '100', total_charged: '80', total_credits: '5000' },
      ]);
      const result = await repo.summaryForOrg('ws1', {
        from: new Date('2025-01-01'),
        to: new Date('2025-12-31'),
      });
      expect(result).toEqual({
        totalEvents: 100,
        totalCharged: 80,
        totalCredits: 5000n,
      });
    });

    it('returns zeros when no data', async () => {
      mockQuery.mockResolvedValue([{}]);
      const result = await repo.summaryForOrg('ws1', {
        from: new Date('2025-01-01'),
        to: new Date('2025-12-31'),
      });
      expect(result).toEqual({
        totalEvents: 0,
        totalCharged: 0,
        totalCredits: 0n,
      });
    });
  });
});
