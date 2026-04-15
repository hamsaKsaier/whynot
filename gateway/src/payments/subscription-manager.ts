import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { BillingConfigRepository } from '../../shared/database/repositories/billing-config-repository';
import { BillingHistoryRepository } from '../../shared/database/repositories/billing-history-repository';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { CreditRepository } from '../../shared/database/repositories/credit-repository';
import { StripeProvider } from './stripe-provider';
import { auditedOperation } from './audit-logger';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';
import { PLANS, DEFAULT_TRIAL_DAYS, isPlanSlug, type PlanSlug } from '../../shared/constants/pricing';
import type { SubscriptionStatus } from './types';
import { resolveWorkspaceRecipient } from '../emails/notification-helper';
import { sendSubscriptionCreatedEmail } from '../emails/subscription-created';
import { sendPaymentFailedEmail } from '../emails/payment-failed';
import { sendTrialEndingEmail } from '../emails/trial-ending';

const logger = createLogger('subscription-manager');

const subscriptionRepo = new SubscriptionRepository();
const billingConfigRepo = new BillingConfigRepository();
const billingHistoryRepo = new BillingHistoryRepository();
const planRepo = new PlanRepository();
const creditRepo = new CreditRepository();
const stripe = new StripeProvider();

const VALID_TRANSITIONS: Record<string, SubscriptionStatus[]> = {
  trialing: ['active', 'canceled', 'incomplete'],
  active: ['past_due', 'canceled', 'paused'],
  past_due: ['active', 'canceled'],
  paused: ['active', 'canceled'],
  canceled: [],
  incomplete: ['active', 'canceled'],
};

function isValidTransition(from: string, to: SubscriptionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface SubscriptionManagerContext {
  userId: string;
  orgId: string;
}

export class SubscriptionManager {
  static async startTrial(params: {
    orgId: string;
    plan: PlanSlug;
  }, ctx: SubscriptionManagerContext): Promise<void> {
    return auditedOperation('startTrial', 'stripe', ctx, async () => {
      if (!isPlanSlug(params.plan)) {
        throw new Error(`Invalid plan slug: ${params.plan}`);
      }

      const existing = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (existing && existing.status !== 'canceled') {
        throw new Error('Workspace already has an active subscription');
      }

      const trialDays = await billingConfigRepo.getInt('trial_days', DEFAULT_TRIAL_DAYS);
      const now = new Date();
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

      const planDef = PLANS[params.plan];
      const dbPlan = await planRepo.findBySlug(params.plan);
      const planId = dbPlan?.id ?? params.plan;

      if (existing && existing.status === 'canceled') {
        await subscriptionRepo.update(existing.id, {
          plan_id: planId,
          status: 'trialing',
          trial_start: now,
          trial_end: trialEnd,
          canceled_at: null,
          cancel_at_period_end: false,
        });
      } else {
        await subscriptionRepo.create({
          workspace_id: params.orgId,
          plan_id: planId,
          status: 'trialing',
          trial_start: now,
          trial_end: trialEnd,
        });
      }

      await creditRepo.initBalance(params.orgId);

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: 'trial_started',
        provider: 'stripe',
        metadata: {
          plan: params.plan,
          tier: planDef.tier,
          trial_days: trialDays,
          trial_end: trialEnd.toISOString(),
        },
      });

      logger.info('Trial started', {
        orgId: params.orgId,
        plan: params.plan,
        trialDays,
      });

      const recipient = await resolveWorkspaceRecipient(params.orgId);
      if (recipient) {
        sendSubscriptionCreatedEmail({
          recipient,
          plan: planDef.name,
          trialEnd: trialEnd.toISOString(),
          dashboardUrl: `${env.APP_URL}/settings?tab=billing`,
        }).catch(() => {});
      }
    });
  }

  static async upgrade(params: {
    orgId: string;
    plan: PlanSlug;
  }, ctx: SubscriptionManagerContext): Promise<void> {
    return auditedOperation('upgrade', 'stripe', ctx, async () => {
      if (!isPlanSlug(params.plan)) {
        throw new Error(`Invalid plan slug: ${params.plan}`);
      }

      const sub = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (!sub) {
        throw new Error('No subscription found for workspace');
      }

      const newPlanDef = PLANS[params.plan];
      const currentPlanSlug = await this.resolveSlug(sub.plan_id);
      const currentPlanDef = currentPlanSlug ? PLANS[currentPlanSlug] : null;

      if (currentPlanDef && newPlanDef.monthlyCents <= currentPlanDef.monthlyCents) {
        throw new Error('Upgrade requires a higher-priced plan');
      }

      const dbPlan = await planRepo.findBySlug(params.plan);
      const planId = dbPlan?.id ?? params.plan;

      if (sub.stripe_subscription_id && dbPlan?.stripe_price_id) {
        await stripe.cancelSubscription(sub.stripe_subscription_id, true);
        await stripe.createSubscription({
          customerId: sub.stripe_customer_id!,
          priceId: dbPlan.stripe_price_id,
          metadata: { workspace_id: params.orgId, plan: params.plan },
        });
      }

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await subscriptionRepo.update(sub.id, {
        plan_id: planId,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
        trial_end: sub.status === 'trialing' ? now : sub.trial_end ?? undefined,
        cancel_at_period_end: false,
        canceled_at: null,
      });

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: 'subscription_upgraded',
        provider: 'stripe',
        amount_cents: newPlanDef.monthlyCents,
        metadata: {
          from_plan: currentPlanSlug ?? sub.plan_id,
          to_plan: params.plan,
          tier: newPlanDef.tier,
          prorated: sub.status !== 'trialing',
        },
      });

      logger.info('Subscription upgraded', {
        orgId: params.orgId,
        from: currentPlanSlug ?? sub.plan_id,
        to: params.plan,
      });
    });
  }

  static async downgrade(params: {
    orgId: string;
    plan: PlanSlug;
  }, ctx: SubscriptionManagerContext): Promise<void> {
    return auditedOperation('downgrade', 'stripe', ctx, async () => {
      if (!isPlanSlug(params.plan)) {
        throw new Error(`Invalid plan slug: ${params.plan}`);
      }

      const sub = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (!sub) {
        throw new Error('No subscription found for workspace');
      }

      if (sub.status !== 'active' && sub.status !== 'trialing') {
        throw new Error(`Cannot downgrade from status: ${sub.status}`);
      }

      const newPlanDef = PLANS[params.plan];
      const currentPlanSlug = await this.resolveSlug(sub.plan_id);
      const currentPlanDef = currentPlanSlug ? PLANS[currentPlanSlug] : null;

      if (currentPlanDef && newPlanDef.monthlyCents >= currentPlanDef.monthlyCents) {
        throw new Error('Downgrade requires a lower-priced plan');
      }

      const dbPlan = await planRepo.findBySlug(params.plan);
      const planId = dbPlan?.id ?? params.plan;

      if (sub.stripe_subscription_id && dbPlan?.stripe_price_id) {
        await stripe.cancelSubscription(sub.stripe_subscription_id, true);
        await stripe.createSubscription({
          customerId: sub.stripe_customer_id!,
          priceId: dbPlan.stripe_price_id,
          metadata: { workspace_id: params.orgId, plan: params.plan },
        });
      }

      await subscriptionRepo.update(sub.id, {
        plan_id: planId,
        cancel_at_period_end: false,
      });

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: 'subscription_downgraded',
        provider: 'stripe',
        metadata: {
          from_plan: currentPlanSlug ?? sub.plan_id,
          to_plan: params.plan,
          tier: newPlanDef.tier,
          scheduled_at_period_end: true,
        },
      });

      logger.info('Subscription downgrade scheduled', {
        orgId: params.orgId,
        from: currentPlanSlug ?? sub.plan_id,
        to: params.plan,
      });
    });
  }

  static async cancel(params: {
    orgId: string;
    atPeriodEnd: boolean;
  }, ctx: SubscriptionManagerContext): Promise<void> {
    return auditedOperation('cancel', 'stripe', ctx, async () => {
      const sub = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (!sub) {
        throw new Error('No subscription found for workspace');
      }

      if (!isValidTransition(sub.status, 'canceled')) {
        throw new Error(`Cannot cancel from status: ${sub.status}`);
      }

      if (sub.stripe_subscription_id) {
        await stripe.cancelSubscription(sub.stripe_subscription_id, !params.atPeriodEnd);
      }

      if (params.atPeriodEnd) {
        await subscriptionRepo.update(sub.id, {
          cancel_at_period_end: true,
          canceled_at: new Date(),
        });
      } else {
        await subscriptionRepo.update(sub.id, {
          status: 'canceled',
          canceled_at: new Date(),
          cancel_at_period_end: false,
        });
      }

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: params.atPeriodEnd ? 'subscription_cancel_scheduled' : 'subscription_canceled',
        provider: 'stripe',
        metadata: { at_period_end: params.atPeriodEnd },
      });

      logger.info('Subscription canceled', {
        orgId: params.orgId,
        atPeriodEnd: params.atPeriodEnd,
      });
    });
  }

  static async reactivate(params: {
    orgId: string;
  }, ctx: SubscriptionManagerContext): Promise<void> {
    return auditedOperation('reactivate', 'stripe', ctx, async () => {
      const sub = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (!sub) {
        throw new Error('No subscription found for workspace');
      }

      if (sub.status === 'canceled' && !sub.cancel_at_period_end) {
        throw new Error('Subscription is fully canceled and cannot be reactivated');
      }

      if (!sub.cancel_at_period_end && sub.status !== 'past_due') {
        throw new Error('Subscription is not pending cancellation');
      }

      if (sub.stripe_subscription_id) {
        await stripe.reactivateSubscription(sub.stripe_subscription_id);
      }

      await subscriptionRepo.update(sub.id, {
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
      });

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: 'subscription_reactivated',
        provider: 'stripe',
      });

      logger.info('Subscription reactivated', { orgId: params.orgId });
    });
  }

  static async markPaymentFailed(params: {
    orgId: string;
    paymentIntentId: string;
  }, ctx: SubscriptionManagerContext): Promise<void> {
    return auditedOperation('markPaymentFailed', 'stripe', ctx, async () => {
      const sub = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (!sub) {
        throw new Error('No subscription found for workspace');
      }

      if (!isValidTransition(sub.status, 'past_due')) {
        logger.warn('Cannot transition to past_due', {
          orgId: params.orgId,
          currentStatus: sub.status,
        });
        return;
      }

      const graceDays = await billingConfigRepo.getInt('grace_period_days', 7);

      await subscriptionRepo.update(sub.id, {
        status: 'past_due',
      });

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: 'payment_failed',
        provider: 'stripe',
        metadata: {
          payment_intent_id: params.paymentIntentId,
          grace_period_days: graceDays,
        },
      });

      logger.warn('Payment failed, subscription marked past_due', {
        orgId: params.orgId,
        paymentIntentId: params.paymentIntentId,
        graceDays,
      });

      const recipient = await resolveWorkspaceRecipient(params.orgId);
      if (recipient) {
        sendPaymentFailedEmail({
          recipient,
          amount: '',
          updatePaymentUrl: `${env.APP_URL}/settings?tab=billing`,
        }).catch(() => {});
      }
    });
  }

  static async expireTrial(params: {
    orgId: string;
  }): Promise<void> {
    const sub = await subscriptionRepo.findByWorkspaceId(params.orgId);
    if (!sub) return;
    if (sub.status !== 'trialing') return;

    const now = new Date();
    if (sub.trial_end && sub.trial_end > now) return;

    const freePlan = await planRepo.findBySlug('free');
    const planId = freePlan?.id ?? 'free';

    await subscriptionRepo.update(sub.id, {
      plan_id: planId,
      status: 'active',
      trial_end: now,
      current_period_start: now,
      current_period_end: null as any,
    });

    await billingHistoryRepo.record({
      workspace_id: params.orgId,
      event_type: 'trial_expired',
      provider: 'stripe',
      metadata: { downgraded_to: 'free' },
    });

    logger.info('Trial expired, downgraded to free', { orgId: params.orgId });

    const recipient = await resolveWorkspaceRecipient(params.orgId);
    if (recipient) {
      sendTrialEndingEmail({
        recipient,
        plan: 'Free',
        trialEnd: now.toISOString(),
        daysRemaining: '0',
        upgradeUrl: `${env.APP_URL}/checkout`,
      }).catch(() => {});
    }
  }

  static async isWithinTrial(orgId: string): Promise<boolean> {
    const sub = await subscriptionRepo.findByWorkspaceId(orgId);
    if (!sub || sub.status !== 'trialing') return false;
    if (!sub.trial_end) return false;
    return sub.trial_end > new Date();
  }

  static async isManagedPaygTier(orgId: string): Promise<boolean> {
    const sub = await subscriptionRepo.findByWorkspaceId(orgId);
    if (!sub) return false;
    const slug = await this.resolveSlug(sub.plan_id);
    if (!slug) return false;
    return PLANS[slug].tier === 'managed_payg';
  }

  static async getSubscription(orgId: string) {
    const sub = await subscriptionRepo.findByWorkspaceId(orgId);
    if (!sub) return null;

    const slug = await this.resolveSlug(sub.plan_id);
    const planDef = slug ? PLANS[slug] : null;
    const isTrialing = sub.status === 'trialing' && sub.trial_end != null && sub.trial_end > new Date();

    return {
      id: sub.id,
      planId: sub.plan_id,
      planSlug: slug,
      planName: planDef?.name ?? null,
      tier: planDef?.tier ?? null,
      monthlyCents: planDef?.monthlyCents ?? 0n,
      status: sub.status,
      isTrialing,
      trialEnd: sub.trial_end?.toISOString() ?? null,
      currentPeriodStart: sub.current_period_start?.toISOString() ?? null,
      currentPeriodEnd: sub.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at?.toISOString() ?? null,
    };
  }

  private static async resolveSlug(planId: string): Promise<PlanSlug | null> {
    if (isPlanSlug(planId)) return planId;
    const plan = await planRepo.findById(planId);
    if (plan && isPlanSlug(plan.slug)) return plan.slug;
    return null;
  }
}
