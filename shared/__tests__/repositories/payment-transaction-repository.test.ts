import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { PaymentTransactionRepository } from '../../database/repositories/payment-transaction-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('PaymentTransactionRepository', () => {
  const repo = new PaymentTransactionRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts transaction and returns id', async () => {
      mockQuery.mockResolvedValue([{ id: 'pt1' }]);
      const result = await repo.create({
        workspace_id: 'ws1',
        provider: 'stripe',
        provider_transaction_id: 'txn_1',
        type: 'subscription',
        status: 'completed',
        amount_cents: 10000n,
      });
      expect(result).toBe('pt1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_transactions'),
        ['ws1', 'stripe', 'txn_1', 'subscription', 'completed', '10000', 'usd', null, null, null, null],
      );
    });

    it('passes all optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'pt1' }]);
      await repo.create({
        workspace_id: 'ws1',
        provider: 'stripe',
        provider_transaction_id: 'txn_1',
        type: 'one_time',
        status: 'failed',
        amount_cents: 500n,
        currency: 'eur',
        failure_code: 'card_declined',
        failure_message: 'Card was declined',
        idempotency_key: 'idem_1',
        metadata: { reason: 'test' },
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['eur', 'card_declined', 'Card was declined', 'idem_1']),
      );
    });
  });

  describe('findById', () => {
    it('returns hydrated transaction', async () => {
      mockQuery.mockResolvedValue([{ id: 'pt1', amount_cents: '5000', metadata: null }]);
      const result = await repo.findById('pt1');
      expect(result).toBeTruthy();
      expect(result!.amount_cents).toBe(5000n);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });

    it('parses string metadata', async () => {
      mockQuery.mockResolvedValue([{ id: 'pt1', amount_cents: '100', metadata: '{"k":"v"}' }]);
      const result = await repo.findById('pt1');
      expect(result!.metadata).toEqual({ k: 'v' });
    });
  });

  describe('findByIdempotencyKey', () => {
    it('returns transaction when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'pt1', amount_cents: '100', metadata: null }]);
      const result = await repo.findByIdempotencyKey('idem_1');
      expect(result).toBeTruthy();
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByIdempotencyKey('nope')).toBeNull();
    });
  });

  describe('findByWorkspaceId', () => {
    it('returns hydrated transactions and total', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([{ id: 'pt1', amount_cents: '1000', metadata: null }]);
      const result = await repo.findByWorkspaceId('ws1');
      expect(result.total).toBe(5);
      expect(result.transactions[0].amount_cents).toBe(1000n);
    });

    it('applies type filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);
      await repo.findByWorkspaceId('ws1', { type: 'refund' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['refund']),
      );
    });
  });

  describe('updateStatus', () => {
    it('updates status without failure info', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.updateStatus('pt1', 'completed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payment_transactions SET status'),
        ['completed', 'pt1'],
      );
    });

    it('updates status with failure info', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.updateStatus('pt1', 'failed', { code: 'card_declined', message: 'Declined' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('failure_code'),
        ['failed', 'card_declined', 'Declined', 'pt1'],
      );
    });
  });
});
