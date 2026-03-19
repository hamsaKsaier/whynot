import { query, transaction } from '../connection';

export interface CreditBalanceEntity {
  id: string;
  workspace_id: string;
  balance: number;
  lifetime_credits_purchased: number;
  lifetime_credits_used: number;
  lifetime_credits_granted: number;
  last_refill_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreditTransactionEntity {
  id: string;
  workspace_id: string;
  amount: number;
  balance_after: number;
  type: 'subscription_refill' | 'purchase' | 'usage' | 'refund' | 'admin_grant' | 'admin_revoke' | 'rollover' | 'expiry';
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  performed_by: string | null;
  created_at: Date;
}

export interface AddCreditsInput {
  workspace_id: string;
  amount: number;
  type: CreditTransactionEntity['type'];
  description: string;
  reference_type?: string;
  reference_id?: string;
  performed_by?: string;
}

export interface DeductCreditsInput {
  workspace_id: string;
  amount: number;
  type: CreditTransactionEntity['type'];
  description: string;
  reference_type?: string;
  reference_id?: string;
}

export class CreditRepository {
  async getBalance(workspaceId: string): Promise<CreditBalanceEntity | null> {
    const result = await query<CreditBalanceEntity>(
      'SELECT * FROM credit_balances WHERE workspace_id = $1',
      [workspaceId]
    );
    return result[0] || null;
  }

  async initBalance(workspaceId: string): Promise<CreditBalanceEntity> {
    const result = await query<CreditBalanceEntity>(
      `INSERT INTO credit_balances (workspace_id, balance)
       VALUES ($1, 0)
       ON CONFLICT (workspace_id) DO NOTHING
       RETURNING *`,
      [workspaceId]
    );
    // If ON CONFLICT hit, fetch existing
    if (result.length === 0) {
      const existing = await this.getBalance(workspaceId);
      return existing!;
    }
    return result[0];
  }

  async hasEnoughCredits(workspaceId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(workspaceId);
    if (!balance) return false;
    return balance.balance >= amount;
  }

  async addCredits(input: AddCreditsInput): Promise<CreditTransactionEntity> {
    return transaction(async (client) => {
      // Update balance atomically
      const balanceResult = await client.query(
        `UPDATE credit_balances
         SET balance = balance + $1,
             lifetime_credits_granted = CASE
               WHEN $3 IN ('admin_grant', 'subscription_refill') THEN lifetime_credits_granted + $1
               ELSE lifetime_credits_granted
             END,
             lifetime_credits_purchased = CASE
               WHEN $3 = 'purchase' THEN lifetime_credits_purchased + $1
               ELSE lifetime_credits_purchased
             END,
             last_refill_at = CASE
               WHEN $3 = 'subscription_refill' THEN NOW()
               ELSE last_refill_at
             END
         WHERE workspace_id = $2
         RETURNING balance`,
        [input.amount, input.workspace_id, input.type]
      );

      if (balanceResult.rows.length === 0) {
        throw new Error(`No credit balance found for workspace ${input.workspace_id}`);
      }

      const newBalance = balanceResult.rows[0].balance;

      // Insert transaction record
      const txnResult = await client.query(
        `INSERT INTO credit_transactions
           (workspace_id, amount, balance_after, type, description, reference_type, reference_id, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.workspace_id,
          input.amount,
          newBalance,
          input.type,
          input.description,
          input.reference_type || null,
          input.reference_id || null,
          input.performed_by || null,
        ]
      );

      return txnResult.rows[0] as CreditTransactionEntity;
    });
  }

  async deductCredits(input: DeductCreditsInput): Promise<CreditTransactionEntity> {
    return transaction(async (client) => {
      // Check and deduct atomically
      const balanceResult = await client.query(
        `UPDATE credit_balances
         SET balance = balance - $1,
             lifetime_credits_used = lifetime_credits_used + $1
         WHERE workspace_id = $2 AND balance >= $1
         RETURNING balance`,
        [input.amount, input.workspace_id]
      );

      if (balanceResult.rows.length === 0) {
        throw new Error('Insufficient credits');
      }

      const newBalance = balanceResult.rows[0].balance;

      // Insert transaction record (negative amount)
      const txnResult = await client.query(
        `INSERT INTO credit_transactions
           (workspace_id, amount, balance_after, type, description, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.workspace_id,
          -input.amount,
          newBalance,
          input.type,
          input.description,
          input.reference_type || null,
          input.reference_id || null,
        ]
      );

      return txnResult.rows[0] as CreditTransactionEntity;
    });
  }

  async getTransactions(
    workspaceId: string,
    options?: { offset?: number; limit?: number; type?: string }
  ): Promise<{ transactions: CreditTransactionEntity[]; total: number }> {
    const conditions = ['workspace_id = $1'];
    const values: any[] = [workspaceId];
    let paramIndex = 2;

    if (options?.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(options.type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM credit_transactions ${whereClause}`,
      values
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    values.push(limit, offset);

    const transactions = await query<CreditTransactionEntity>(
      `SELECT * FROM credit_transactions
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { transactions, total };
  }

  async getTotalUsageForPeriod(
    workspaceId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const result = await query<{ total: string }>(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total
       FROM credit_transactions
       WHERE workspace_id = $1
         AND type = 'usage'
         AND created_at >= $2
         AND created_at < $3`,
      [workspaceId, periodStart, periodEnd]
    );
    return parseInt(result[0]?.total || '0', 10);
  }
}
