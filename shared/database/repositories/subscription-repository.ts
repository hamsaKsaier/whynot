import { query } from '../connection';

export interface WorkspaceSubscriptionEntity {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  trial_start: Date | null;
  trial_end: Date | null;
  canceled_at: Date | null;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubscriptionInput {
  workspace_id: string;
  plan_id: string;
  status?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  current_period_start?: Date;
  current_period_end?: Date;
  trial_start?: Date;
  trial_end?: Date;
}

export interface UpdateSubscriptionInput {
  plan_id?: string;
  status?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  current_period_start?: Date;
  current_period_end?: Date;
  trial_start?: Date;
  trial_end?: Date;
  canceled_at?: Date | null;
  cancel_at_period_end?: boolean;
}

export class SubscriptionRepository {
  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscriptionEntity | null> {
    const result = await query<WorkspaceSubscriptionEntity>(
      'SELECT * FROM workspace_subscriptions WHERE workspace_id = $1',
      [workspaceId]
    );
    return result[0] || null;
  }

  async findById(id: string): Promise<WorkspaceSubscriptionEntity | null> {
    const result = await query<WorkspaceSubscriptionEntity>(
      'SELECT * FROM workspace_subscriptions WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  async findByStripeSubscriptionId(stripeId: string): Promise<WorkspaceSubscriptionEntity | null> {
    const result = await query<WorkspaceSubscriptionEntity>(
      'SELECT * FROM workspace_subscriptions WHERE stripe_subscription_id = $1',
      [stripeId]
    );
    return result[0] || null;
  }

  async create(input: CreateSubscriptionInput): Promise<WorkspaceSubscriptionEntity> {
    const result = await query<WorkspaceSubscriptionEntity>(
      `INSERT INTO workspace_subscriptions
         (workspace_id, plan_id, status, stripe_subscription_id, stripe_customer_id,
          current_period_start, current_period_end, trial_start, trial_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.workspace_id,
        input.plan_id,
        input.status || 'active',
        input.stripe_subscription_id || null,
        input.stripe_customer_id || null,
        input.current_period_start || null,
        input.current_period_end || null,
        input.trial_start || null,
        input.trial_end || null,
      ]
    );
    return result[0];
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<WorkspaceSubscriptionEntity | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: Array<[string, any]> = [
      ['plan_id', input.plan_id],
      ['status', input.status],
      ['stripe_subscription_id', input.stripe_subscription_id],
      ['stripe_customer_id', input.stripe_customer_id],
      ['current_period_start', input.current_period_start],
      ['current_period_end', input.current_period_end],
      ['trial_start', input.trial_start],
      ['trial_end', input.trial_end],
      ['canceled_at', input.canceled_at],
      ['cancel_at_period_end', input.cancel_at_period_end],
    ];

    for (const [key, value] of fields) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<WorkspaceSubscriptionEntity>(
      `UPDATE workspace_subscriptions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  async updateByWorkspaceId(workspaceId: string, input: UpdateSubscriptionInput): Promise<WorkspaceSubscriptionEntity | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: Array<[string, any]> = [
      ['plan_id', input.plan_id],
      ['status', input.status],
      ['stripe_subscription_id', input.stripe_subscription_id],
      ['stripe_customer_id', input.stripe_customer_id],
      ['current_period_start', input.current_period_start],
      ['current_period_end', input.current_period_end],
      ['trial_start', input.trial_start],
      ['trial_end', input.trial_end],
      ['canceled_at', input.canceled_at],
      ['cancel_at_period_end', input.cancel_at_period_end],
    ];

    for (const [key, value] of fields) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updates.length === 0) return this.findByWorkspaceId(workspaceId);

    values.push(workspaceId);
    const result = await query<WorkspaceSubscriptionEntity>(
      `UPDATE workspace_subscriptions SET ${updates.join(', ')} WHERE workspace_id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  async findAllPaginated(
    offset: number,
    limit: number,
    filters?: { status?: string; plan_id?: string }
  ): Promise<{ subscriptions: WorkspaceSubscriptionEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`ws.status = $${paramIndex++}`);
      values.push(filters.status);
    }
    if (filters?.plan_id) {
      conditions.push(`ws.plan_id = $${paramIndex++}`);
      values.push(filters.plan_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM workspace_subscriptions ws ${whereClause}`,
      values
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    values.push(limit, offset);
    const subscriptions = await query<WorkspaceSubscriptionEntity>(
      `SELECT ws.* FROM workspace_subscriptions ws
       ${whereClause}
       ORDER BY ws.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { subscriptions, total };
  }

  async findAllActive(): Promise<WorkspaceSubscriptionEntity[]> {
    return query<WorkspaceSubscriptionEntity>(
      `SELECT * FROM workspace_subscriptions
       WHERE status IN ('active', 'trialing')
       ORDER BY created_at DESC`
    );
  }

  async findExpiring(beforeDate: Date): Promise<WorkspaceSubscriptionEntity[]> {
    return query<WorkspaceSubscriptionEntity>(
      `SELECT * FROM workspace_subscriptions
       WHERE status = 'trialing' AND trial_end <= $1
       ORDER BY trial_end ASC`,
      [beforeDate]
    );
  }

  async countByPlan(): Promise<Array<{ plan_id: string; count: number }>> {
    const result = await query<{ plan_id: string; count: string }>(
      `SELECT plan_id, COUNT(*) as count FROM workspace_subscriptions
       WHERE status NOT IN ('canceled', 'incomplete')
       GROUP BY plan_id`
    );
    return result.map(r => ({ plan_id: r.plan_id, count: parseInt(r.count, 10) }));
  }
}
