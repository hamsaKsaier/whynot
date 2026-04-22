import express, { Request, Response } from 'express';
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';
import { PaymentService } from '../../payments/payment-service';
import { writePaymentAuditLog } from '../../payments/audit-logger';

const router = express.Router();
const logger = createLogger('stripe-webhook');

const SIDE_EFFECT_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

router.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string | undefined;

    if (!sig) {
      logger.warn('Missing stripe-signature header');
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event;
    try {
      event = PaymentService.stripeProvider.verifyWebhookSignature(req.body, sig);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Signature verification failed', { error: message });
      res.status(400).json({ error: 'Signature verification failed' });
      return;
    }

    if (!event || !event.id) {
      logger.warn('Invalid event payload after verification');
      res.status(400).json({ error: 'Invalid event payload' });
      return;
    }

    const eventId = event.id;
    const eventType = event.type;

    let isDuplicate = false;
    try {
      const rows = await query<{ event_id: string }>(
        `INSERT INTO payment_webhooks_idempotency (event_id)
         VALUES ($1)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [eventId],
      );
      isDuplicate = rows.length === 0;
    } catch (err) {
      logger.error('Idempotency check failed', err instanceof Error ? err : undefined, {
        eventId,
        eventType,
      });
      res.status(500).json({ error: 'Internal error' });
      return;
    }

    if (isDuplicate) {
      logger.info('Duplicate event ignored', { eventId, eventType });
      res.status(200).json({ received: true, dedupe: 'duplicate' });
      return;
    }

    logger.info('Processing webhook event', { eventId, eventType });

    const startTime = Date.now();
    try {
      await PaymentService.handleWebhook(event);

      await query(
        `UPDATE payment_webhooks_idempotency SET handled_at = now() WHERE event_id = $1`,
        [eventId],
      );

      logger.info('Webhook dispatched successfully', {
        eventId,
        eventType,
        durationMs: Date.now() - startTime,
      });

      if (SIDE_EFFECT_EVENTS.has(eventType)) {
        await writePaymentAuditLog({
          operation: 'webhook.dispatch',
          provider: 'stripe',
          status: 'success',
          durationMs: Date.now() - startTime,
          metadata: { eventId, eventType, dedupe: 'new' },
        });
      }
    } catch (err) {
      logger.error('Webhook dispatch failed', err instanceof Error ? err : undefined, {
        eventId,
        eventType,
        durationMs: Date.now() - startTime,
      });

      await writePaymentAuditLog({
        operation: 'webhook.dispatch',
        provider: 'stripe',
        status: 'failed',
        durationMs: Date.now() - startTime,
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: { eventId, eventType, dedupe: 'new' },
      });
    }

    res.status(200).json({ received: true });
  },
);

export { router as stripeWebhookRouter };
