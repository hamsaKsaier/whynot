import { Router } from 'express';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { SubscriptionManager } from '../../payments/subscription-manager';
import { BillingService } from '../../payments/billing-service';
import { PaymentService } from '../../payments/payment-service';
import { isPlanSlug, type PlanSlug } from '../../../shared/constants/pricing';

const router = Router();

router.get('/subscription', asyncHandler(async (req: any, res) => {
  const sub = await SubscriptionManager.getSubscription(req.workspaceId);
  if (!sub) {
    return res.json({ success: true, subscription: null });
  }

  res.json({
    success: true,
    subscription: {
      ...sub,
      monthlyCents: sub.monthlyCents.toString(),
    },
  });
}));

router.post('/checkout', asyncHandler(async (req: any, res) => {
  const { plan } = req.body;
  if (!plan || !isPlanSlug(plan)) {
    throw createError(
      (req as any).t('errors:validation.planIdRequired'),
      400,
      'INVALID_PLAN',
    );
  }

  const session = await PaymentService.createCheckoutSession(
    {
      orgId: req.workspaceId,
      plan,
      tier: plan,
      successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:5183/billing?success=true',
      cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:5183/billing?canceled=true',
    },
    { userId: req.user!.id, orgId: req.workspaceId },
  );

  res.json({ success: true, sessionId: session.sessionId, url: session.url });
}));

router.post('/upgrade', asyncHandler(async (req: any, res) => {
  const { plan } = req.body;
  if (!plan || !isPlanSlug(plan)) {
    throw createError(
      (req as any).t('errors:billing.invalidPlan'),
      400,
      'INVALID_PLAN',
    );
  }

  await SubscriptionManager.upgrade(
    { orgId: req.workspaceId, plan: plan as PlanSlug },
    { userId: req.user!.id, orgId: req.workspaceId },
  );

  res.json({ success: true, message: (req as any).t('success:subscription.upgraded') });
}));

router.post('/downgrade', asyncHandler(async (req: any, res) => {
  const { plan } = req.body;
  if (!plan || !isPlanSlug(plan)) {
    throw createError(
      (req as any).t('errors:billing.invalidPlan'),
      400,
      'INVALID_PLAN',
    );
  }

  await SubscriptionManager.downgrade(
    { orgId: req.workspaceId, plan: plan as PlanSlug },
    { userId: req.user!.id, orgId: req.workspaceId },
  );

  res.json({ success: true, message: (req as any).t('success:subscription.downgraded') });
}));

router.post('/cancel', asyncHandler(async (req: any, res) => {
  const atPeriodEnd = req.body.atPeriodEnd !== false;

  await SubscriptionManager.cancel(
    { orgId: req.workspaceId, atPeriodEnd },
    { userId: req.user!.id, orgId: req.workspaceId },
  );

  const messageKey = atPeriodEnd
    ? 'success:subscription.cancelAtPeriodEnd'
    : 'success:subscription.canceledImmediately';

  res.json({ success: true, message: (req as any).t(messageKey) });
}));

router.post('/reactivate', asyncHandler(async (req: any, res) => {
  await SubscriptionManager.reactivate(
    { orgId: req.workspaceId },
    { userId: req.user!.id, orgId: req.workspaceId },
  );

  res.json({ success: true, message: (req as any).t('success:subscription.reactivated') });
}));

router.get('/balance', asyncHandler(async (req: any, res) => {
  const balance = await BillingService.currentPaygBalance(req.workspaceId);
  res.json({ success: true, balanceCents: balance.toString() });
}));

router.post('/topup', asyncHandler(async (req: any, res) => {
  const { amountCents, paymentIntentId } = req.body;

  if (!amountCents || !paymentIntentId) {
    throw createError(
      (req as any).t('errors:billing.topupFieldsRequired'),
      400,
      'MISSING_FIELDS',
    );
  }

  let amount: bigint;
  try {
    amount = BigInt(amountCents);
  } catch {
    throw createError(
      (req as any).t('errors:billing.invalidAmount'),
      400,
      'INVALID_AMOUNT',
    );
  }

  if (amount <= 0n) {
    throw createError(
      (req as any).t('errors:billing.invalidAmount'),
      400,
      'INVALID_AMOUNT',
    );
  }

  const result = await BillingService.topUp(
    { orgId: req.workspaceId, amountCents: amount, paymentIntentId },
    { userId: req.user!.id, orgId: req.workspaceId },
  );

  res.json({ success: true, ledgerEntryId: result.ledgerEntryId, message: (req as any).t('success:billing.topupCompleted') });
}));

export const meBillingRouter = router;
