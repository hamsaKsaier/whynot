import { query } from '../connection';

export interface BillingHistoryEntity {
  id: string;
  workspace_id: string;
  event_type: string;
  provider: string;
  provider_event_id: string | null;
  amount_cents: bigint | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface RecordBillingHistoryInput {
  workspace_id: string;
  event_type: string;
  provider: string;
  provider_event_id?: string;
  amount_cents?: bigint;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export class BillingHistoryRepository {
  async record(input: RecordBillingHistoryInput): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO billing_history
         (workspace_id, event_type, provider, provider_event_id,
          amount_cents, currency, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.workspace_id,
        input.event_type,
        input.provider,
        input.provider_event_id ?? null,
        input.amount_cents != null ? input.amount_cents.toString() : null,
        input.currency ?? 'usd',
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return result[0].id;
  }

  async findByWorkspaceId(
    workspaceId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ entries: BillingHistoryEntity[]; total: number }> {
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM billing_history WHERE workspace_id = $1',
      [workspaceId],
    );
    const total = parseInt(countResult[0]?.count ?? '0', 10);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = await query<BillingHistoryEntity>(
      `SELECT * FROM billing_history
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    );

    return {
      entries: rows.map((r) => this.hydrate(r)),
      total,
    };
  }

  private hydrate(row: any): BillingHistoryEntity {
    return {
      ...row,
      amount_cents: row.amount_cents != null ? BigInt(row.amount_cents) : null,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }
}
