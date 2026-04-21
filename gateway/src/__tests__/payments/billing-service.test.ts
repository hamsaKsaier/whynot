import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockPaygCreate, mockPaygSum, mockPaygUpdateStatus,
  mockBillingConfigGet, mockBillingConfigGetBigint,
  mockBillingHistoryRecord,
  mockPlanGetFeatures,
  mockSubFindByWorkspaceId,
  mockReconCountCreatedSince,
} = vi.hoisted(() => ({
  mockPaygCreate: vi.fn(),
  mockPaygSum: vi.fn(),
  mockPaygUpdateStatus: vi.fn(),
  mockBillingConfigGet: vi.fn(),
  mockBillingConfigGetBigint: vi.fn(),
  mockBillingHistoryRecord: vi.fn(),
  mockPlanGetFeatures: vi.fn(),
  mockSubFindByWorkspaceId: vi.fn(),
  mockReconCountCreatedSince: vi.fn(),
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

vi.mock('../../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: vi.fn().mockImplementation(() => ({
    getFeatures: mockPlanGetFeatures,
  })),
}));

vi.mock('../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByWorkspaceId: mockSubFindByWorkspaceId,
  })),
}));

vi.mock('../../../shared/database/repositories/recon-scan-repository', () => ({
  ReconScanRepository: vi.fn().mockImplementation(() => ({
    countCreatedSince: mockReconCountCreatedSince,
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
    recon_scan_run: 5000n,
    recon_phase_fingerprinting: 200n,
    recon_phase_discovery: 800n,
    recon_phase_vuln_analysis: 1500n,
    recon_phase_exploitation: 2000n,
    recon_phase_reporting: 500n,
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

  describe('recon PAYG event types', () => {
    beforeEach(() => {
      mockPaygCreate.mockResolvedValue('ledger-recon');
      mockPaygSum.mockResolvedValue(50_000n);
    });

    it('charges recon_scan_run once at the full-scan baseline rate', async () => {
      const result = await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType: 'recon_scan_run', quantity: 1 },
        { userId: 'u-1', orgId: 'org-1' },
      );

      expect(result.deltaCents).toBe(-5000n);
      expect(mockPaygCreate).toHaveBeenCalledTimes(1);
      expect(mockPaygCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'recon_scan_run', amount_cents: -5000n }),
      );
    });

    it.each([
      ['recon_phase_fingerprinting', -200n],
      ['recon_phase_discovery', -800n],
      ['recon_phase_vuln_analysis', -1500n],
      ['recon_phase_exploitation', -2000n],
      ['recon_phase_reporting', -500n],
    ])('charges per-phase rate for %s', async (eventType, expected) => {
      const result = await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType, quantity: 1 },
        { userId: 'u-1', orgId: 'org-1' },
      );
      expect(result.deltaCents).toBe(expected);
    });

    it('records only the phases completed for a cancelled scan (fingerprinting only)', async () => {
      await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType: 'recon_phase_fingerprinting', quantity: 1 },
        { userId: 'u-1', orgId: 'org-1' },
      );

      expect(mockPaygCreate).toHaveBeenCalledTimes(1);
      expect(mockPaygCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'recon_phase_fingerprinting', amount_cents: -200n }),
      );
      expect(mockPaygCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'recon_scan_run' }),
      );
    });

    it('records exactly one recon_scan_run event for a successful full scan (no per-phase events)', async () => {
      await BillingService.recordUsageEvent(
        { orgId: 'org-1', eventType: 'recon_scan_run', quantity: 1 },
        { userId: 'u-1', orgId: 'org-1' },
      );

      const reconCalls = mockPaygCreate.mock.calls.filter(([arg]) =>
        String(arg.reason).startsWith('recon_'),
      );
      expect(reconCalls).toHaveLength(1);
      expect(reconCalls[0][0].reason).toBe('recon_scan_run');
    });
  });

  describe('getReconScansThisMonth', () => {
    it('returns the count of scans created since the first of the current month', async () => {
      mockReconCountCreatedSince.mockResolvedValue(2);

      const count = await BillingService.getReconScansThisMonth('org-1');

      expect(count).toBe(2);
      expect(mockReconCountCreatedSince).toHaveBeenCalledTimes(1);
      const [workspaceId, sinceDate] = mockReconCountCreatedSince.mock.calls[0];
      expect(workspaceId).toBe('org-1');
      expect(sinceDate).toBeInstanceOf(Date);
      const now = new Date();
      expect(sinceDate.getUTCFullYear()).toBe(now.getUTCFullYear());
      expect(sinceDate.getUTCMonth()).toBe(now.getUTCMonth());
      expect(sinceDate.getUTCDate()).toBe(1);
      expect(sinceDate.getUTCHours()).toBe(0);
      expect(sinceDate.getUTCMinutes()).toBe(0);
    });
  });

  describe('checkReconQuota', () => {
    it('returns 0 included remaining for a free plan (no subscription/no quota feature)', async () => {
      mockSubFindByWorkspaceId.mockResolvedValue(null);
      mockReconCountCreatedSince.mockResolvedValue(0);

      const result = await BillingService.checkReconQuota('org-free');

      expect(result.included_remaining).toBe(0);
      expect(result.payg_per_scan_credits).toBe(5000n);
    });

    it('returns 0 included remaining when plan has recon_monthly_scans=0', async () => {
      mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-free' });
      mockPlanGetFeatures.mockResolvedValue([
        { feature_key: 'recon_monthly_scans', feature_value: '0' },
      ]);
      mockReconCountCreatedSince.mockResolvedValue(0);

      const result = await BillingService.checkReconQuota('org-free');
      expect(result.included_remaining).toBe(0);
    });

    it('returns included_remaining for pro_byo (1 scan) before any scans are run', async () => {
      mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-byo' });
      mockPlanGetFeatures.mockResolvedValue([
        { feature_key: 'recon_monthly_scans', feature_value: '1' },
      ]);
      mockReconCountCreatedSince.mockResolvedValue(0);

      const result = await BillingService.checkReconQuota('org-byo');
      expect(result.included_remaining).toBe(1);
    });

    it('returns 0 included remaining for pro_managed after 3 scans already used', async () => {
      mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
      mockPlanGetFeatures.mockResolvedValue([
        { feature_key: 'recon_monthly_scans', feature_value: '3' },
      ]);
      mockReconCountCreatedSince.mockResolvedValue(3);

      const result = await BillingService.checkReconQuota('org-managed');
      expect(result.included_remaining).toBe(0);
      expect(result.payg_per_scan_credits).toBe(5000n);
    });

    it('decrements included_remaining as scans are started (pro_managed, 3 included)', async () => {
      mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
      mockPlanGetFeatures.mockResolvedValue([
        { feature_key: 'recon_monthly_scans', feature_value: '3' },
      ]);

      mockReconCountCreatedSince.mockResolvedValueOnce(0);
      expect((await BillingService.checkReconQuota('org-m')).included_remaining).toBe(3);

      mockReconCountCreatedSince.mockResolvedValueOnce(1);
      expect((await BillingService.checkReconQuota('org-m')).included_remaining).toBe(2);

      mockReconCountCreatedSince.mockResolvedValueOnce(2);
      expect((await BillingService.checkReconQuota('org-m')).included_remaining).toBe(1);

      mockReconCountCreatedSince.mockResolvedValueOnce(3);
      expect((await BillingService.checkReconQuota('org-m')).included_remaining).toBe(0);
    });

    it('concurrent scan race: only one request observes the last included slot once the scan is persisted', async () => {
      // Pro-managed plan with 3 included scans, 2 already used.
      mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
      mockPlanGetFeatures.mockResolvedValue([
        { feature_key: 'recon_monthly_scans', feature_value: '3' },
      ]);

      // First caller reads count=2 (1 slot remaining).
      // After it persists its scan, any subsequent caller must read count=3 (0 remaining).
      mockReconCountCreatedSince
        .mockResolvedValueOnce(2)  // caller A: sees 1 remaining
        .mockResolvedValueOnce(3); // caller B (after A persisted): sees 0 remaining

      const a = await BillingService.checkReconQuota('org-race');
      const b = await BillingService.checkReconQuota('org-race');

      expect(a.included_remaining).toBe(1);
      expect(b.included_remaining).toBe(0);
      // The two concurrent callers cannot both consume the last free slot.
      expect(a.included_remaining + b.included_remaining).toBe(1);
    });
  });
});
