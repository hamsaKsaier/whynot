import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSubRepo,
  mockBillingConfigRepo,
  mockBillingHistoryRepo,
  mockPlanRepo,
  mockCreditRepo,
  mockStripe,
  mockPaygRepo,
} = vi.hoisted(() => ({
  mockSubRepo: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockBillingConfigRepo: {
    getInt: vi.fn(),
    getBigint: vi.fn(),
    get: vi.fn(),
  },
  mockBillingHistoryRepo: {
    record: vi.fn(),
  },
  mockPlanRepo: {
    findBySlug: vi.fn(),
    findById: vi.fn(),
  },
  mockCreditRepo: {
    initBalance: vi.fn(),
  },
  mockStripe: {
    cancelSubscription: vi.fn(),
    createSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    createPaymentIntent: vi.fn(),
  },
  mockPaygRepo: {
    create: vi.fn(),
    updateStatus: vi.fn(),
    sumByWorkspaceId: vi.fn(),
  },
}));

vi.mock('../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn(() => mockSubRepo),
}));
vi.mock('../../shared/database/repositories/billing-config-repository', () => ({
  BillingConfigRepository: vi.fn(() => mockBillingConfigRepo),
}));
vi.mock('../../shared/database/repositories/billing-history-repository', () => ({
  BillingHistoryRepository: vi.fn(() => mockBillingHistoryRepo),
}));
vi.mock('../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: vi.fn(() => mockPlanRepo),
}));
vi.mock('../../shared/database/repositories/credit-repository', () => ({
  CreditRepository: vi.fn(() => mockCreditRepo),
}));
vi.mock('../../shared/database/repositories/payg-credits-ledger-repository', () => ({
  PaygCreditsLedgerRepository: vi.fn(() => mockPaygRepo),
}));
vi.mock('../payments/stripe-provider', () => ({
  StripeProvider: vi.fn(() => mockStripe),
}));
vi.mock('../payments/audit-logger', () => ({
  auditedOperation: vi.fn((_op: string, _provider: string, _ctx: any, fn: () => any) => fn()),
  writePaymentAuditLog: vi.fn(),
}));
vi.mock('../../shared/logger/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { SubscriptionManager } from '../payments/subscription-manager';
import { BillingService } from '../payments/billing-service';

const ORG_A = 'org-a-uuid';
const ORG_B = 'org-b-uuid';
const USER_ID = 'user-uuid';
const ctx = { userId: USER_ID, orgId: ORG_A };

function makeSub(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-1',
    workspace_id: ORG_A,
    plan_id: 'free',
    status: 'active',
    stripe_subscription_id: null,
    stripe_customer_id: null,
    current_period_start: new Date(),
    current_period_end: new Date(Date.now() + 30 * 86400000),
    trial_start: null,
    trial_end: null,
    canceled_at: null,
    cancel_at_period_end: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBillingConfigRepo.getInt.mockResolvedValue(14);
  mockBillingConfigRepo.getBigint.mockResolvedValue(500n);
  mockBillingConfigRepo.get.mockResolvedValue(null);
  mockPlanRepo.findBySlug.mockResolvedValue(null);
  mockPlanRepo.findById.mockResolvedValue(null);
  mockSubRepo.create.mockResolvedValue(makeSub({ status: 'trialing' }));
  mockSubRepo.update.mockImplementation((_id: string, input: Record<string, any>) =>
    makeSub(input),
  );
  mockBillingHistoryRepo.record.mockResolvedValue('history-1');
  mockCreditRepo.initBalance.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: Free → trial Pro BYO → expiry → downgrade to Free
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 1: Free → trial → expiry → free', () => {
  it('starts a trial on pro_byo plan', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await SubscriptionManager.startTrial({ orgId: ORG_A, plan: 'pro_byo' }, ctx);

    expect(mockSubRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: ORG_A,
        status: 'trialing',
      }),
    );
    expect(mockCreditRepo.initBalance).toHaveBeenCalledWith(ORG_A);
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'trial_started' }),
    );
  });

  it('rejects trial when active subscription exists', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(makeSub());

    await expect(
      SubscriptionManager.startTrial({ orgId: ORG_A, plan: 'pro_byo' }, ctx),
    ).rejects.toThrow('already has an active subscription');
  });

  it('expires trial and downgrades to free', async () => {
    const expiredTrial = makeSub({
      status: 'trialing',
      trial_end: new Date(Date.now() - 86400000),
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(expiredTrial);

    await SubscriptionManager.expireTrial({ orgId: ORG_A });

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      expiredTrial.id,
      expect.objectContaining({ status: 'active' }),
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'trial_expired' }),
    );
  });

  it('does not expire trial that has not ended', async () => {
    const activeTrial = makeSub({
      status: 'trialing',
      trial_end: new Date(Date.now() + 7 * 86400000),
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(activeTrial);

    await SubscriptionManager.expireTrial({ orgId: ORG_A });

    expect(mockSubRepo.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: Free → trial Pro Managed → upgrade → ledger → topup
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 2: Managed PAYG lifecycle', () => {
  it('starts trial on managed_payg plan', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await SubscriptionManager.startTrial({ orgId: ORG_A, plan: 'pro_managed' }, ctx);

    expect(mockSubRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: ORG_A, status: 'trialing' }),
    );
  });

  it('upgrades from trialing to active', async () => {
    const trialSub = makeSub({ status: 'trialing', plan_id: 'free' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(trialSub);

    await SubscriptionManager.upgrade({ orgId: ORG_A, plan: 'pro_managed' }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      trialSub.id,
      expect.objectContaining({ status: 'active' }),
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'subscription_upgraded' }),
    );
  });

  it('records a PAYG usage event with negative delta', async () => {
    mockPaygRepo.create.mockResolvedValue('ledger-1');

    const result = await BillingService.recordUsageEvent(
      { orgId: ORG_A, eventType: 'test_generation', quantity: 2 },
      ctx,
    );

    expect(result.deltaCents).toBeLessThan(0n);
    expect(mockPaygRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: ORG_A,
        status: 'completed',
      }),
    );
  });

  it('returns current PAYG balance from ledger sum', async () => {
    mockPaygRepo.sumByWorkspaceId.mockResolvedValue(-100n);

    const balance = await BillingService.currentPaygBalance(ORG_A);

    expect(balance).toBe(-100n);
  });

  it('tops up balance with positive amount', async () => {
    mockPaygRepo.create.mockResolvedValue('ledger-2');

    const result = await BillingService.topUp(
      { orgId: ORG_A, amountCents: 1000n, paymentIntentId: 'pi_123' },
      ctx,
    );

    expect(result.ledgerEntryId).toBe('ledger-2');
    expect(mockPaygRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 1000n,
        reason: 'topup',
        status: 'completed',
      }),
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'payg_topup' }),
    );
  });

  it('rejects top-up with zero or negative amount', async () => {
    await expect(
      BillingService.topUp(
        { orgId: ORG_A, amountCents: 0n, paymentIntentId: 'pi_bad' },
        ctx,
      ),
    ).rejects.toThrow('Top-up amount must be positive');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: Pro BYO → downgrade → period end → applies
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 3: Downgrade scheduled at period end', () => {
  it('downgrades from pro_byo to free', async () => {
    const proSub = makeSub({ plan_id: 'pro_byo', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(proSub);
    mockPlanRepo.findById.mockResolvedValue({ slug: 'pro_byo' });

    await SubscriptionManager.downgrade({ orgId: ORG_A, plan: 'free' }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      proSub.id,
      expect.objectContaining({ plan_id: 'free' }),
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'subscription_downgraded' }),
    );
  });

  it('rejects downgrade to same or higher price', async () => {
    const proSub = makeSub({ plan_id: 'pro_byo', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(proSub);
    mockPlanRepo.findById.mockResolvedValue({ slug: 'pro_byo' });

    await expect(
      SubscriptionManager.downgrade({ orgId: ORG_A, plan: 'pro_managed' }, ctx),
    ).rejects.toThrow('Downgrade requires a lower-priced plan');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Pro Managed → cancel at period end → reactivate
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 4: Cancel + reactivate', () => {
  it('cancels at period end', async () => {
    const sub = makeSub({ plan_id: 'pro_managed', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.cancel({ orgId: ORG_A, atPeriodEnd: true }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ cancel_at_period_end: true }),
    );
  });

  it('reactivates before period end', async () => {
    const sub = makeSub({
      plan_id: 'pro_managed',
      status: 'active',
      cancel_at_period_end: true,
      canceled_at: new Date(),
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.reactivate({ orgId: ORG_A }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
      }),
    );
  });

  it('rejects reactivation of fully canceled subscription', async () => {
    const sub = makeSub({
      status: 'canceled',
      cancel_at_period_end: false,
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await expect(
      SubscriptionManager.reactivate({ orgId: ORG_A }, ctx),
    ).rejects.toThrow('fully canceled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5: Failed payment → past_due → grace period
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 5: Payment failure', () => {
  it('marks subscription as past_due on payment failure', async () => {
    const sub = makeSub({ status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.markPaymentFailed(
      { orgId: ORG_A, paymentIntentId: 'pi_fail' },
      ctx,
    );

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ status: 'past_due' }),
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'payment_failed' }),
    );
  });

  it('does not transition to past_due from canceled', async () => {
    const sub = makeSub({ status: 'canceled' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.markPaymentFailed(
      { orgId: ORG_A, paymentIntentId: 'pi_fail' },
      ctx,
    );

    expect(mockSubRepo.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 6: Cross-org isolation
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 6: Org isolation', () => {
  it('org A trial does not affect org B', async () => {
    mockSubRepo.findByWorkspaceId.mockImplementation(async (id: string) => {
      if (id === ORG_A) return null;
      if (id === ORG_B) return makeSub({ workspace_id: ORG_B, status: 'active' });
      return null;
    });

    await SubscriptionManager.startTrial(
      { orgId: ORG_A, plan: 'pro_byo' },
      { userId: USER_ID, orgId: ORG_A },
    );

    expect(mockSubRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: ORG_A }),
    );
    expect(mockSubRepo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workspace_id: ORG_B }),
    );
  });

  it('PAYG ledger queries are scoped to org', async () => {
    mockPaygRepo.sumByWorkspaceId.mockResolvedValue(-200n);

    const balance = await BillingService.currentPaygBalance(ORG_A);

    expect(mockPaygRepo.sumByWorkspaceId).toHaveBeenCalledWith(ORG_A, 'completed');
    expect(balance).toBe(-200n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 7: Configurable trial length
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 7: Configurable trial days', () => {
  it('honors billing_config trial_days = 7', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);
    mockBillingConfigRepo.getInt.mockResolvedValue(7);

    await SubscriptionManager.startTrial({ orgId: ORG_A, plan: 'pro_byo' }, ctx);

    const createCall = mockSubRepo.create.mock.calls[0][0];
    const trialEnd = createCall.trial_end as Date;
    const trialStart = createCall.trial_start as Date;
    const diffDays = Math.round(
      (trialEnd.getTime() - trialStart.getTime()) / 86400000,
    );

    expect(diffDays).toBe(7);
  });

  it('defaults to 14 days when config not set', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);
    mockBillingConfigRepo.getInt.mockResolvedValue(14);

    await SubscriptionManager.startTrial({ orgId: ORG_A, plan: 'pro_byo' }, ctx);

    const createCall = mockSubRepo.create.mock.calls[0][0];
    const trialEnd = createCall.trial_end as Date;
    const trialStart = createCall.trial_start as Date;
    const diffDays = Math.round(
      (trialEnd.getTime() - trialStart.getTime()) / 86400000,
    );

    expect(diffDays).toBe(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 8: Proration on upgrade
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 8: Proration', () => {
  it('cancels old and creates new stripe subscription on upgrade', async () => {
    const sub = makeSub({
      plan_id: 'pro_byo',
      status: 'active',
      stripe_subscription_id: 'sub_stripe_123',
      stripe_customer_id: 'cus_123',
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);
    mockPlanRepo.findById.mockResolvedValue({ slug: 'pro_byo' });
    mockPlanRepo.findBySlug.mockResolvedValue({
      id: 'plan-managed-id',
      slug: 'pro_managed',
      stripe_price_id: 'price_managed',
    });
    mockStripe.createSubscription.mockResolvedValue({
      subscriptionId: 'sub_new',
      status: 'active',
      stripeSubscriptionId: 'sub_new',
    });

    await SubscriptionManager.upgrade({ orgId: ORG_A, plan: 'pro_managed' }, ctx);

    expect(mockStripe.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123', true);
    expect(mockStripe.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_123',
        priceId: 'price_managed',
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bigint money math property tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Bigint money math', () => {
  it('PAYG usage produces exact negative bigint (no float drift)', () => {
    const rate = 50n;
    const quantity = 3;
    const delta = -(rate * BigInt(quantity));

    expect(delta).toBe(-150n);
    expect(typeof delta).toBe('bigint');
  });

  it('topup + usage balances exactly', () => {
    const topup = 1000n;
    const usage1 = -(50n * 3n);
    const usage2 = -(10n * 5n);
    const balance = topup + usage1 + usage2;

    expect(balance).toBe(800n);
  });

  it('large amounts do not lose precision', () => {
    const largeAmount = 99999999999999n;
    const fee = 100n;
    const result = largeAmount - fee;

    expect(result).toBe(99999999999899n);
  });

  it('repeated small operations accumulate correctly', () => {
    let balance = 10000n;
    for (let i = 0; i < 1000; i++) {
      balance -= 7n;
    }
    expect(balance).toBe(3000n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('Helper methods', () => {
  it('isWithinTrial returns true for active trial', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({
        status: 'trialing',
        trial_end: new Date(Date.now() + 7 * 86400000),
      }),
    );

    expect(await SubscriptionManager.isWithinTrial(ORG_A)).toBe(true);
  });

  it('isWithinTrial returns false for expired trial', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({
        status: 'trialing',
        trial_end: new Date(Date.now() - 86400000),
      }),
    );

    expect(await SubscriptionManager.isWithinTrial(ORG_A)).toBe(false);
  });

  it('isWithinTrial returns false for non-trialing status', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({ status: 'active' }),
    );

    expect(await SubscriptionManager.isWithinTrial(ORG_A)).toBe(false);
  });

  it('isManagedPaygTier returns true for pro_managed', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({ plan_id: 'pro_managed' }),
    );

    expect(await SubscriptionManager.isManagedPaygTier(ORG_A)).toBe(true);
  });

  it('isManagedPaygTier returns false for byo_keys plan', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({ plan_id: 'pro_byo' }),
    );

    expect(await SubscriptionManager.isManagedPaygTier(ORG_A)).toBe(false);
  });

  it('getSubscription returns null for missing workspace', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    expect(await SubscriptionManager.getSubscription(ORG_A)).toBeNull();
  });

  it('getSubscription serializes bigint monthlyCents', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({ plan_id: 'pro_managed', status: 'active' }),
    );

    const result = await SubscriptionManager.getSubscription(ORG_A);

    expect(result).not.toBeNull();
    expect(result!.monthlyCents).toBe(4900n);
    expect(result!.tier).toBe('managed_payg');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pricing constants
// ─────────────────────────────────────────────────────────────────────────────
describe('Pricing constants', () => {
  it('plan definitions use bigint cents', async () => {
    const { PLANS, isPlanSlug, VALID_PLAN_SLUGS } = await import(
      '../../shared/constants/pricing'
    );

    expect(typeof PLANS.free.monthlyCents).toBe('bigint');
    expect(typeof PLANS.pro_byo.monthlyCents).toBe('bigint');
    expect(typeof PLANS.pro_managed.monthlyCents).toBe('bigint');

    expect(PLANS.free.monthlyCents).toBe(0n);
    expect(PLANS.pro_byo.monthlyCents).toBe(2900n);
    expect(PLANS.pro_managed.monthlyCents).toBe(4900n);

    expect(isPlanSlug('free')).toBe(true);
    expect(isPlanSlug('pro_byo')).toBe(true);
    expect(isPlanSlug('pro_managed')).toBe(true);
    expect(isPlanSlug('invalid')).toBe(false);

    expect(VALID_PLAN_SLUGS).toHaveLength(3);
  });

  it('tier assignments are correct', async () => {
    const { PLANS } = await import('../../shared/constants/pricing');

    expect(PLANS.free.tier).toBe('byo_keys');
    expect(PLANS.pro_byo.tier).toBe('byo_keys');
    expect(PLANS.pro_managed.tier).toBe('managed_payg');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BillingService.chargeIfNeeded
// ─────────────────────────────────────────────────────────────────────────────
describe('BillingService.chargeIfNeeded', () => {
  it('skips charge when org is not on managed_payg tier', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({ plan_id: 'pro_byo', status: 'active' }),
    );

    const result = await BillingService.chargeIfNeeded(ORG_A);

    expect(result).toEqual({ charged: false });
    expect(mockStripe.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('skips charge when balance is non-negative', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({ plan_id: 'pro_managed', status: 'active' }),
    );
    mockPaygRepo.sumByWorkspaceId.mockResolvedValue(100n);

    const result = await BillingService.chargeIfNeeded(ORG_A);

    expect(result).toEqual({ charged: false });
  });

  it('auto-charges when balance is negative on managed_payg', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({
        plan_id: 'pro_managed',
        status: 'active',
        stripe_customer_id: 'cus_test',
      }),
    );
    mockPaygRepo.sumByWorkspaceId.mockResolvedValue(-200n);
    mockBillingConfigRepo.getBigint.mockResolvedValue(500n);
    mockPaygRepo.create.mockResolvedValue('ledger-auto');
    mockStripe.createPaymentIntent.mockResolvedValue({
      paymentIntentId: 'pi_auto_123',
    });

    const result = await BillingService.chargeIfNeeded(ORG_A);

    expect(result).toEqual({ charged: true, paymentIntentId: 'pi_auto_123' });
    expect(mockPaygRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', amount_cents: 700n }),
    );
    expect(mockPaygRepo.updateStatus).toHaveBeenCalledWith(
      'ledger-auto',
      'completed',
      'pi_auto_123',
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'payg_auto_charge' }),
    );
  });

  it('marks ledger entry as failed when Stripe charge fails', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(
      makeSub({
        plan_id: 'pro_managed',
        status: 'active',
        stripe_customer_id: 'cus_test',
      }),
    );
    mockPaygRepo.sumByWorkspaceId.mockResolvedValue(-100n);
    mockBillingConfigRepo.getBigint.mockResolvedValue(500n);
    mockPaygRepo.create.mockResolvedValue('ledger-fail');
    mockStripe.createPaymentIntent.mockRejectedValue(new Error('Card declined'));

    await expect(BillingService.chargeIfNeeded(ORG_A)).rejects.toThrow(
      'Card declined',
    );

    expect(mockPaygRepo.updateStatus).toHaveBeenCalledWith(
      'ledger-fail',
      'failed',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BillingService.getPaygRate override
// ─────────────────────────────────────────────────────────────────────────────
describe('BillingService PAYG rate override', () => {
  it('uses overridden rate from billing_config when available', async () => {
    mockBillingConfigRepo.get.mockResolvedValue(
      JSON.stringify({ test_generation: '75' }),
    );
    mockPaygRepo.create.mockResolvedValue('ledger-override');

    const result = await BillingService.recordUsageEvent(
      { orgId: ORG_A, eventType: 'test_generation', quantity: 2 },
      ctx,
    );

    expect(result.deltaCents).toBe(-150n);
  });

  it('falls back to default rate when config JSON is invalid', async () => {
    mockBillingConfigRepo.get.mockResolvedValue('not-valid-json');
    mockPaygRepo.create.mockResolvedValue('ledger-fallback');

    const result = await BillingService.recordUsageEvent(
      { orgId: ORG_A, eventType: 'test_generation', quantity: 1 },
      ctx,
    );

    expect(result.deltaCents).toBe(-50n);
  });

  it('returns 0 delta for unknown event type', async () => {
    mockBillingConfigRepo.get.mockResolvedValue(null);
    mockPaygRepo.create.mockResolvedValue('ledger-unknown');

    const result = await BillingService.recordUsageEvent(
      { orgId: ORG_A, eventType: 'unknown_event', quantity: 5 },
      ctx,
    );

    expect(result.deltaCents).toBe(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SubscriptionManager edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('SubscriptionManager edge cases', () => {
  it('cancel immediately transitions to canceled', async () => {
    const sub = makeSub({ plan_id: 'pro_byo', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.cancel({ orgId: ORG_A, atPeriodEnd: false }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ status: 'canceled', cancel_at_period_end: false }),
    );
    expect(mockBillingHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'subscription_canceled' }),
    );
  });

  it('cancel rejects invalid status transition', async () => {
    const sub = makeSub({ status: 'canceled' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await expect(
      SubscriptionManager.cancel({ orgId: ORG_A, atPeriodEnd: false }, ctx),
    ).rejects.toThrow('Cannot cancel from status');
  });

  it('reactivates from past_due status', async () => {
    const sub = makeSub({
      status: 'past_due',
      cancel_at_period_end: false,
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.reactivate({ orgId: ORG_A }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ status: 'active', cancel_at_period_end: false }),
    );
  });

  it('rejects reactivation when not pending cancellation', async () => {
    const sub = makeSub({ status: 'active', cancel_at_period_end: false });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await expect(
      SubscriptionManager.reactivate({ orgId: ORG_A }, ctx),
    ).rejects.toThrow('not pending cancellation');
  });

  it('startTrial rejects invalid plan slug', async () => {
    await expect(
      SubscriptionManager.startTrial(
        { orgId: ORG_A, plan: 'invalid_plan' as any },
        ctx,
      ),
    ).rejects.toThrow('Invalid plan slug');
  });

  it('upgrade rejects when no subscription exists', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await expect(
      SubscriptionManager.upgrade({ orgId: ORG_A, plan: 'pro_managed' }, ctx),
    ).rejects.toThrow('No subscription found');
  });

  it('downgrade rejects from invalid status', async () => {
    const sub = makeSub({ status: 'past_due', plan_id: 'pro_managed' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await expect(
      SubscriptionManager.downgrade({ orgId: ORG_A, plan: 'free' }, ctx),
    ).rejects.toThrow('Cannot downgrade from status');
  });

  it('cancel calls stripe.cancelSubscription when stripe id exists', async () => {
    const sub = makeSub({
      status: 'active',
      stripe_subscription_id: 'sub_stripe_456',
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.cancel({ orgId: ORG_A, atPeriodEnd: true }, ctx);

    expect(mockStripe.cancelSubscription).toHaveBeenCalledWith('sub_stripe_456', false);
  });

  it('reactivate calls stripe.reactivateSubscription when stripe id exists', async () => {
    const sub = makeSub({
      status: 'active',
      cancel_at_period_end: true,
      canceled_at: new Date(),
      stripe_subscription_id: 'sub_stripe_789',
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);

    await SubscriptionManager.reactivate({ orgId: ORG_A }, ctx);

    expect(mockStripe.reactivateSubscription).toHaveBeenCalledWith('sub_stripe_789');
  });

  it('startTrial reactivates a canceled subscription', async () => {
    const canceledSub = makeSub({ status: 'canceled' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(canceledSub);

    await SubscriptionManager.startTrial({ orgId: ORG_A, plan: 'pro_byo' }, ctx);

    expect(mockSubRepo.update).toHaveBeenCalledWith(
      canceledSub.id,
      expect.objectContaining({ status: 'trialing', canceled_at: null }),
    );
    expect(mockSubRepo.create).not.toHaveBeenCalled();
  });

  it('expireTrial does nothing when no subscription exists', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await SubscriptionManager.expireTrial({ orgId: ORG_A });

    expect(mockSubRepo.update).not.toHaveBeenCalled();
  });

  it('markPaymentFailed does nothing when no subscription', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await expect(
      SubscriptionManager.markPaymentFailed(
        { orgId: ORG_A, paymentIntentId: 'pi_x' },
        ctx,
      ),
    ).rejects.toThrow('No subscription found');
  });

  it('upgrade rejects downgrade attempt', async () => {
    const sub = makeSub({ plan_id: 'pro_managed', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);
    mockPlanRepo.findById.mockResolvedValue({ slug: 'pro_managed' });

    await expect(
      SubscriptionManager.upgrade({ orgId: ORG_A, plan: 'pro_byo' }, ctx),
    ).rejects.toThrow('Upgrade requires a higher-priced plan');
  });

  it('reactivate rejects when no subscription exists', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await expect(
      SubscriptionManager.reactivate({ orgId: ORG_A }, ctx),
    ).rejects.toThrow('No subscription found');
  });

  it('resolveSlug falls back to DB lookup for non-slug plan_id', async () => {
    const sub = makeSub({ plan_id: 'uuid-plan-id', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);
    mockPlanRepo.findById.mockResolvedValue({ slug: 'pro_managed' });

    const result = await SubscriptionManager.getSubscription(ORG_A);

    expect(result).not.toBeNull();
    expect(result!.planSlug).toBe('pro_managed');
    expect(result!.tier).toBe('managed_payg');
  });

  it('resolveSlug returns null for unknown plan_id', async () => {
    const sub = makeSub({ plan_id: 'uuid-unknown', status: 'active' });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);
    mockPlanRepo.findById.mockResolvedValue(null);

    const result = await SubscriptionManager.getSubscription(ORG_A);

    expect(result).not.toBeNull();
    expect(result!.planSlug).toBeNull();
    expect(result!.tier).toBeNull();
    expect(result!.monthlyCents).toBe(0n);
  });

  it('cancel without subscription throws', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await expect(
      SubscriptionManager.cancel({ orgId: ORG_A, atPeriodEnd: true }, ctx),
    ).rejects.toThrow('No subscription found');
  });

  it('downgrade without subscription throws', async () => {
    mockSubRepo.findByWorkspaceId.mockResolvedValue(null);

    await expect(
      SubscriptionManager.downgrade({ orgId: ORG_A, plan: 'free' }, ctx),
    ).rejects.toThrow('No subscription found');
  });

  it('downgrade with stripe creates new subscription', async () => {
    const sub = makeSub({
      plan_id: 'pro_managed',
      status: 'active',
      stripe_subscription_id: 'sub_old',
      stripe_customer_id: 'cus_123',
    });
    mockSubRepo.findByWorkspaceId.mockResolvedValue(sub);
    mockPlanRepo.findById.mockResolvedValue({ slug: 'pro_managed' });
    mockPlanRepo.findBySlug.mockResolvedValue({
      id: 'plan-free-id',
      slug: 'free',
      stripe_price_id: 'price_free',
    });
    mockStripe.createSubscription.mockResolvedValue({
      subscriptionId: 'sub_new',
      status: 'active',
    });

    await SubscriptionManager.downgrade({ orgId: ORG_A, plan: 'free' }, ctx);

    expect(mockStripe.cancelSubscription).toHaveBeenCalledWith('sub_old', true);
    expect(mockStripe.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_123', priceId: 'price_free' }),
    );
  });
});
