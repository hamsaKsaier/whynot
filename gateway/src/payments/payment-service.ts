import { StripeProvider } from './stripe-provider';
import { PaymentServiceError } from './payment-error';
import { generateIdempotencyKey, checkIdempotencyKey, storeIdempotencyResult } from './idempotency';
import { writePaymentAuditLog } from './audit-logger';
import { PaymentTransactionRepository } from '../../shared/database/repositories/payment-transaction-repository';
import { PaygCreditsLedgerRepository } from '../../shared/database/repositories/payg-credits-ledger-repository';
import { BillingConfigRepository } from '../../shared/database/repositories/billing-config-repository';
import { BillingHistoryRepository } from '../../shared/database/repositories/billing-history-repository';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { CreditRepository } from '../../shared/database/repositories/credit-repository';
import { InvoiceRepository } from '../../shared/database/repositories/invoice-repository';
import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';
import { query } from '../../shared/database/connection';
import { createLogger } from '../../shared/logger/logger';
import { resolveWorkspaceRecipient } from '../emails/notification-helper';
import { sendPaymentSuccessEmail } from '../emails/payment-success';
import { sendPaymentFailedEmail } from '../emails/payment-failed';
import { sendSubscriptionCreatedEmail } from '../emails/subscription-created';
import type {
  CheckoutSessionParams,
  CheckoutResult,
  CreateSubscriptionParams,
  SubscriptionResult,
  RefundParams,
  RefundResult,
  ChargePaygParams,
  PaygChargeResult,
  PaymentServiceContext,
} from './types';

const logger = createLogger('payment-service');

const stripe = new StripeProvider();
const txnRepo = new PaymentTransactionRepository();
const paygRepo = new PaygCreditsLedgerRepository();
const billingConfigRepo = new BillingConfigRepository();
const billingHistoryRepo = new BillingHistoryRepository();
const subscriptionRepo = new SubscriptionRepository();
const planRepo = new PlanRepository();
const creditRepo = new CreditRepository();
const invoiceRepo = new InvoiceRepository();
const workspaceRepo = new WorkspaceRepository();

function sanitizeForAudit(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...payload };
  const sensitive = ['card', 'cardNumber', 'cvc', 'cvv', 'email', 'name', 'phone', 'address'];
  for (const key of sensitive) {
    if (key in redacted) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

export class PaymentService {
  // ===========================================================================
  // CHECKOUT
  // ===========================================================================

  static async createCheckoutSession(
    params: CheckoutSessionParams,
    ctx: PaymentServiceContext,
  ): Promise<CheckoutResult> {
    const idempotencyKey = ctx.idempotencyKey ?? generateIdempotencyKey();
    const startTime = Date.now();

    const cached = await checkIdempotencyKey(idempotencyKey);
    if (cached && cached.status === 'completed') {
      await writePaymentAuditLog({
        operation: 'createCheckoutSession',
        provider: 'stripe',
        status: 'success',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        metadata: { idempotent: true },
      });
      return {
        sessionId: cached.provider_transaction_id ?? '',
        url: (cached.metadata as Record<string, string> | null)?.checkoutUrl ?? '',
        idempotencyKey,
      };
    }

    try {
      const plan = await planRepo.findBySlug(params.plan);
      if (!plan || !plan.stripe_price_id) {
        throw new PaymentServiceError({
          code: 'INVALID_REQUEST',
          message: 'Plan not found or not synced with Stripe',
          provider: 'stripe',
        });
      }

      const workspace = await workspaceRepo.findById(params.orgId);
      const customerId = await stripe.getOrCreateCustomer({
        email: (workspace as any)?.owner_email ?? '',
        name: (workspace as any)?.name ?? '',
        metadata: { workspace_id: params.orgId },
        existingCustomerId: (workspace as any)?.stripe_customer_id ?? undefined,
      });

      if (!(workspace as any)?.stripe_customer_id) {
        await query('UPDATE workspaces SET stripe_customer_id = $1 WHERE id = $2', [
          customerId,
          params.orgId,
        ]);
      }

      const session = await stripe.createCheckoutSession({
        customerId,
        priceId: plan.stripe_price_id,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        metadata: { workspace_id: params.orgId, plan_id: plan.id },
        idempotencyKey,
      });

      const txId = await txnRepo.create({
        workspace_id: params.orgId,
        provider: 'stripe',
        provider_transaction_id: session.sessionId,
        type: 'subscription',
        status: 'pending',
        amount_cents: BigInt(plan.price_cents),
        currency: 'usd',
        idempotency_key: idempotencyKey,
        metadata: { checkoutUrl: session.url },
      });

      await storeIdempotencyResult(idempotencyKey, txId);

      await writePaymentAuditLog({
        operation: 'createCheckoutSession',
        provider: 'stripe',
        status: 'success',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        amountCents: BigInt(plan.price_cents),
        currency: 'usd',
        providerRefs: { sessionId: session.sessionId },
      });

      return { sessionId: session.sessionId, url: session.url, idempotencyKey };
    } catch (error) {
      const paymentError =
        error instanceof PaymentServiceError
          ? error
          : PaymentServiceError.fromStripeError(error);

      await writePaymentAuditLog({
        operation: 'createCheckoutSession',
        provider: 'stripe',
        status: 'failed',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        errorMessage: paymentError.message,
        errorCode: paymentError.code,
      });

      throw paymentError;
    }
  }

  // ===========================================================================
  // SUBSCRIPTION
  // ===========================================================================

  static async createSubscription(
    params: CreateSubscriptionParams,
    ctx: PaymentServiceContext,
  ): Promise<SubscriptionResult> {
    const startTime = Date.now();

    try {
      const plan = await planRepo.findBySlug(params.plan);
      if (!plan || !plan.stripe_price_id) {
        throw new PaymentServiceError({
          code: 'INVALID_REQUEST',
          message: 'Plan not found or not synced with Stripe',
          provider: 'stripe',
        });
      }

      const workspace = await workspaceRepo.findById(params.orgId);
      const customerId = await stripe.getOrCreateCustomer({
        email: (workspace as any)?.owner_email ?? '',
        name: (workspace as any)?.name ?? '',
        metadata: { workspace_id: params.orgId },
        existingCustomerId: (workspace as any)?.stripe_customer_id ?? undefined,
      });

      if (!(workspace as any)?.stripe_customer_id) {
        await query('UPDATE workspaces SET stripe_customer_id = $1 WHERE id = $2', [
          customerId,
          params.orgId,
        ]);
      }

      const sub = await stripe.createSubscription({
        customerId,
        priceId: plan.stripe_price_id,
        metadata: { workspace_id: params.orgId, plan_id: plan.id },
        trialPeriodDays: plan.trial_days > 0 ? plan.trial_days : undefined,
      });

      const now = new Date();
      const periodEnd = plan.trial_days > 0
        ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const existing = await subscriptionRepo.findByWorkspaceId(params.orgId);
      if (existing) {
        await subscriptionRepo.update(existing.id, {
          plan_id: plan.id,
          status: plan.trial_days > 0 ? 'trialing' : 'active',
          stripe_subscription_id: sub.stripeSubscriptionId,
          stripe_customer_id: customerId,
          current_period_start: now,
          current_period_end: periodEnd,
          trial_start: plan.trial_days > 0 ? now : undefined,
          trial_end: plan.trial_days > 0 ? periodEnd : undefined,
        });
      } else {
        await subscriptionRepo.create({
          workspace_id: params.orgId,
          plan_id: plan.id,
          status: plan.trial_days > 0 ? 'trialing' : 'active',
          stripe_subscription_id: sub.stripeSubscriptionId,
          stripe_customer_id: customerId,
          current_period_start: now,
          current_period_end: periodEnd,
          trial_start: plan.trial_days > 0 ? now : undefined,
          trial_end: plan.trial_days > 0 ? periodEnd : undefined,
        });
      }

      await creditRepo.initBalance(params.orgId);
      if (plan.credits_per_period > 0) {
        await creditRepo.addCredits({
          workspace_id: params.orgId,
          amount: plan.credits_per_period,
          type: 'subscription_refill',
          description: `Initial ${plan.name} credits`,
        });
      }

      await txnRepo.create({
        workspace_id: params.orgId,
        provider: 'stripe',
        provider_transaction_id: sub.stripeSubscriptionId,
        type: 'subscription',
        status: 'completed',
        amount_cents: BigInt(plan.price_cents),
        currency: 'usd',
        metadata: { planSlug: params.plan, tier: params.tier },
      });

      await writePaymentAuditLog({
        operation: 'createSubscription',
        provider: 'stripe',
        status: 'success',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        amountCents: BigInt(plan.price_cents),
        currency: 'usd',
        providerRefs: { subscriptionId: sub.stripeSubscriptionId },
      });

      return {
        subscriptionId: sub.subscriptionId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        status: plan.trial_days > 0 ? 'trialing' : 'active',
      };
    } catch (error) {
      const paymentError =
        error instanceof PaymentServiceError
          ? error
          : PaymentServiceError.fromStripeError(error);

      await writePaymentAuditLog({
        operation: 'createSubscription',
        provider: 'stripe',
        status: 'failed',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        errorMessage: paymentError.message,
        errorCode: paymentError.code,
      });

      throw paymentError;
    }
  }

  // ===========================================================================
  // WEBHOOK
  // ===========================================================================

  static async handleWebhook(event: {
    type: string;
    data: { object: any };
    id: string;
  }): Promise<void> {
    const startTime = Date.now();

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        default:
          logger.debug(`Unhandled Stripe event type: ${event.type}`);
          return;
      }

      await writePaymentAuditLog({
        operation: 'handleWebhook',
        provider: 'stripe',
        status: 'success',
        durationMs: Date.now() - startTime,
        metadata: sanitizeForAudit({ eventType: event.type, eventId: event.id }),
      });
    } catch (error) {
      await writePaymentAuditLog({
        operation: 'handleWebhook',
        provider: 'stripe',
        status: 'failed',
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: sanitizeForAudit({ eventType: event.type, eventId: event.id }),
      });
      throw error;
    }
  }

  private static async handleCheckoutCompleted(session: any): Promise<void> {
    const workspaceId = session.metadata?.workspace_id;
    const planId = session.metadata?.plan_id;
    if (!workspaceId || !planId) return;

    const sub = await subscriptionRepo.findByWorkspaceId(workspaceId);
    if (sub) {
      await subscriptionRepo.update(sub.id, {
        plan_id: planId,
        status: 'active',
        stripe_subscription_id: session.subscription,
        stripe_customer_id: session.customer,
      });
    }

    await billingHistoryRepo.record({
      workspace_id: workspaceId,
      event_type: 'checkout_completed',
      provider: 'stripe',
      provider_event_id: session.id,
      metadata: { plan_id: planId, subscription_id: session.subscription },
    });

    const recipient = await resolveWorkspaceRecipient(workspaceId);
    if (recipient) {
      const plan = await planRepo.findById(planId);
      sendSubscriptionCreatedEmail({
        recipient,
        plan: plan?.name || planId,
        dashboardUrl: `${process.env.APP_URL || ''}/settings?tab=billing`,
      }).catch(() => {});
    }
  }

  private static async handleInvoicePaid(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const sub = await subscriptionRepo.findByStripeSubscriptionId(subscriptionId);
    if (!sub) return;

    await invoiceRepo.create({
      workspace_id: sub.workspace_id,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: invoice.charge,
      amount_cents: invoice.amount_paid,
      status: 'paid',
      period_start: new Date(invoice.period_start * 1000),
      period_end: new Date(invoice.period_end * 1000),
      paid_at: new Date(),
      invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
    });

    const plan = await planRepo.findById(sub.plan_id);
    if (plan && plan.credits_per_period > 0) {
      await creditRepo.initBalance(sub.workspace_id);
      await creditRepo.addCredits({
        workspace_id: sub.workspace_id,
        amount: plan.credits_per_period,
        type: 'subscription_refill',
        description: `${plan.name} billing cycle credit refill`,
        reference_type: 'stripe_invoice',
        reference_id: invoice.id,
      });
    }

    await subscriptionRepo.update(sub.id, {
      status: 'active',
      current_period_start: new Date(invoice.period_start * 1000),
      current_period_end: new Date(invoice.period_end * 1000),
    });

    await billingHistoryRepo.record({
      workspace_id: sub.workspace_id,
      event_type: 'invoice_paid',
      provider: 'stripe',
      provider_event_id: invoice.id,
      amount_cents: BigInt(invoice.amount_paid),
      metadata: { subscription_id: subscriptionId },
    });

    const recipient = await resolveWorkspaceRecipient(sub.workspace_id);
    if (recipient) {
      sendPaymentSuccessEmail({
        recipient,
        amount: `$${(invoice.amount_paid / 100).toFixed(2)}`,
        plan: plan?.name || 'Subscription',
        invoiceUrl: invoice.hosted_invoice_url,
      }).catch(() => {});
    }
  }

  private static async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const sub = await subscriptionRepo.findByStripeSubscriptionId(subscriptionId);
    if (!sub) return;

    await subscriptionRepo.update(sub.id, { status: 'past_due' });

    await invoiceRepo.create({
      workspace_id: sub.workspace_id,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_due,
      status: 'open',
      period_start: new Date(invoice.period_start * 1000),
      period_end: new Date(invoice.period_end * 1000),
      invoice_url: invoice.hosted_invoice_url,
    });

    await billingHistoryRepo.record({
      workspace_id: sub.workspace_id,
      event_type: 'invoice_payment_failed',
      provider: 'stripe',
      provider_event_id: invoice.id,
      amount_cents: BigInt(invoice.amount_due),
    });

    const recipient = await resolveWorkspaceRecipient(sub.workspace_id);
    if (recipient) {
      sendPaymentFailedEmail({
        recipient,
        amount: `$${(invoice.amount_due / 100).toFixed(2)}`,
        updatePaymentUrl: invoice.hosted_invoice_url || `${process.env.APP_URL || ''}/settings?tab=billing`,
      }).catch(() => {});
    }
  }

  private static async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const sub = await subscriptionRepo.findByStripeSubscriptionId(subscription.id);
    if (!sub) return;

    const updates: Record<string, any> = {};
    if (subscription.cancel_at_period_end !== undefined) {
      updates.cancel_at_period_end = subscription.cancel_at_period_end;
    }
    if (subscription.status) {
      const statusMap: Record<string, string> = {
        active: 'active',
        trialing: 'trialing',
        past_due: 'past_due',
        canceled: 'canceled',
      };
      updates.status = statusMap[subscription.status] ?? sub.status;
    }
    if (subscription.current_period_start) {
      updates.current_period_start = new Date(subscription.current_period_start * 1000);
    }
    if (subscription.current_period_end) {
      updates.current_period_end = new Date(subscription.current_period_end * 1000);
    }

    await subscriptionRepo.update(sub.id, updates);
  }

  private static async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const sub = await subscriptionRepo.findByStripeSubscriptionId(subscription.id);
    if (!sub) return;

    await subscriptionRepo.update(sub.id, {
      status: 'canceled',
      canceled_at: new Date(),
    });

    await billingHistoryRepo.record({
      workspace_id: sub.workspace_id,
      event_type: 'subscription_deleted',
      provider: 'stripe',
      provider_event_id: subscription.id,
    });
  }

  // ===========================================================================
  // REFUND
  // ===========================================================================

  static async refund(
    params: RefundParams,
    ctx: PaymentServiceContext,
  ): Promise<RefundResult> {
    const idempotencyKey = ctx.idempotencyKey ?? generateIdempotencyKey();
    const startTime = Date.now();

    try {
      const result = await stripe.createRefund({
        paymentIntentId: params.paymentIntentId,
        amountCents: params.amountCents,
        idempotencyKey,
      });

      await txnRepo.create({
        workspace_id: ctx.orgId,
        provider: 'stripe',
        provider_transaction_id: result.refundId,
        type: 'refund',
        status: result.status === 'succeeded' ? 'completed' : 'pending',
        amount_cents: -result.amountCents,
        currency: 'usd',
        idempotency_key: idempotencyKey,
        metadata: { paymentIntentId: params.paymentIntentId },
      });

      await writePaymentAuditLog({
        operation: 'refund',
        provider: 'stripe',
        status: 'success',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        amountCents: result.amountCents,
        currency: 'usd',
        providerRefs: { refundId: result.refundId },
      });

      return {
        refundId: result.refundId,
        amountCents: result.amountCents,
        status: result.status as 'pending' | 'succeeded' | 'failed',
      };
    } catch (error) {
      const paymentError =
        error instanceof PaymentServiceError
          ? error
          : PaymentServiceError.fromStripeError(error);

      await writePaymentAuditLog({
        operation: 'refund',
        provider: 'stripe',
        status: 'failed',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        errorMessage: paymentError.message,
        errorCode: paymentError.code,
      });

      throw paymentError;
    }
  }

  // ===========================================================================
  // PAYG CHARGE
  // ===========================================================================

  static async chargePayg(
    params: ChargePaygParams,
    ctx: PaymentServiceContext,
  ): Promise<PaygChargeResult> {
    const idempotencyKey = ctx.idempotencyKey ?? generateIdempotencyKey();
    const startTime = Date.now();

    try {
      const workspace = await workspaceRepo.findById(params.orgId);
      const customerId = (workspace as any)?.stripe_customer_id;
      if (!customerId) {
        throw new PaymentServiceError({
          code: 'INVALID_REQUEST',
          message: 'No Stripe customer found for this workspace',
          provider: 'stripe',
        });
      }

      const ledgerEntryId = await paygRepo.create({
        workspace_id: params.orgId,
        amount_cents: params.amountCents,
        reason: params.reason,
        related_event_id: params.relatedEventId ?? null,
        status: 'pending',
      });

      const intent = await stripe.createPaymentIntent({
        amountCents: params.amountCents,
        currency: 'usd',
        customerId,
        metadata: {
          workspace_id: params.orgId,
          ledger_entry_id: ledgerEntryId,
          reason: params.reason,
        },
        idempotencyKey,
      });

      await paygRepo.updateStatus(ledgerEntryId, 'completed', intent.paymentIntentId);

      await txnRepo.create({
        workspace_id: params.orgId,
        provider: 'stripe',
        provider_transaction_id: intent.paymentIntentId,
        type: 'payg',
        status: 'completed',
        amount_cents: params.amountCents,
        currency: 'usd',
        idempotency_key: idempotencyKey,
        metadata: {
          reason: params.reason,
          relatedEventId: params.relatedEventId,
          ledgerEntryId,
        },
      });

      await writePaymentAuditLog({
        operation: 'chargePayg',
        provider: 'stripe',
        status: 'success',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        amountCents: params.amountCents,
        currency: 'usd',
        providerRefs: { paymentIntentId: intent.paymentIntentId },
        metadata: sanitizeForAudit({ reason: params.reason }),
      });

      return {
        ledgerEntryId,
        paymentIntentId: intent.paymentIntentId,
        amountCents: params.amountCents,
      };
    } catch (error) {
      const paymentError =
        error instanceof PaymentServiceError
          ? error
          : PaymentServiceError.fromStripeError(error);

      await writePaymentAuditLog({
        operation: 'chargePayg',
        provider: 'stripe',
        status: 'failed',
        durationMs: Date.now() - startTime,
        userId: ctx.userId,
        orgId: ctx.orgId,
        idempotencyKey,
        errorMessage: paymentError.message,
        errorCode: paymentError.code,
      });

      throw paymentError;
    }
  }

  // ===========================================================================
  // BILLING OPERATIONS (ported from BillingService)
  // ===========================================================================

  static async provisionNewWorkspace(workspaceId: string, planSlug: string = 'free-trial'): Promise<void> {
    const plan = await planRepo.findBySlug(planSlug);
    if (!plan) return;

    const now = new Date();
    const periodEnd = plan.trial_days > 0
      ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await subscriptionRepo.create({
      workspace_id: workspaceId,
      plan_id: plan.id,
      status: plan.trial_days > 0 ? 'trialing' : 'active',
      current_period_start: now,
      current_period_end: periodEnd,
      trial_start: plan.trial_days > 0 ? now : undefined,
      trial_end: plan.trial_days > 0 ? periodEnd : undefined,
    });

    await creditRepo.initBalance(workspaceId);

    if (plan.credits_per_period > 0) {
      await creditRepo.addCredits({
        workspace_id: workspaceId,
        amount: plan.credits_per_period,
        type: 'subscription_refill',
        description: `Initial ${plan.name} credits`,
      });
    }

    await writePaymentAuditLog({
      operation: 'provisionNewWorkspace',
      provider: 'stripe',
      status: 'success',
      durationMs: 0,
      orgId: workspaceId,
      metadata: { planSlug },
    });
  }

  static async changePlan(workspaceId: string, newPlanId: string, ctx: PaymentServiceContext): Promise<void> {
    const startTime = Date.now();
    const subscription = await subscriptionRepo.findByWorkspaceId(workspaceId);
    if (!subscription) {
      throw new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: 'No subscription found',
        provider: 'stripe',
      });
    }

    const newPlan = await planRepo.findById(newPlanId);
    if (!newPlan) {
      throw new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: 'Plan not found',
        provider: 'stripe',
      });
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await subscriptionRepo.update(subscription.id, {
      plan_id: newPlanId,
      status: 'active',
      current_period_start: now,
      current_period_end: periodEnd,
    });

    await writePaymentAuditLog({
      operation: 'changePlan',
      provider: 'stripe',
      status: 'success',
      durationMs: Date.now() - startTime,
      userId: ctx.userId,
      orgId: workspaceId,
      metadata: { oldPlanId: subscription.plan_id, newPlanId },
    });
  }

  static async checkCreditBalance(
    workspaceId: string,
    requiredCredits: number,
  ): Promise<{ hasEnough: boolean; balance: number; required: number }> {
    const balanceEntity = await creditRepo.getBalance(workspaceId);
    const balance = balanceEntity?.balance || 0;
    return { hasEnough: balance >= requiredCredits, balance, required: requiredCredits };
  }

  static async consumeCredits(
    workspaceId: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<void> {
    await creditRepo.deductCredits({
      workspace_id: workspaceId,
      amount,
      type: 'usage',
      description,
      reference_type: referenceType,
      reference_id: referenceId,
    });
  }

  static async grantCredits(
    workspaceId: string,
    amount: number,
    description: string,
    performedBy: string,
  ): Promise<void> {
    await creditRepo.addCredits({
      workspace_id: workspaceId,
      amount,
      type: 'admin_grant',
      description,
      performed_by: performedBy,
    });

    await writePaymentAuditLog({
      operation: 'grantCredits',
      provider: 'stripe',
      status: 'success',
      durationMs: 0,
      userId: performedBy,
      orgId: workspaceId,
      metadata: { amount, description },
    });
  }

  static async revokeCredits(
    workspaceId: string,
    amount: number,
    description: string,
    performedBy: string,
  ): Promise<void> {
    await creditRepo.deductCredits({
      workspace_id: workspaceId,
      amount,
      type: 'admin_revoke',
      description,
      reference_type: 'admin_action',
      reference_id: performedBy,
    });

    await writePaymentAuditLog({
      operation: 'revokeCredits',
      provider: 'stripe',
      status: 'success',
      durationMs: 0,
      userId: performedBy,
      orgId: workspaceId,
      metadata: { amount, description },
    });
  }

  static async getWorkspaceSubscription(workspaceId: string) {
    const subscription = await subscriptionRepo.findByWorkspaceId(workspaceId);
    if (!subscription) return null;

    const plan = await planRepo.findById(subscription.plan_id);
    if (!plan) return null;

    const featureEntities = await planRepo.getFeatures(plan.id);
    const features: Record<string, string> = {};
    for (const f of featureEntities) {
      features[f.feature_key] = f.feature_value;
    }

    return { subscription, plan, features };
  }

  static async getUsageSummary(workspaceId: string) {
    const subscription = await subscriptionRepo.findByWorkspaceId(workspaceId);
    const balance = await creditRepo.getBalance(workspaceId);

    const periodStart = subscription?.current_period_start || null;
    const periodEnd = subscription?.current_period_end || null;

    let creditsUsed = 0;
    if (periodStart && periodEnd) {
      creditsUsed = await creditRepo.getTotalUsageForPeriod(workspaceId, periodStart, periodEnd);
    }

    const plan = subscription ? await planRepo.findById(subscription.plan_id) : null;

    return {
      credits_used: creditsUsed,
      credits_remaining: balance?.balance || 0,
      credits_total: plan?.credits_per_period || 0,
      period_start: periodStart,
      period_end: periodEnd,
    };
  }

  // ===========================================================================
  // STRIPE PASSTHROUGH (ported from StripeService)
  // ===========================================================================

  static async createPortalSession(workspaceId: string): Promise<{ url: string }> {
    const workspace = await workspaceRepo.findById(workspaceId);
    const customerId = (workspace as any)?.stripe_customer_id;
    if (!customerId) {
      throw new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: 'No Stripe customer found for this workspace',
        provider: 'stripe',
      });
    }

    const returnUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5183/billing';
    return stripe.createPortalSession(customerId, returnUrl);
  }

  static async cancelSubscription(workspaceId: string, immediate: boolean = false): Promise<void> {
    const startTime = Date.now();
    const sub = await subscriptionRepo.findByWorkspaceId(workspaceId);
    if (!sub || !sub.stripe_subscription_id) {
      throw new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: 'No active Stripe subscription found',
        provider: 'stripe',
      });
    }

    await stripe.cancelSubscription(sub.stripe_subscription_id, immediate);

    await subscriptionRepo.update(sub.id, {
      cancel_at_period_end: !immediate,
      canceled_at: immediate ? new Date() : undefined,
      status: immediate ? 'canceled' : sub.status,
    });

    await writePaymentAuditLog({
      operation: 'cancelSubscription',
      provider: 'stripe',
      status: 'success',
      durationMs: Date.now() - startTime,
      orgId: workspaceId,
      metadata: { immediate },
    });
  }

  static async reactivateSubscription(workspaceId: string): Promise<void> {
    const sub = await subscriptionRepo.findByWorkspaceId(workspaceId);
    if (!sub || !sub.stripe_subscription_id) {
      throw new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: 'No Stripe subscription found',
        provider: 'stripe',
      });
    }

    await stripe.reactivateSubscription(sub.stripe_subscription_id);

    await subscriptionRepo.update(sub.id, {
      cancel_at_period_end: false,
      canceled_at: null,
    });
  }

  static async syncPlanToStripe(planId: string): Promise<{ productId: string; priceId: string }> {
    const plan = await planRepo.findById(planId);
    if (!plan) {
      throw new PaymentServiceError({
        code: 'INVALID_REQUEST',
        message: 'Plan not found',
        provider: 'stripe',
      });
    }

    const result = await stripe.syncPlanToStripe({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      slug: plan.slug,
      priceCents: plan.price_cents,
      billingInterval: plan.billing_interval,
      stripeProductId: plan.stripe_product_id,
    });

    await planRepo.update(plan.id, {
      stripe_product_id: result.productId,
      stripe_price_id: result.priceId,
    });

    return result;
  }

  static get stripeProvider(): StripeProvider {
    return stripe;
  }
}
