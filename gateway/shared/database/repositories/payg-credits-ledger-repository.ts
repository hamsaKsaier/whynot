import { query } from '../connection';

export interface PaygLedgerEntity {
  id: string;
  workspace_id: string;
  amount_cents: bigint;
  reason: string;
  related_event_id: string | null;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
}

export interface CreatePaygLedgerInput {
  workspace_id: string;
  amount_cents: bigint;
  reason: string;
  related_event_id: string | null;
  status: 'pending' | 'completed' | 'failed';
}

export class PaygCreditsLedgerRepository {
  async create(input: CreatePaygLedgerInput): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO payg_credits_ledger
         (workspace_id, amount_cents, reason, related_event_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.workspace_id,
        input.amount_cents.toString(),
        input.reason,
        input.related_event_id,
        input.status,
      ],
    );
    return result[0].id;
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'completed' | 'failed',
    stripePaymentIntentId?: string,
  ): Promise<void> {
    if (stripePaymentIntentId) {
      await query(
        'UPDATE payg_credits_ledger SET status = $1, stripe_payment_intent_id = $2 WHERE id = $3',
        [status, stripePaymentIntentId, id],
      );
    } else {
      await query('UPDATE payg_credits_ledger SET status = $1 WHERE id = $2', [status, id]);
    }
  }

  async findByWorkspaceId(
    workspaceId: string,
    options?: { limit?: number; offset?: number; status?: string },
  ): Promise<{ entries: PaygLedgerEntity[]; total: number }> {
    const conditions = ['workspace_id = $1'];
    const values: any[] = [workspaceId];
    let paramIndex = 2;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM payg_credits_ledger ${whereClause}`,
      values,
    );
    const total = parseInt(countResult[0]?.count ?? '0', 10);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    values.push(limit, offset);

    const rows = await query<PaygLedgerEntity>(
      `SELECT * FROM payg_credits_ledger ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values,
    );

    return {
      entries: rows.map((r) => ({ ...r, amount_cents: BigInt(r.amount_cents) })),
      total,
    };
  }

  async sumByWorkspaceId(workspaceId: string, status?: string): Promise<bigint> {
    const conditions = ['workspace_id = $1'];
    const values: any[] = [workspaceId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    const result = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0) as total
       FROM payg_credits_ledger
       WHERE ${conditions.join(' AND ')}`,
      values,
    );

    return BigInt(result[0]?.total ?? '0');
  }
}
