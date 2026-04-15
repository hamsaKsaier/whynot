import { randomUUID } from 'crypto';
import { query } from '../../shared/database/connection';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function generateIdempotencyKey(): string {
  return randomUUID();
}

export function generateDeterministicKey(
  orgId: string,
  operation: string,
  ...params: string[]
): string {
  const input = [orgId, operation, ...params].join(':');
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `det_${Math.abs(hash).toString(36)}_${orgId.slice(0, 8)}`;
}

export async function checkIdempotencyKey(
  idempotencyKey: string,
): Promise<{ status: string; provider_transaction_id: string | null; metadata: Record<string, unknown> | null } | null> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
  const rows = await query<{
    status: string;
    provider_transaction_id: string | null;
    metadata: string | null;
  }>(
    `SELECT status, provider_transaction_id, metadata
     FROM payment_transactions
     WHERE idempotency_key = $1 AND created_at > $2
     LIMIT 1`,
    [idempotencyKey, cutoff],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    status: row.status,
    provider_transaction_id: row.provider_transaction_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

export async function storeIdempotencyResult(
  idempotencyKey: string,
  transactionId: string,
): Promise<void> {
  await query(
    `UPDATE payment_transactions SET idempotency_key = $1 WHERE id = $2`,
    [idempotencyKey, transactionId],
  );
}
