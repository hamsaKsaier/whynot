import { PlanRepository, PlanEntity } from '../../shared/database/repositories/plan-repository';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { InvoiceRepository } from '../../shared/database/repositories/invoice-repository';
import { CreditRepository } from '../../shared/database/repositories/credit-repository';
import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';
import { query } from '../../shared/database/connection';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('stripe-service');

const planRepository = new PlanRepository();
const subscriptionRepository = new SubscriptionRepository();
const invoiceRepository = new InvoiceRepository();
const creditRepository = new CreditRepository();
const workspaceRepository = new WorkspaceRepository();

// Lazy-load Stripe to avoid errors when not configured
let stripeInstance: any = null;

function getStripe(): any {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    // Dynamic require to avoid issues when stripe is not installed
    try {
      const Stripe = require('stripe');
      stripeInstance = new Stripe(secretKey, { apiVersion: '2024-06-20' });
    } catch (err) {
      throw new Error('Stripe package is not installed. Run: npm install stripe');
    }
  }
  return stripeInstance;
}

export class StripeService {
  /**
   * Get or create a Stripe customer for a workspace.
   */
  async getOrCreateCustomer(workspaceId: string, email: string, name: string): Promise<string> {
    const stripe = getStripe();

    // Check if workspace already has a Stripe customer
    const workspace = await workspaceRepository.findById(workspaceId);
    if (workspace && (workspace as any).stripe_customer_id) {
      return (workspace as any).stripe_customer_id;
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { workspace_id: workspaceId },
    });

    // Save customer ID to workspace
    await query(
      'UPDATE workspaces SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, workspaceId]
    );

    return customer.id;
  }

  /**
   * Create a Checkout Session for subscribing to a plan.
   */
  async createCheckoutSession(
    workspaceId: string,
    planId: string,
    customerEmail: string,
    customerName: string
  ): Promise<{ sessionId: string; url: string }> {
    const stripe = getStripe();

    const plan = await planRepository.findById(planId);
    if (!plan || !plan.stripe_price_id) {
      throw new Error('Plan not found or not synced with Stripe');
    }

    const customerId = await this.getOrCreateCustomer(workspaceId, customerEmail, customerName);

    const successUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5183/billing?success=true';
    const cancelUrl = process.env.STRIPE_CANCEL_URL || 'http://localhost:5183/billing?canceled=true';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { workspace_id: workspaceId, plan_id: planId },
      subscription_data: {
        metadata: { workspace_id: workspaceId, plan_id: planId },
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Create a Customer Portal session.
   */
  async createPortalSession(workspaceId: string): Promise<{ url: string }> {
    const stripe = getStripe();

    const workspace = await workspaceRepository.findById(workspaceId);
    const customerId = (workspace as any)?.stripe_customer_id;
    if (!customerId) {
      throw new Error('No Stripe customer found for this workspace');
    }

    const returnUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5183/billing';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Cancel a subscription (at period end by default).
   */
  async cancelSubscription(workspaceId: string, immediate: boolean = false): Promise<void> {
    const stripe = getStripe();

    const sub = await subscriptionRepository.findByWorkspaceId(workspaceId);
    if (!sub || !sub.stripe_subscription_id) {
      throw new Error('No active Stripe subscription found');
    }

    if (immediate) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } else {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    await subscriptionRepository.update(sub.id, {
      cancel_at_period_end: !immediate,
      canceled_at: immediate ? new Date() : undefined,
      status: immediate ? 'canceled' : sub.status,
    });
  }

  /**
   * Reactivate a canceled subscription (before period end).
   */
  async reactivateSubscription(workspaceId: string): Promise<void> {
    const stripe = getStripe();

    const sub = await subscriptionRepository.findByWorkspaceId(workspaceId);
    if (!sub || !sub.stripe_subscription_id) {
      throw new Error('No Stripe subscription found');
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await subscriptionRepository.update(sub.id, {
      cancel_at_period_end: false,
      canceled_at: null,
    });
  }

  /**
   * Sync a plan to Stripe (create or update Product + Price).
   */
  async syncPlanToStripe(planId: string): Promise<{ productId: string; priceId: string }> {
    const stripe = getStripe();

    const plan = await planRepository.findById(planId);
    if (!plan) throw new Error('Plan not found');

    // Create or update Stripe Product
    let productId: string | undefined = plan.stripe_product_id || undefined;
    if (productId) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
      });
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: { plan_id: plan.id, plan_slug: plan.slug },
      });
      productId = product.id;
    }

    // Create new Stripe Price (prices are immutable in Stripe)
    const interval = plan.billing_interval === 'yearly' ? 'year' : 'month';
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.price_cents,
      currency: 'usd',
      recurring: { interval },
      metadata: { plan_id: plan.id },
    });

    // Update plan with Stripe IDs
    await planRepository.update(plan.id, {
      stripe_product_id: productId,
      stripe_price_id: price.id,
    });

    return { productId: productId!, priceId: price.id };
  }

  /**
   * Handle Stripe webhook events.
   */
  async handleWebhookEvent(event: any): Promise<void> {
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
    }
  }

  private async handleCheckoutCompleted(session: any): Promise<void> {
    const workspaceId = session.metadata?.workspace_id;
    const planId = session.metadata?.plan_id;
    if (!workspaceId || !planId) return;

    const sub = await subscriptionRepository.findByWorkspaceId(workspaceId);
    if (sub) {
      await subscriptionRepository.update(sub.id, {
        plan_id: planId,
        status: 'active',
        stripe_subscription_id: session.subscription,
        stripe_customer_id: session.customer,
      });
    }
  }

  private async handleInvoicePaid(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const sub = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
    if (!sub) return;

    // Record invoice
    await invoiceRepository.create({
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

    // Refill credits
    const plan = await planRepository.findById(sub.plan_id);
    if (plan && plan.credits_per_period > 0) {
      // Ensure credit balance exists
      await creditRepository.initBalance(sub.workspace_id);
      await creditRepository.addCredits({
        workspace_id: sub.workspace_id,
        amount: plan.credits_per_period,
        type: 'subscription_refill',
        description: `${plan.name} billing cycle credit refill`,
        reference_type: 'stripe_invoice',
        reference_id: invoice.id,
      });
    }

    // Update subscription period
    await subscriptionRepository.update(sub.id, {
      status: 'active',
      current_period_start: new Date(invoice.period_start * 1000),
      current_period_end: new Date(invoice.period_end * 1000),
    });
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const sub = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
    if (!sub) return;

    await subscriptionRepository.update(sub.id, { status: 'past_due' });

    // Record failed invoice
    await invoiceRepository.create({
      workspace_id: sub.workspace_id,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_due,
      status: 'open',
      period_start: new Date(invoice.period_start * 1000),
      period_end: new Date(invoice.period_end * 1000),
      invoice_url: invoice.hosted_invoice_url,
    });
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const sub = await subscriptionRepository.findByStripeSubscriptionId(subscription.id);
    if (!sub) return;

    const updates: any = {};
    if (subscription.cancel_at_period_end !== undefined) {
      updates.cancel_at_period_end = subscription.cancel_at_period_end;
    }
    if (subscription.status) {
      updates.status = subscription.status === 'active' ? 'active'
        : subscription.status === 'trialing' ? 'trialing'
        : subscription.status === 'past_due' ? 'past_due'
        : subscription.status === 'canceled' ? 'canceled'
        : sub.status;
    }
    if (subscription.current_period_start) {
      updates.current_period_start = new Date(subscription.current_period_start * 1000);
    }
    if (subscription.current_period_end) {
      updates.current_period_end = new Date(subscription.current_period_end * 1000);
    }

    await subscriptionRepository.update(sub.id, updates);
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const sub = await subscriptionRepository.findByStripeSubscriptionId(subscription.id);
    if (!sub) return;

    await subscriptionRepository.update(sub.id, {
      status: 'canceled',
      canceled_at: new Date(),
    });
  }
}
