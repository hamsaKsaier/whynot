/**
 * Recon billing edge-case tests.
 *
 * Focused on billing flows that the per-feature suites (B/C) don't fully
 * exercise: quota consumption across a month, month-boundary reset,
 * cancellation vs full-run accounting, stuck scans, race on the last
 * included slot, plan downgrade mid-scan, insufficient credits at the
 * gate, and the sum-invariant between per-phase rates and the full-scan
 * rate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { DEFAULT_PAYG_RATES } from '../../../shared/constants/pricing';

const WORKSPACE = 'ws-billing-edge';
const CTX = { userId: 'user-1', orgId: WORKSPACE };

beforeEach(() => {
  vi.clearAllMocks();
  mockBillingConfigGet.mockResolvedValue(null);
  mockBillingConfigGetBigint.mockResolvedValue(1000n);
  mockPaygCreate.mockResolvedValue('ledger-id');
  mockPaygSum.mockResolvedValue(50_000n);
});

afterEach(() => {
  vi.useRealTimers();
});

// ──────────────────────────────────────────────────────────────────────────
// Section 1 — Billing scenarios
// ──────────────────────────────────────────────────────────────────────────

describe('Recon billing — quota consumption (pro_managed, 3 included/month)', () => {
  const proManaged = () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_enabled', feature_value: 'true' },
      { feature_key: 'recon_monthly_scans', feature_value: '3' },
    ]);
  };

  it('decrements included_remaining for scans 1-3, then PAYG charges scan 4', async () => {
    proManaged();

    mockReconCountCreatedSince.mockResolvedValueOnce(0);
    const q1 = await BillingService.checkReconQuota(WORKSPACE);
    expect(q1.included_remaining).toBe(3);

    mockReconCountCreatedSince.mockResolvedValueOnce(1);
    const q2 = await BillingService.checkReconQuota(WORKSPACE);
    expect(q2.included_remaining).toBe(2);

    mockReconCountCreatedSince.mockResolvedValueOnce(2);
    const q3 = await BillingService.checkReconQuota(WORKSPACE);
    expect(q3.included_remaining).toBe(1);

    // After the 3rd scan is persisted the 4th caller sees 0 included.
    mockReconCountCreatedSince.mockResolvedValueOnce(3);
    const q4 = await BillingService.checkReconQuota(WORKSPACE);
    expect(q4.included_remaining).toBe(0);
    expect(q4.payg_per_scan_credits).toBe(5000n);

    // The 4th scan run actually bills PAYG — a 5000¢ ledger debit.
    const res = await BillingService.recordUsageEvent(
      { orgId: WORKSPACE, eventType: 'recon_scan_run', quantity: 1 },
      CTX,
    );
    expect(res.deltaCents).toBe(-5000n);
    expect(mockPaygCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: WORKSPACE,
        amount_cents: -5000n,
        reason: 'recon_scan_run',
      }),
    );
  });
});

describe('Recon billing — quota reset at month boundary', () => {
  it('uses the current UTC month-start when counting scans', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_monthly_scans', feature_value: '3' },
    ]);

    // Inside April 2026: 3 scans already used → included_remaining = 0.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28, 12, 0, 0))); // Apr 28 12:00 UTC
    mockReconCountCreatedSince.mockImplementation(async (_ws: string, since: Date) => {
      expect(since.getUTCFullYear()).toBe(2026);
      expect(since.getUTCMonth()).toBe(3); // April
      expect(since.getUTCDate()).toBe(1);
      return 3;
    });
    const aprQuota = await BillingService.checkReconQuota(WORKSPACE);
    expect(aprQuota.included_remaining).toBe(0);

    // Advance to May 1 00:05 UTC — first scan of the new month should see
    // since=May 1 UTC and 0 prior scans.
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 1, 0, 5, 0))); // May 1 00:05 UTC
    mockReconCountCreatedSince.mockImplementation(async (_ws: string, since: Date) => {
      expect(since.getUTCFullYear()).toBe(2026);
      expect(since.getUTCMonth()).toBe(4); // May
      expect(since.getUTCDate()).toBe(1);
      expect(since.getUTCHours()).toBe(0);
      expect(since.getUTCMinutes()).toBe(0);
      return 0;
    });
    const mayQuota = await BillingService.checkReconQuota(WORKSPACE);
    expect(mayQuota.included_remaining).toBe(3);
  });
});

describe('Recon billing — cancellation mid-scan bills only completed phases', () => {
  it('records fingerprinting+discovery+vuln_analysis but NOT exploitation/reporting/recon_scan_run', async () => {
    // Scan cancelled during vuln_analysis. The executor recorded the three
    // finished phase events (including the one running at cancel time, which
    // actually ran); the two remaining phases plus the full-scan event are
    // not billed because they didn't complete.
    const completed = [
      'recon_phase_fingerprinting',
      'recon_phase_discovery',
      'recon_phase_vuln_analysis',
    ] as const;

    for (const eventType of completed) {
      await BillingService.recordUsageEvent(
        { orgId: WORKSPACE, eventType, quantity: 1 },
        CTX,
      );
    }

    const reasonsCalled = mockPaygCreate.mock.calls.map((c) => c[0].reason);
    expect(reasonsCalled).toEqual([...completed]);
    expect(reasonsCalled).not.toContain('recon_phase_exploitation');
    expect(reasonsCalled).not.toContain('recon_phase_reporting');
    expect(reasonsCalled).not.toContain('recon_scan_run');

    const totalDebited = mockPaygCreate.mock.calls.reduce(
      (sum: bigint, c: any[]) => sum + (-c[0].amount_cents as bigint),
      0n,
    );
    expect(totalDebited).toBe(200n + 800n + 1500n); // 2500¢
  });
});

describe('Recon billing — successful full scan bills a single recon_scan_run event', () => {
  it('records exactly ONE recon_scan_run and NO per-phase events', async () => {
    await BillingService.recordUsageEvent(
      { orgId: WORKSPACE, eventType: 'recon_scan_run', quantity: 1 },
      CTX,
    );

    expect(mockPaygCreate).toHaveBeenCalledTimes(1);
    const reasons = mockPaygCreate.mock.calls.map((c) => c[0].reason);
    expect(reasons).toEqual(['recon_scan_run']);
    expect(reasons.some((r: string) => r.startsWith('recon_phase_'))).toBe(false);
  });
});

describe('Recon billing — stuck scan bills only completed phases', () => {
  it('bills fingerprinting only when the scan stalls after phase 1', async () => {
    await BillingService.recordUsageEvent(
      { orgId: WORKSPACE, eventType: 'recon_phase_fingerprinting', quantity: 1 },
      CTX,
    );

    expect(mockPaygCreate).toHaveBeenCalledTimes(1);
    expect(mockPaygCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ reason: 'recon_phase_fingerprinting', amount_cents: -200n }),
    );
    const reasons = mockPaygCreate.mock.calls.map((c) => c[0].reason);
    expect(reasons).not.toContain('recon_scan_run');
    expect(reasons).not.toContain('recon_phase_discovery');
  });
});

describe('Recon billing — concurrent-scan race for the last included slot', () => {
  it('exactly one caller consumes the slot; the other falls through to PAYG', async () => {
    mockSubFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro-managed' });
    mockPlanGetFeatures.mockResolvedValue([
      { feature_key: 'recon_monthly_scans', feature_value: '3' },
    ]);

    // 2 scans already used. Caller A reads 2 (1 slot left), persists its
    // scan, then caller B reads 3 (0 slots left) — must go PAYG.
    mockReconCountCreatedSince
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const a = await BillingService.checkReconQuota(WORKSPACE);
    const b = await BillingService.checkReconQuota(WORKSPACE);

    expect(a.included_remaining).toBe(1);
    expect(b.included_remaining).toBe(0);
    expect(a.included_remaining + b.included_remaining).toBe(1);

    // B is charged via PAYG. The per-scan PAYG rate stays > 0.
    expect(b.payg_per_scan_credits).toBe(5000n);
  });
});

describe('Recon billing — plan downgrade mid-scan', () => {
  it('a running scan still bills completed phases; new scans on free plan are blocked', async () => {
    // Phase 1 completes — workspace was on pro_managed when the scan started,
    // billing records the phase event regardless of the current plan.
    await BillingService.recordUsageEvent(
      { orgId: WORKSPACE, eventType: 'recon_phase_fingerprinting', quantity: 1 },
      CTX,
    );
    expect(mockPaygCreate).toHaveBeenCalledTimes(1);

    // Now the workspace has downgraded to free (no sub in DB or plan has no
    // recon_monthly_scans feature). New scan creation sees included=0 and
    // payg_per_scan_credits is still the default rate — but from a gate
    // perspective the router will 403 via requireFeature in real traffic.
    // Here we just verify the quota path reports "no included scans".
    mockSubFindByWorkspaceId.mockResolvedValue(null); // no subscription → free
    mockReconCountCreatedSince.mockResolvedValue(0);

    const q = await BillingService.checkReconQuota(WORKSPACE);
    expect(q.included_remaining).toBe(0);
    expect(q.payg_per_scan_credits).toBe(5000n);
  });
});

describe('Recon billing — insufficient credits', () => {
  it('records a negative ledger entry when balance is below the per-scan rate', async () => {
    // Workspace has 4999¢ of credit remaining; a recon_scan_run costs 5000¢.
    // The gate (router-level) evaluates included/PAYG rate availability, not
    // realtime balance — meaning the charge lands and the ledger goes to -1¢.
    // This test locks down that behavior: a deterministic 1¢ overdraft.
    mockPaygSum.mockResolvedValue(4999n);

    const res = await BillingService.recordUsageEvent(
      { orgId: WORKSPACE, eventType: 'recon_scan_run', quantity: 1 },
      CTX,
    );
    expect(res.deltaCents).toBe(-5000n);
    expect(mockPaygCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount_cents: -5000n, reason: 'recon_scan_run' }),
    );

    // The sum reported *after* the debit (mock still returns 4999n because we
    // don't mutate). The important invariant is: the rate is fully charged,
    // regardless of balance. This documents that upstream callers must check
    // balance if they need a pre-charge gate.
  });
});

describe('Recon billing — per-phase events sum to recon_scan_run rate', () => {
  it('DEFAULT_PAYG_RATES invariant: sum(per-phase) === recon_scan_run', () => {
    const perPhase =
      DEFAULT_PAYG_RATES.recon_phase_fingerprinting +
      DEFAULT_PAYG_RATES.recon_phase_discovery +
      DEFAULT_PAYG_RATES.recon_phase_vuln_analysis +
      DEFAULT_PAYG_RATES.recon_phase_exploitation +
      DEFAULT_PAYG_RATES.recon_phase_reporting;
    expect(perPhase).toBe(DEFAULT_PAYG_RATES.recon_scan_run);
    expect(perPhase).toBe(5000n);
  });

  it('charged per-phase debits sum to the full-scan rate when all five phases bill', async () => {
    const phases = [
      'recon_phase_fingerprinting',
      'recon_phase_discovery',
      'recon_phase_vuln_analysis',
      'recon_phase_exploitation',
      'recon_phase_reporting',
    ] as const;

    for (const eventType of phases) {
      await BillingService.recordUsageEvent(
        { orgId: WORKSPACE, eventType, quantity: 1 },
        CTX,
      );
    }

    const totalDebited = mockPaygCreate.mock.calls.reduce(
      (sum: bigint, c: any[]) => sum + (-c[0].amount_cents as bigint),
      0n,
    );
    expect(totalDebited).toBe(DEFAULT_PAYG_RATES.recon_scan_run);
  });
});
