import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));
vi.mock('../../../shared/database/connection', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { writePaymentAuditLog, auditedOperation } from '../../payments/audit-logger';

describe('writePaymentAuditLog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts audit entry into payment_audit_log', async () => {
    mockQuery.mockResolvedValue([]);
    await writePaymentAuditLog({
      operation: 'createCheckout',
      provider: 'stripe',
      status: 'success',
      durationMs: 150,
      userId: 'u-1',
      orgId: 'org-1',
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO payment_audit_log');
    expect(params[0]).toBe('createCheckout');
    expect(params[1]).toBe('stripe');
    expect(params[2]).toBe('success');
    expect(params[3]).toBe(150);
    expect(params[4]).toBe('u-1');
    expect(params[5]).toBe('org-1');
  });

  it('handles optional fields with null defaults', async () => {
    mockQuery.mockResolvedValue([]);
    await writePaymentAuditLog({
      operation: 'refund',
      provider: 'stripe',
      status: 'failed',
      durationMs: 50,
    });

    const params = mockQuery.mock.calls[0][1];
    expect(params[4]).toBeNull(); // userId
    expect(params[5]).toBeNull(); // orgId
    expect(params[6]).toBeNull(); // idempotencyKey
    expect(params[7]).toBeNull(); // amountCents
    expect(params[11]).toBe(0); // retryAttempts default
  });

  it('serializes providerRefs and metadata as JSON', async () => {
    mockQuery.mockResolvedValue([]);
    await writePaymentAuditLog({
      operation: 'charge',
      provider: 'stripe',
      status: 'success',
      durationMs: 200,
      providerRefs: { pi_id: 'pi_123' },
      metadata: { source: 'api' },
    });

    const params = mockQuery.mock.calls[0][1];
    expect(params[12]).toBe('{"pi_id":"pi_123"}');
    expect(params[13]).toBe('{"source":"api"}');
  });

  it('does not throw on DB error (logs error instead)', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    // Should not throw
    await expect(
      writePaymentAuditLog({
        operation: 'charge',
        provider: 'stripe',
        status: 'success',
        durationMs: 10,
      }),
    ).resolves.toBeUndefined();
  });

  it('converts bigint amountCents to string', async () => {
    mockQuery.mockResolvedValue([]);
    await writePaymentAuditLog({
      operation: 'charge',
      provider: 'stripe',
      status: 'success',
      durationMs: 100,
      amountCents: BigInt(2999),
    });

    const params = mockQuery.mock.calls[0][1];
    expect(params[7]).toBe('2999');
  });
});

describe('auditedOperation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs success and returns result on success', async () => {
    mockQuery.mockResolvedValue([]);
    const result = await auditedOperation(
      'testOp',
      'stripe',
      { userId: 'u-1', orgId: 'org-1' },
      async () => 'hello',
    );

    expect(result).toBe('hello');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1];
    expect(params[2]).toBe('success');
  });

  it('logs failure and rethrows on error', async () => {
    mockQuery.mockResolvedValue([]);
    await expect(
      auditedOperation(
        'failOp',
        'stripe',
        { userId: 'u-1' },
        async () => {
          throw new Error('payment failed');
        },
      ),
    ).rejects.toThrow('payment failed');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1];
    expect(params[2]).toBe('failed');
    expect(params[9]).toBe('payment failed'); // errorMessage
  });

  it('records durationMs accurately', async () => {
    mockQuery.mockResolvedValue([]);
    await auditedOperation('timedOp', 'stripe', {}, async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 'done';
    });

    const params = mockQuery.mock.calls[0][1];
    const duration = params[3];
    expect(duration).toBeGreaterThanOrEqual(15);
  });

  it('passes extraFields to audit log', async () => {
    mockQuery.mockResolvedValue([]);
    await auditedOperation(
      'withExtra',
      'stripe',
      {},
      async () => 'ok',
      { amountCents: BigInt(1000), currency: 'usd' },
    );

    const params = mockQuery.mock.calls[0][1];
    expect(params[7]).toBe('1000'); // amountCents stringified
    expect(params[8]).toBe('usd');
  });

  it('extracts error code from error object', async () => {
    mockQuery.mockResolvedValue([]);
    const errWithCode = new Error('stripe error');
    (errWithCode as any).code = 'card_declined';

    await expect(
      auditedOperation('codeOp', 'stripe', {}, async () => {
        throw errWithCode;
      }),
    ).rejects.toThrow();

    const params = mockQuery.mock.calls[0][1];
    expect(params[10]).toBe('card_declined');
  });
});
