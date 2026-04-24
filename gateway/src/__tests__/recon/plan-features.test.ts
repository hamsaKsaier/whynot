/**
 * Recon plan-feature edge cases.
 *
 * Covers the two layers that gate a scan-create request:
 *   1. `requireFeature('recon_enabled')` middleware — 403 FEATURE_NOT_AVAILABLE
 *      when the plan does not carry the feature.
 *   2. `BillingService.checkReconQuota()` — resolves included + PAYG rate
 *      from the subscription's plan features; handles recon_monthly_scans=0
 *      and non-integer values.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks hoisted for both layers ───────────────────────────────────────────
const {
  mockPaygCreate,
  mockPaygSum,
  mockPaygUpdateStatus,
  mockBillingConfigGet,
  mockBillingConfigGetBigint,
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
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { BillingService } from '../../payments/billing-service';
import { requireFeature, __resetFeatureCache } from '../../middleware/feature-gate';

const WORKSPACE = 'ws-plan-features';

beforeEach(() => {
  vi.clearAllMocks();
  __resetFeatureCache();
  mockBillingConfigGet.mockResolvedValue(null);
  mockBillingConfigGetBigint.mockResolvedValue(1000n);
  mockPaygSum.mockResolvedValue(50_000n);
  mockReconCountCreatedSince.mockResolvedValue(0);
});

// ──────────────────────────────────────────────────────────────────────────
// Helpers for requireFeature middleware
// ──────────────────────────────────────────────────────────────────────────

function makeReqRes(workspaceId: string | null) {
  const req: any = {
    workspaceId: workspaceId ?? undefined,
    t: (k: string) => k,
  };
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

// ──────────────────────────────────────────────────────────────────────────
// Section 3a — `requireFeature('recon_enabled')` middleware
// ──────────────────────────────────────────────────────────────────────────

describe('requireFeature(recon_enabled) — plan without the feature', () => {
  it('returns 403 FEATURE_NOT_AVAILABLE when the plan has no recon_enabled feature', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-free' });
    mockPlanGetFeatures.mockResolvedValue([]); // no features at all

    const { req, res } = makeReqRes(WORKSPACE);
    const next = vi.fn();
    await requireFeature('recon_enabled')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        details: expect.objectContaining({ feature: 'recon_enabled' }),
      }),
    );
  });

  it('returns 403 when the plan explicitly disables recon_enabled (value=false)', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-free' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_enabled', feature_value: 'false' },
    ]);

    const { req, res } = makeReqRes(WORKSPACE);
    const next = vi.fn();
    await requireFeature('recon_enabled')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
  });

  it('allows the request through when recon_enabled=true', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_enabled', feature_value: 'true' },
    ]);

    const { req, res } = makeReqRes(WORKSPACE);
    const next = vi.fn();
    await requireFeature('recon_enabled')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(req._planFeatures).toEqual({ recon_enabled: 'true' });
  });

  it('returns 401 when no workspace is resolved on the request', async () => {
    const { req, res } = makeReqRes(null);
    const next = vi.fn();
    await requireFeature('recon_enabled')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Section 3b — BillingService.checkReconQuota plan-feature handling
// ──────────────────────────────────────────────────────────────────────────

describe('BillingService.checkReconQuota — plan feature recon_monthly_scans', () => {
  it('returns included_remaining=0 and a non-zero PAYG rate when recon_monthly_scans=0', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-byo-zero' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_enabled', feature_value: 'true' },
      { feature_key: 'recon_monthly_scans', feature_value: '0' },
    ]);

    const quota = await BillingService.checkReconQuota(WORKSPACE);
    expect(quota.included_remaining).toBe(0);
    expect(quota.payg_per_scan_credits).toBe(5000n);
    // Important: router gate is `included<=0 && payg<=0`. With payg=5000n the
    // scan proceeds and falls through to PAYG.
  });

  it('returns included_remaining=3 and PAYG rate=5000n for pro_managed (3 included)', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_enabled', feature_value: 'true' },
      { feature_key: 'recon_monthly_scans', feature_value: '3' },
    ]);

    const quota = await BillingService.checkReconQuota(WORKSPACE);
    expect(quota.included_remaining).toBe(3);
    expect(quota.payg_per_scan_credits).toBe(5000n);
  });

  it('returns included_remaining=0 when the plan has no recon_monthly_scans feature at all', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-without-feature' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_enabled', feature_value: 'true' },
    ]);

    const quota = await BillingService.checkReconQuota(WORKSPACE);
    expect(quota.included_remaining).toBe(0);
    expect(quota.payg_per_scan_credits).toBe(5000n);
  });

  it('non-integer recon_monthly_scans falls back to 0 included (parseInt NaN guard)', async () => {
    // Current behaviour: parseInt("three") is NaN and the guard keeps
    // `included` at 0. This test locks down that fallback so regressions
    // don't silently start honouring garbage values. If we later decide to
    // reject this input with a 500 + alert, update this test.
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-bad' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_monthly_scans', feature_value: 'three' },
    ]);

    const quota = await BillingService.checkReconQuota(WORKSPACE);
    expect(quota.included_remaining).toBe(0);
    expect(quota.payg_per_scan_credits).toBe(5000n);
  });

  it('rejects negative recon_monthly_scans by clamping included to 0', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-bad-neg' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_monthly_scans', feature_value: '-5' },
    ]);

    const quota = await BillingService.checkReconQuota(WORKSPACE);
    expect(quota.included_remaining).toBe(0);
  });

  it('uses parseInt leading-number coercion ("3abc" → 3) — documents current behaviour', async () => {
    // parseInt is lenient; a config row of "3abc" becomes 3. This is not
    // ideal but it's the current documented behaviour. The test exists so a
    // future tightening (rejecting non-strict integers) is a conscious break.
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-lenient' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_monthly_scans', feature_value: '3abc' },
    ]);

    const quota = await BillingService.checkReconQuota(WORKSPACE);
    expect(quota.included_remaining).toBe(3);
  });
});
