import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { query, transaction } from '../../database/connection';
import { CreditRepository } from '../../database/repositories/credit-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockTransaction = transaction as ReturnType<typeof vi.fn>;

describe('CreditRepository', () => {
  const repo = new CreditRepository();

  beforeEach(() => {
    mockQuery.mockReset();
    mockTransaction.mockReset();
  });

  describe('getBalance', () => {
    it('returns balance when found', async () => {
      const balance = { id: 'cb1', workspace_id: 'ws1', balance: 100 };
      mockQuery.mockResolvedValue([balance]);
      expect(await repo.getBalance('ws1')).toEqual(balance);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getBalance('ws1')).toBeNull();
    });
  });

  describe('initBalance', () => {
    it('returns new balance when created', async () => {
      const balance = { id: 'cb1', workspace_id: 'ws1', balance: 0 };
      mockQuery.mockResolvedValue([balance]);
      expect(await repo.initBalance('ws1')).toEqual(balance);
    });

    it('returns existing balance on conflict', async () => {
      const existing = { id: 'cb1', workspace_id: 'ws1', balance: 50 };
      mockQuery
        .mockResolvedValueOnce([]) // INSERT returns empty (conflict)
        .mockResolvedValueOnce([existing]); // getBalance call
      expect(await repo.initBalance('ws1')).toEqual(existing);
    });
  });

  describe('hasEnoughCredits', () => {
    it('returns true when balance is sufficient', async () => {
      mockQuery.mockResolvedValue([{ balance: 100 }]);
      expect(await repo.hasEnoughCredits('ws1', 50)).toBe(true);
    });

    it('returns false when balance is insufficient', async () => {
      mockQuery.mockResolvedValue([{ balance: 10 }]);
      expect(await repo.hasEnoughCredits('ws1', 50)).toBe(false);
    });

    it('returns false when no balance record', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.hasEnoughCredits('ws1', 1)).toBe(false);
    });
  });

  describe('addCredits', () => {
    it('calls transaction with callback', async () => {
      const txn = { id: 'tx1', amount: 100 };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [{ balance: 200 }] })
            .mockResolvedValueOnce({ rows: [txn] }),
        };
        return cb(mockClient);
      });
      const result = await repo.addCredits({
        workspace_id: 'ws1',
        amount: 100,
        type: 'admin_grant',
        description: 'test grant',
      });
      expect(result).toEqual(txn);
    });

    it('throws when no balance record found', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({ rows: [] }),
        };
        return cb(mockClient);
      });
      await expect(
        repo.addCredits({
          workspace_id: 'ws1',
          amount: 100,
          type: 'admin_grant',
          description: 'test',
        }),
      ).rejects.toThrow('No credit balance found');
    });
  });

  describe('deductCredits', () => {
    it('deducts credits via transaction', async () => {
      const txn = { id: 'tx1', amount: -50 };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [{ balance: 50 }] })
            .mockResolvedValueOnce({ rows: [txn] }),
        };
        return cb(mockClient);
      });
      const result = await repo.deductCredits({
        workspace_id: 'ws1',
        amount: 50,
        type: 'usage',
        description: 'test usage',
      });
      expect(result).toEqual(txn);
    });

    it('throws on insufficient credits', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({ rows: [] }),
        };
        return cb(mockClient);
      });
      await expect(
        repo.deductCredits({
          workspace_id: 'ws1',
          amount: 999,
          type: 'usage',
          description: 'test',
        }),
      ).rejects.toThrow('Insufficient credits');
    });
  });

  describe('getTransactions', () => {
    it('returns transactions and total', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ id: 'tx1' }]);
      const result = await repo.getTransactions('ws1');
      expect(result).toEqual({ transactions: [{ id: 'tx1' }], total: 10 });
    });

    it('applies type filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);
      await repo.getTransactions('ws1', { type: 'usage' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['usage']),
      );
    });

    it('uses custom offset and limit', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([]);
      await repo.getTransactions('ws1', { offset: 10, limit: 25 });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTotalUsageForPeriod', () => {
    it('returns total usage', async () => {
      mockQuery.mockResolvedValue([{ total: '500' }]);
      const result = await repo.getTotalUsageForPeriod(
        'ws1',
        new Date('2025-01-01'),
        new Date('2025-12-31'),
      );
      expect(result).toBe(500);
    });

    it('returns 0 when no usage', async () => {
      mockQuery.mockResolvedValue([{}]);
      const result = await repo.getTotalUsageForPeriod(
        'ws1',
        new Date('2025-01-01'),
        new Date('2025-12-31'),
      );
      expect(result).toBe(0);
    });
  });
});
