import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { BillingHistoryRepository } from '../../database/repositories/billing-history-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('BillingHistoryRepository', () => {
  const repo = new BillingHistoryRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('record', () => {
    it('inserts record and returns id', async () => {
      mockQuery.mockResolvedValue([{ id: 'bh1' }]);
      const result = await repo.record({
        workspace_id: 'ws1',
        event_type: 'payment',
        provider: 'stripe',
      });
      expect(result).toBe('bh1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO billing_history'),
        ['ws1', 'payment', 'stripe', null, null, 'usd', null],
      );
    });

    it('serializes amount_cents as string and metadata as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'bh2' }]);
      await repo.record({
        workspace_id: 'ws1',
        event_type: 'charge',
        provider: 'stripe',
        amount_cents: 5000n,
        metadata: { invoice: 'inv_1' },
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO billing_history'),
        expect.arrayContaining(['5000', JSON.stringify({ invoice: 'inv_1' })]),
      );
    });
  });

  describe('findByWorkspaceId', () => {
    it('returns entries with total count', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([
          { id: 'bh1', amount_cents: '1000', metadata: null },
          { id: 'bh2', amount_cents: null, metadata: '{"k":"v"}' },
        ]);
      const result = await repo.findByWorkspaceId('ws1');
      expect(result.total).toBe(5);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].amount_cents).toBe(1000n);
      expect(result.entries[1].amount_cents).toBeNull();
      expect(result.entries[1].metadata).toEqual({ k: 'v' });
    });

    it('uses custom limit and offset', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);
      await repo.findByWorkspaceId('ws1', { limit: 10, offset: 5 });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('defaults limit to 50 and offset to 0', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);
      await repo.findByWorkspaceId('ws1');
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        ['ws1', 50, 0],
      );
    });
  });
});
