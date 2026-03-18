import { query } from '../connection';

export interface PlanEntity {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  billing_interval: 'monthly' | 'yearly' | 'one_time';
  credits_per_period: number;
  trial_days: number;
  is_custom: boolean;
  is_public: boolean;
  is_archived: boolean;
  sort_order: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlanFeatureEntity {
  id: string;
  plan_id: string;
  feature_key: string;
  feature_value: string;
  created_at: Date;
}

export interface CreatePlanInput {
  name: string;
  slug: string;
  description?: string;
  price_cents: number;
  billing_interval?: 'monthly' | 'yearly' | 'one_time';
  credits_per_period: number;
  trial_days?: number;
  is_custom?: boolean;
  is_public?: boolean;
  sort_order?: number;
}

export interface UpdatePlanInput {
  name?: string;
  slug?: string;
  description?: string;
  price_cents?: number;
  billing_interval?: 'monthly' | 'yearly' | 'one_time';
  credits_per_period?: number;
  trial_days?: number;
  is_custom?: boolean;
  is_public?: boolean;
  sort_order?: number;
  stripe_price_id?: string;
  stripe_product_id?: string;
}

export class PlanRepository {
  async findAll(): Promise<PlanEntity[]> {
    return query<PlanEntity>(
      'SELECT * FROM plans ORDER BY sort_order ASC, created_at ASC'
    );
  }

  async findPublicPlans(): Promise<PlanEntity[]> {
    return query<PlanEntity>(
      'SELECT * FROM plans WHERE is_public = true AND is_archived = false ORDER BY sort_order ASC'
    );
  }

  async findById(id: string): Promise<PlanEntity | null> {
    const result = await query<PlanEntity>(
      'SELECT * FROM plans WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  async findBySlug(slug: string): Promise<PlanEntity | null> {
    const result = await query<PlanEntity>(
      'SELECT * FROM plans WHERE slug = $1',
      [slug]
    );
    return result[0] || null;
  }

  async create(input: CreatePlanInput): Promise<PlanEntity> {
    const result = await query<PlanEntity>(
      `INSERT INTO plans (name, slug, description, price_cents, billing_interval, credits_per_period, trial_days, is_custom, is_public, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.name,
        input.slug,
        input.description || null,
        input.price_cents,
        input.billing_interval || 'monthly',
        input.credits_per_period,
        input.trial_days || 0,
        input.is_custom || false,
        input.is_public !== undefined ? input.is_public : true,
        input.sort_order || 0,
      ]
    );
    return result[0];
  }

  async update(id: string, input: UpdatePlanInput): Promise<PlanEntity | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: Array<[keyof UpdatePlanInput, any]> = [
      ['name', input.name],
      ['slug', input.slug],
      ['description', input.description],
      ['price_cents', input.price_cents],
      ['billing_interval', input.billing_interval],
      ['credits_per_period', input.credits_per_period],
      ['trial_days', input.trial_days],
      ['is_custom', input.is_custom],
      ['is_public', input.is_public],
      ['sort_order', input.sort_order],
      ['stripe_price_id', input.stripe_price_id],
      ['stripe_product_id', input.stripe_product_id],
    ];

    for (const [key, value] of fields) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<PlanEntity>(
      `UPDATE plans SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  async archive(id: string): Promise<PlanEntity | null> {
    const result = await query<PlanEntity>(
      'UPDATE plans SET is_archived = true WHERE id = $1 RETURNING *',
      [id]
    );
    return result[0] || null;
  }

  async restore(id: string): Promise<PlanEntity | null> {
    const result = await query<PlanEntity>(
      'UPDATE plans SET is_archived = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result[0] || null;
  }

  // ─── Plan Features ───────────────────────────────────────────────────────

  async getFeatures(planId: string): Promise<PlanFeatureEntity[]> {
    return query<PlanFeatureEntity>(
      'SELECT * FROM plan_features WHERE plan_id = $1 ORDER BY feature_key ASC',
      [planId]
    );
  }

  async setFeature(planId: string, featureKey: string, featureValue: string): Promise<PlanFeatureEntity> {
    const result = await query<PlanFeatureEntity>(
      `INSERT INTO plan_features (plan_id, feature_key, feature_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_value = $3
       RETURNING *`,
      [planId, featureKey, featureValue]
    );
    return result[0];
  }

  async setFeatures(planId: string, features: Record<string, string>): Promise<PlanFeatureEntity[]> {
    const results: PlanFeatureEntity[] = [];
    for (const [key, value] of Object.entries(features)) {
      const result = await this.setFeature(planId, key, value);
      results.push(result);
    }
    return results;
  }

  async removeFeature(planId: string, featureKey: string): Promise<boolean> {
    await query(
      'DELETE FROM plan_features WHERE plan_id = $1 AND feature_key = $2',
      [planId, featureKey]
    );
    return true;
  }

  async findAllWithFeatures(): Promise<Array<PlanEntity & { features: PlanFeatureEntity[] }>> {
    const plans = await this.findAll();
    const allFeatures = await query<PlanFeatureEntity>(
      'SELECT * FROM plan_features ORDER BY feature_key ASC'
    );

    return plans.map(plan => ({
      ...plan,
      features: allFeatures.filter(f => f.plan_id === plan.id),
    }));
  }

  async countSubscribers(planId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM workspace_subscriptions
       WHERE plan_id = $1 AND status NOT IN ('canceled', 'incomplete')`,
      [planId]
    );
    return parseInt(result[0]?.count || '0', 10);
  }
}
