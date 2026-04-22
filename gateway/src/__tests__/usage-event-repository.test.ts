import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../../shared/database/connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import {
  UsageEventRepository,
  type CreateUsageEventInput,
} from '../../shared/database/repositories/usage-event-repository';

describe('UsageEventRepository', () => {
  let repo: UsageEventRepository;

  beforeEach(() => {
    repo = new UsageEventRepository();
    vi.clearAllMocks();
  });

  describe('insertBatch', () => {
    it('returns empty array for empty input', async () => {
      const result = await repo.insertBatch([]);
      expect(result).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('inserts a single event', async () => {
      mockQuery.mockResolvedValue([{ id: 'evt-1' }]);

      const events: CreateUsageEventInput[] = [
        {
          workspace_id: 'ws-1',
          user_id: 'u-1',
          event_type: 'test_generation',
          quantity: 2,
          credits_consumed: 6n,
          metadata: { foo: 'bar' },
        },
      ];

      const ids = await repo.insertBatch(events);

      expect(ids).toEqual(['evt-1']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_events'),
        ['ws-1', 'u-1', 'test_generation', 2, '6', '{"foo":"bar"}'],
      );
    });

    it('inserts multiple events in a single query', async () => {
      mockQuery.mockResolvedValue([{ id: 'evt-1' }, { id: 'evt-2' }]);

      const events: CreateUsageEventInput[] = [
        { workspace_id: 'ws-1', event_type: 'test_generation' },
        { workspace_id: 'ws-2', event_type: 'test_execution', quantity: 5 },
      ];

      const ids = await repo.insertBatch(events);

      expect(ids).toEqual(['evt-1', 'evt-2']);
      expect(mockQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('($1, $2, $3, $4, $5, $6)');
      expect(sql).toContain('($7, $8, $9, $10, $11, $12)');
      expect(params).toHaveLength(12);
      expect(params[0]).toBe('ws-1');
      expect(params[1]).toBeNull();
      expect(params[3]).toBe(1);
      expect(params[4]).toBe('0');
      expect(params[6]).toBe('ws-2');
      expect(params[9]).toBe(5);
    });
  });

  describe('listByOrg', () => {
    it('queries with workspace_id filter', async () => {
      mockQuery.mockResolvedValue([]);

      await repo.listByOrg('ws-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $1'),
        ['ws-1', 51],
      );
    });

    it('applies cursor pagination', async () => {
      const cursor = Buffer.from('2026-01-01T00:00:00.000Z|evt-99').toString('base64');
      mockQuery.mockResolvedValue([]);

      await repo.listByOrg('ws-1', { cursor, limit: 10 });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('(created_at, id) < ($2, $3)');
      expect(params[1]).toBe('2026-01-01T00:00:00.000Z');
      expect(params[2]).toBe('evt-99');
      expect(params[3]).toBe(11);
    });

    it('returns nextCursor when more results exist', async () => {
      const rows = Array.from({ length: 51 }, (_, i) => ({
        id: `evt-${i}`,
        workspace_id: 'ws-1',
        user_id: null,
        event_type: 'test_generation',
        quantity: 1,
        credits_consumed: '3',
        metadata: '{}',
        created_at: new Date('2026-01-01'),
      }));
      mockQuery.mockResolvedValue(rows);

      const result = await repo.listByOrg('ws-1');

      expect(result.entries).toHaveLength(50);
      expect(result.nextCursor).not.toBeNull();

      const decoded = Buffer.from(result.nextCursor!, 'base64').toString('utf8');
      expect(decoded).toContain('evt-49');
    });

    it('returns null nextCursor when no more results', async () => {
      mockQuery.mockResolvedValue([
        {
          id: 'evt-1',
          workspace_id: 'ws-1',
          user_id: null,
          event_type: 'test_generation',
          quantity: 1,
          credits_consumed: '0',
          metadata: '{}',
          created_at: new Date(),
        },
      ]);

      const result = await repo.listByOrg('ws-1');

      expect(result.entries).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('filters by eventType', async () => {
      mockQuery.mockResolvedValue([]);

      await repo.listByOrg('ws-1', { eventType: 'test_execution' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('event_type = $2');
      expect(params[1]).toBe('test_execution');
    });
  });

  describe('listByUser', () => {
    it('queries with user_id filter', async () => {
      mockQuery.mockResolvedValue([]);

      await repo.listByUser('u-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        ['u-1', 51],
      );
    });
  });

  describe('aggregateByType', () => {
    it('groups events by type since a given date', async () => {
      mockQuery.mockResolvedValue([
        { event_type: 'test_generation', total_events: '10', total_quantity: '25', total_credits: '150' },
        { event_type: 'test_execution', total_events: '5', total_quantity: '5', total_credits: '50' },
      ]);

      const since = new Date('2026-01-01');
      const result = await repo.aggregateByType('ws-1', since);

      expect(result).toEqual([
        { event_type: 'test_generation', total_events: 10, total_quantity: 25, total_credits: 150n },
        { event_type: 'test_execution', total_events: 5, total_quantity: 5, total_credits: 50n },
      ]);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('GROUP BY event_type');
      expect(params[0]).toBe('ws-1');
    });
  });

  describe('aggregateByDay', () => {
    it('groups events by day within a date range', async () => {
      mockQuery.mockResolvedValue([
        { day: '2026-01-01', total_events: '8', total_quantity: '20', total_credits: '100' },
        { day: '2026-01-02', total_events: '3', total_quantity: '3', total_credits: '30' },
      ]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      const result = await repo.aggregateByDay('ws-1', { from, to });

      expect(result).toEqual([
        { day: '2026-01-01', total_events: 8, total_quantity: 20, total_credits: 100n },
        { day: '2026-01-02', total_events: 3, total_quantity: 3, total_credits: 30n },
      ]);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("date_trunc('day'");
      expect(sql).toContain('ORDER BY day ASC');
      expect(params[0]).toBe('ws-1');
    });
  });

  describe('org isolation', () => {
    it('listByOrg always scopes by workspace_id', async () => {
      mockQuery.mockResolvedValue([]);

      await repo.listByOrg('ws-A');
      await repo.listByOrg('ws-B');

      expect(mockQuery.mock.calls[0][1][0]).toBe('ws-A');
      expect(mockQuery.mock.calls[1][1][0]).toBe('ws-B');
    });

    it('aggregateByType always scopes by workspace_id', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.aggregateByType('ws-A', new Date());
      expect(mockQuery.mock.calls[0][1][0]).toBe('ws-A');
    });

    it('aggregateByDay always scopes by workspace_id', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.aggregateByDay('ws-A', { from: new Date(), to: new Date() });
      expect(mockQuery.mock.calls[0][1][0]).toBe('ws-A');
    });
  });
});
