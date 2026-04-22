import { createLogger } from '../../shared/logger/logger';
import { query } from '../../shared/database/connection';
import type { AuditEntry } from './types';

const logger = createLogger('payment-audit');

export async function writePaymentAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO payment_audit_log
         (operation, provider, status, duration_ms, user_id, organization_id,
          idempotency_key, amount_cents, currency, error_message, error_code,
          retry_attempts, provider_refs, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        entry.operation,
        entry.provider,
        entry.status,
        entry.durationMs,
        entry.userId ?? null,
        entry.orgId ?? null,
        entry.idempotencyKey ?? null,
        entry.amountCents != null ? entry.amountCents.toString() : null,
        entry.currency ?? null,
        entry.errorMessage ?? null,
        entry.errorCode ?? null,
        entry.retryAttempts ?? 0,
        entry.providerRefs ? JSON.stringify(entry.providerRefs) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );
  } catch (error) {
    logger.error('Failed to write payment audit log', error, {
      operation: entry.operation,
      provider: entry.provider,
      status: entry.status,
    });
  }
}

export async function auditedOperation<T>(
  operation: string,
  provider: 'stripe',
  context: { userId?: string; orgId?: string; idempotencyKey?: string },
  fn: () => Promise<T>,
  extraFields?: Partial<AuditEntry>,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    await writePaymentAuditLog({
      operation,
      provider,
      status: 'success',
      durationMs: Date.now() - startTime,
      userId: context.userId,
      orgId: context.orgId,
      idempotencyKey: context.idempotencyKey,
      ...extraFields,
    });
    return result;
  } catch (error) {
    await writePaymentAuditLog({
      operation,
      provider,
      status: 'failed',
      durationMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: error instanceof Error && 'code' in error
        ? String((error as Record<string, unknown>).code)
        : undefined,
      userId: context.userId,
      orgId: context.orgId,
      idempotencyKey: context.idempotencyKey,
      ...extraFields,
    });
    throw error;
  }
}
