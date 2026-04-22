import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));
vi.mock('../../../shared/database/connection', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

import {
  generateIdempotencyKey,
  generateDeterministicKey,
  checkIdempotencyKey,
  storeIdempotencyResult,
} from '../../payments/idempotency';

describe('generateIdempotencyKey', () => {
  it('returns a valid UUID', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });
});

describe('generateDeterministicKey', () => {
  it('produces the same key for identical inputs', () => {
    const a = generateDeterministicKey('org-1', 'checkout', 'plan-pro');
    const b = generateDeterministicKey('org-1', 'checkout', 'plan-pro');
    expect(a).toBe(b);
  });

  it('produces different keys for different inputs', () => {
    const a = generateDeterministicKey('org-1', 'checkout', 'plan-pro');
    const b = generateDeterministicKey('org-2', 'checkout', 'plan-pro');
    expect(a).not.toBe(b);
  });

  it('starts with det_ prefix', () => {
    const key = generateDeterministicKey('org-abc', 'operation');
    expect(key).toMatch(/^det_/);
  });

  it('includes org ID prefix in key', () => {
    const key = generateDeterministicKey('org-12345', 'op');
    expect(key).toContain('org-1234');
  });
});

describe('checkIdempotencyKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no matching row found', async () => {
    mockQuery.mockResolvedValue([]);
    const result = await checkIdempotencyKey('non-existent-key');

    expect(result).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT status'),
      expect.arrayContaining(['non-existent-key']),
    );
  });

  it('returns parsed result when row found', async () => {
    mockQuery.mockResolvedValue([{
      status: 'completed',
      provider_transaction_id: 'pi_123',
      metadata: '{"foo":"bar"}',
    }]);

    const result = await checkIdempotencyKey('existing-key');

    expect(result).toEqual({
      status: 'completed',
      provider_transaction_id: 'pi_123',
      metadata: { foo: 'bar' },
    });
  });

  it('returns null metadata when metadata column is null', async () => {
    mockQuery.mockResolvedValue([{
      status: 'pending',
      provider_transaction_id: null,
      metadata: null,
    }]);

    const result = await checkIdempotencyKey('key');
    expect(result?.metadata).toBeNull();
  });

  it('only returns recent transactions (within 24h TTL)', async () => {
    mockQuery.mockResolvedValue([]);
    await checkIdempotencyKey('test-key');

    const [, params] = mockQuery.mock.calls[0];
    const cutoff = params[1] as Date;
    const ageMs = Date.now() - cutoff.getTime();
    // Should be approximately 24 hours
    expect(ageMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(25 * 60 * 60 * 1000);
  });
});

describe('storeIdempotencyResult', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates payment_transactions with idempotency_key', async () => {
    mockQuery.mockResolvedValue([]);
    await storeIdempotencyResult('idemp-key-1', 'txn-123');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE payment_transactions'),
      ['idemp-key-1', 'txn-123'],
    );
  });
});
