import { PaygCreditsLedgerRepository } from '../../shared/database/repositories/payg-credits-ledger-repository';
import { BillingConfigRepository } from '../../shared/database/repositories/billing-config-repository';
import { BillingHistoryRepository } from '../../shared/database/repositories/billing-history-repository';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { ReconScanRepository } from '../../shared/database/repositories/recon-scan-repository';
import { StripeProvider } from './stripe-provider';
import { auditedOperation } from './audit-logger';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';
import { DEFAULT_PAYG_RATES } from '../../shared/constants/pricing';
import { SubscriptionManager } from './subscription-manager';
import { resolveWorkspaceRecipient } from '../emails/notification-helper';
import { sendCreditsLowEmail } from '../emails/credits-low';
import { sendPaymentSuccessEmail } from '../emails/payment-success';

const logger = createLogger('billing-service');

const paygRepo = new PaygCreditsLedgerRepository();
const billingConfigRepo = new BillingConfigRepository();
const billingHistoryRepo = new BillingHistoryRepository();
const planRepo = new PlanRepository();
const subscriptionRepo = new SubscriptionRepository();
const reconScanRepo = new ReconScanRepository();
const stripe = new StripeProvider();

export interface UsageEventParams {
  orgId: string;
  eventType: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface TopUpParams {
  orgId: string;
  amountCents: bigint;
  paymentIntentId: string;
}

export class BillingService {
  static async recordUsageEvent(params: UsageEventParams, ctx: { userId: string; orgId: string }): Promise<{ ledgerEntryId: string; deltaCents: bigint }> {
    return auditedOperation('recordUsageEvent', 'stripe', ctx, async () => {
      const rate = await this.getPaygRate(params.eventType);
      const deltaCents = -(rate * BigInt(params.quantity));

      const ledgerEntryId = await paygRepo.create({
        workspace_id: params.orgId,
        amount_cents: deltaCents,
        reason: params.eventType,
        related_event_id: params.metadata?.eventId as string ?? null,
        status: 'completed',
      });

      logger.info('Usage event recorded', {
        orgId: params.orgId,
        eventType: params.eventType,
        quantity: params.quantity,
        deltaCents: deltaCents.toString(),
      });

      const currentBalance = await paygRepo.sumByWorkspaceId(params.orgId, 'completed');
      const lowThreshold = await billingConfigRepo.getBigint('credits_low_threshold_cents', 1000n);
      if (currentBalance < lowThreshold) {
        const recipient = await resolveWorkspaceRecipient(params.orgId);
        if (recipient) {
          sendCreditsLowEmail({
            recipient,
            currentBalance: currentBalance.toString(),
            threshold: lowThreshold.toString(),
            topUpUrl: `${env.APP_URL}/settings?tab=billing`,
          }).catch(() => {});
        }
      }

      return { ledgerEntryId, deltaCents };
    }, { amountCents: -(BigInt(params.quantity) * (DEFAULT_PAYG_RATES[params.eventType] ?? 0n)) });
  }

  static async currentPaygBalance(orgId: string): Promise<bigint> {
    return paygRepo.sumByWorkspaceId(orgId, 'completed');
  }

  static async topUp(params: TopUpParams, ctx: { userId: string; orgId: string }): Promise<{ ledgerEntryId: string }> {
    return auditedOperation('topUp', 'stripe', ctx, async () => {
      if (params.amountCents <= 0n) {
        throw new Error('Top-up amount must be positive');
      }

      const ledgerEntryId = await paygRepo.create({
        workspace_id: params.orgId,
        amount_cents: params.amountCents,
        reason: 'topup',
        related_event_id: params.paymentIntentId,
        status: 'completed',
      });

      await paygRepo.updateStatus(ledgerEntryId, 'completed', params.paymentIntentId);

      await billingHistoryRepo.record({
        workspace_id: params.orgId,
        event_type: 'payg_topup',
        provider: 'stripe',
        amount_cents: params.amountCents,
        metadata: { payment_intent_id: params.paymentIntentId },
      });

      logger.info('PAYG top-up completed', {
        orgId: params.orgId,
        amountCents: params.amountCents.toString(),
        paymentIntentId: params.paymentIntentId,
      });

      const recipient = await resolveWorkspaceRecipient(params.orgId);
      if (recipient) {
        sendPaymentSuccessEmail({
          recipient,
          amount: `$${(Number(params.amountCents) / 100).toFixed(2)}`,
          plan: 'PAYG Top-up',
        }).catch(() => {});
      }

      return { ledgerEntryId };
    }, { amountCents: params.amountCents });
  }

  static async chargeIfNeeded(orgId: string): Promise<{ charged: boolean; paymentIntentId?: string }> {
    const isManaged = await SubscriptionManager.isManagedPaygTier(orgId);
    if (!isManaged) return { charged: false };

    const balance = await this.currentPaygBalance(orgId);
    if (balance >= 0n) return { charged: false };

    const bufferCents = await billingConfigRepo.getBigint('payg_charge_buffer_cents', 500n);
    const chargeAmount = -balance + bufferCents;

    const ledgerEntryId = await paygRepo.create({
      workspace_id: orgId,
      amount_cents: chargeAmount,
      reason: 'auto_charge',
      related_event_id: null,
      status: 'pending',
    });

    try {
      const result = await stripe.createPaymentIntent({
        amountCents: chargeAmount,
        currency: 'usd',
        customerId: await this.resolveStripeCustomer(orgId),
        metadata: {
          workspace_id: orgId,
          ledger_entry_id: ledgerEntryId,
          type: 'payg_auto_charge',
        },
      });

      await paygRepo.updateStatus(ledgerEntryId, 'completed', result.paymentIntentId);

      await billingHistoryRepo.record({
        workspace_id: orgId,
        event_type: 'payg_auto_charge',
        provider: 'stripe',
        amount_cents: chargeAmount,
        metadata: { payment_intent_id: result.paymentIntentId },
      });

      logger.info('PAYG auto-charge completed', {
        orgId,
        chargeAmount: chargeAmount.toString(),
        paymentIntentId: result.paymentIntentId,
      });

      return { charged: true, paymentIntentId: result.paymentIntentId };
    } catch (error) {
      await paygRepo.updateStatus(ledgerEntryId, 'failed');

      logger.error('PAYG auto-charge failed', error, { orgId });
      throw error;
    }
  }

  static async getReconScansThisMonth(workspaceId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return reconScanRepo.countCreatedSince(workspaceId, startOfMonth);
  }

  static async checkReconQuota(workspaceId: string): Promise<{
    included_remaining: number;
    payg_per_scan_credits: bigint;
  }> {
    const perScan = await this.getPaygRate('recon_scan_run');

    const sub = await subscriptionRepo.findByWorkspaceId(workspaceId);
    let included = 0;
    if (sub) {
      const features = await planRepo.getFeatures(sub.plan_id);
      const limitFeature = features.find((f) => f.feature_key === 'recon_monthly_scans');
      if (limitFeature) {
        const parsed = parseInt(limitFeature.feature_value, 10);
        if (!Number.isNaN(parsed) && parsed > 0) included = parsed;
      }
    }

    const used = await this.getReconScansThisMonth(workspaceId);
    const remaining = Math.max(0, included - used);

    return { included_remaining: remaining, payg_per_scan_credits: perScan };
  }

  private static async getPaygRate(eventType: string): Promise<bigint> {
    const ratesJson = await billingConfigRepo.get('payg_rates');
    if (ratesJson) {
      try {
        const overrides = JSON.parse(ratesJson) as Record<string, string>;
        if (eventType in overrides) {
          return BigInt(overrides[eventType]);
        }
      } catch {
        logger.warn('Failed to parse payg_rates config, using defaults');
      }
    }
    return DEFAULT_PAYG_RATES[eventType] ?? 0n;
  }

  private static async resolveStripeCustomer(orgId: string): Promise<string> {
    const { SubscriptionRepository } = await import('../../shared/database/repositories/subscription-repository');
    const subRepo = new SubscriptionRepository();
    const sub = await subRepo.findByWorkspaceId(orgId);
    if (!sub?.stripe_customer_id) {
      throw new Error('No Stripe customer found for workspace');
    }
    return sub.stripe_customer_id;
  }
}
