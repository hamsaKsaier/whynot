/**
 * email-notifier.ts
 *
 * Lightweight HTTP caller that forwards notification events to the gateway.
 * The gateway owns the Resend integration and notification preference checks.
 */

import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('email-notifier');

const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3010';

interface NotifyPayload {
  type: 'scan_complete' | 'critical_bug';
  userId?: string;
  workspaceId?: string;
  data: Record<string, any>;
}

/**
 * Fire-and-forget notification to the gateway.
 * Failures are logged but never bubble up.
 */
export async function notifyGateway(payload: NotifyPayload): Promise<void> {
  try {
    await fetch(`${gatewayUrl}/api/internal/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    logger.warn('Failed to notify gateway', { type: payload.type, error: err.message });
  }
}
