import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockPaygCreate, mockPaygSum, mockPaygUpdateStatus,
  mockBillingConfigGet, mockBillingConfigGetBigint,
  mockBillingHistoryRecord,
} = vi.hoisted(() => ({
  mockPaygCreate: vi.fn(),
  mockPaygSum: vi.fn(),
  mockPaygUpdateStatus: vi.fn(),
  mockBillingConfigGet: vi.fn(),
  mockBillingConfigGetBigint: vi.fn(),
  mockBillingHistoryRecord: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/payg-credits-ledger-repository', () => ({
  PaygCreditsLedgerRepository: vi.fn().mockImplementation(() => ({
    create: mockPaygCreate,
    sumByWorkspaceId: mockPaygSum,
    updateStatus: mockPaygUpdateStatus,
  })),
}));

vi.mock('../../../shared/database/repositories/billing-config-repository', () => ({
  BillingConfigRepository: vi.fn().mockImplementation(() => ({
    get: mockBillingConfigGet,
    getBigint: mockBillingConfigGetBigint,
  })),
}));

vi.mock('../../../shared/database/repositories/billing-history-repository', () => ({
  BillingHistoryRepository: vi.fn().mockImplementation(() => ({
    record: mockBillingHistoryRecord,
  })),
}));

vi.mock('../../payments/stripe-provider', () => ({
  StripeProvider: vi.fn().mockImplementation(() => ({
    createPaymentIntent: vi.fn().mockResolvedValue({ paymentIntentId: 'pi_test' }),
  })),
}));

vi.mock('../../payments/audit-logger', () => ({
  auditedOperation: vi.fn(async (_op: string, _prov: string, _ctx: any, fn: Function) => fn()),
}));

vi.mock('../../emails/notification-helper', () => ({
  resolveWorkspaceRecipient: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../emails/credits-low', () => ({
  sendCreditsLowEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../emails/payment-success', () => ({
  sendPaymentSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../shared/constants/pricing', () => ({
  DEFAULT_PAYG_RATES: {
    test_execution: 100n,
    test_generation: 300n,
  } as Record<string, bigint>,
}));

import { BillingService } from '../../payments/billing-service';

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBillingConfigGet.mockResolvedValue(null);
    mockBillingConfigGetBigint.mockResolvedValue(1000n);
  });

  describe('recordUsageEvent', () => {
    it('creates a negative ledger entry for usage', async () => {
      mockPaygCreate.mockResolvedValue('ledger-1');
      mockPaygSum.mockResolvedValue(5000n);

      const result = await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType: 'test_execution', quantity: 2 },
        { userId: 'u-1', orgId: 'org-1' },
      );

      expect(result.ledgerEntryId).toBe('ledger-1');
      expect(result.deltaCents).toBe(-200n); // 100n * 2
      expect(mockPaygCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'org-1',
          amount_cents: -200n,
          reason: 'test_execution',
        }),
      );
    });

    it('uses overridden rates from config when available', async () => {
      mockBillingConfigGet.mockResolvedValue('{"test_execution":"50"}');
      mockPaygCreate.mockResolvedValue('ledger-2');
      mockPaygSum.mockResolvedValue(5000n);

      const result = await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType: 'test_execution', quantity: 1 },
        { userId: 'u-1', orgId: 'org-1' },
      );

      expect(result.deltaCents).toBe(-50n);
    });

    it('defaults to 0n for unknown event types', async () => {
      mockPaygCreate.mockResolvedValue('ledger-3');
      mockPaygSum.mockResolvedValue(5000n);

      const result = await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType: 'unknown_type', quantity: 1 },
        { userId: 'u-1', orgId: 'org-1' },
      );

      expect(result.deltaCents).toBe(0n);
    });
  });

  describe('currentPaygBalance', () => {
    it('returns sum from repository', async () => {
      mockPaygSum.mockResolvedValue(5000n);
      const balance = await BillingService.currentPaygBalance('org-1');
      expect(balance).toBe(5000n);
    });
  });

  describe('topUp', () => {
    it('creates positive ledger entry and records billing history', async () => {
      mockPaygCreate.mockResolvedValue('ledger-topup');

      const result = await BillingService.topUp(
        { orgId: 'org-1', amountCents: 10000n, paymentIntentId: 'pi_123' },
        { userId: 'u-1', orgId: 'org-1' },
      );

      expect(result.ledgerEntryId).toBe('ledger-topup');
      expect(mockPaygCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_cents: 10000n,
          reason: 'topup',
          status: 'completed',
        }),
      );
      expect(mockBillingHistoryRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'payg_topup',
          provider: 'stripe',
          amount_cents: 10000n,
        }),
      );
    });

    it('throws for zero or negative amount', async () => {
      await expect(
        BillingService.topUp(
          { orgId: 'org-1', amountCents: 0n, paymentIntentId: 'pi_123' },
          { userId: 'u-1', orgId: 'org-1' },
        ),
      ).rejects.toThrow('Top-up amount must be positive');

      await expect(
        BillingService.topUp(
          { orgId: 'org-1', amountCents: -100n, paymentIntentId: 'pi_123' },
          { userId: 'u-1', orgId: 'org-1' },
        ),
      ).rejects.toThrow('Top-up amount must be positive');
    });
  });
});
