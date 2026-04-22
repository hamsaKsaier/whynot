import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { PaygCreditsLedgerRepository } from '../../database/repositories/payg-credits-ledger-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('PaygCreditsLedgerRepository', () => {
  const repo = new PaygCreditsLedgerRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts ledger entry and returns id', async () => {
      mockQuery.mockResolvedValue([{ id: 'pl1' }]);
      const result = await repo.create({
        workspace_id: 'ws1',
        amount_cents: 5000n,
        reason: 'topup',
        related_event_id: null,
        status: 'completed',
      });
      expect(result).toBe('pl1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payg_credits_ledger'),
        ['ws1', '5000', 'topup', null, 'completed'],
      );
    });
  });

  describe('updateStatus', () => {
    it('updates status without stripe payment intent', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.updateStatus('pl1', 'completed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payg_credits_ledger SET status'),
        ['completed', 'pl1'],
      );
    });

    it('updates status with stripe payment intent', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.updateStatus('pl1', 'completed', 'pi_123');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('stripe_payment_intent_id'),
        ['completed', 'pi_123', 'pl1'],
      );
    });
  });

  describe('findByWorkspaceId', () => {
    it('returns entries and total', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([
          { id: 'pl1', amount_cents: '5000' },
        ]);
      const result = await repo.findByWorkspaceId('ws1');
      expect(result.total).toBe(10);
      expect(result.entries[0].amount_cents).toBe(5000n);
    });

    it('applies status filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);
      await repo.findByWorkspaceId('ws1', { status: 'pending' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['pending']),
      );
    });

    it('uses custom limit and offset', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);
      await repo.findByWorkspaceId('ws1', { limit: 10, offset: 5 });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('sumByWorkspaceId', () => {
    it('returns sum as bigint', async () => {
      mockQuery.mockResolvedValue([{ total: '50000' }]);
      expect(await repo.sumByWorkspaceId('ws1')).toBe(50000n);
    });

    it('applies status filter', async () => {
      mockQuery.mockResolvedValue([{ total: '10000' }]);
      await repo.sumByWorkspaceId('ws1', 'completed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['completed']),
      );
    });

    it('returns 0n when no entries', async () => {
      mockQuery.mockResolvedValue([{}]);
      expect(await repo.sumByWorkspaceId('ws1')).toBe(0n);
    });
  });
});
