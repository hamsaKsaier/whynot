import { query } from '../connection';

export interface PaymentTransactionEntity {
  id: string;
  workspace_id: string;
  provider: string;
  provider_transaction_id: string;
  type: 'subscription' | 'one_time' | 'refund' | 'payg';
  status: 'completed' | 'failed' | 'pending';
  amount_cents: bigint;
  currency: string;
  failure_code: string | null;
  failure_message: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreatePaymentTransactionInput {
  workspace_id: string;
  provider: string;
  provider_transaction_id: string;
  type: 'subscription' | 'one_time' | 'refund' | 'payg';
  status: 'completed' | 'failed' | 'pending';
  amount_cents: bigint;
  currency?: string;
  failure_code?: string;
  failure_message?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

export class PaymentTransactionRepository {
  async create(input: CreatePaymentTransactionInput): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO payment_transactions
         (workspace_id, provider, provider_transaction_id, type, status,
          amount_cents, currency, failure_code, failure_message,
          idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        input.workspace_id,
        input.provider,
        input.provider_transaction_id,
        input.type,
        input.status,
        input.amount_cents.toString(),
        input.currency ?? 'usd',
        input.failure_code ?? null,
        input.failure_message ?? null,
        input.idempotency_key ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return result[0].id;
  }

  async findById(id: string): Promise<PaymentTransactionEntity | null> {
    const result = await query<PaymentTransactionEntity>(
      'SELECT * FROM payment_transactions WHERE id = $1',
      [id],
    );
    if (result.length === 0) return null;
    return this.hydrate(result[0]);
  }

  async findByIdempotencyKey(key: string): Promise<PaymentTransactionEntity | null> {
    const result = await query<PaymentTransactionEntity>(
      'SELECT * FROM payment_transactions WHERE idempotency_key = $1',
      [key],
    );
    if (result.length === 0) return null;
    return this.hydrate(result[0]);
  }

  async findByWorkspaceId(
    workspaceId: string,
    options?: { limit?: number; offset?: number; type?: string },
  ): Promise<{ transactions: PaymentTransactionEntity[]; total: number }> {
    const conditions = ['workspace_id = $1'];
    const values: any[] = [workspaceId];
    let paramIndex = 2;

    if (options?.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(options.type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM payment_transactions ${whereClause}`,
      values,
    );
    const total = parseInt(countResult[0]?.count ?? '0', 10);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    values.push(limit, offset);

    const rows = await query<PaymentTransactionEntity>(
      `SELECT * FROM payment_transactions ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values,
    );

    return { transactions: rows.map((r) => this.hydrate(r)), total };
  }

  async updateStatus(id: string, status: string, failureInfo?: { code: string; message: string }): Promise<void> {
    if (failureInfo) {
      await query(
        'UPDATE payment_transactions SET status = $1, failure_code = $2, failure_message = $3 WHERE id = $4',
        [status, failureInfo.code, failureInfo.message, id],
      );
    } else {
      await query('UPDATE payment_transactions SET status = $1 WHERE id = $2', [status, id]);
    }
  }

  private hydrate(row: any): PaymentTransactionEntity {
    return {
      ...row,
      amount_cents: BigInt(row.amount_cents),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }
}
