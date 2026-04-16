import { query } from '../connection';

export interface BillingConfigEntity {
  key: string;
  value: string;
  updated_at: Date;
}

export class BillingConfigRepository {
  async get(key: string): Promise<string | null> {
    const result = await query<BillingConfigEntity>(
      'SELECT value FROM billing_config WHERE key = $1',
      [key],
    );
    return result[0]?.value ?? null;
  }

  async getInt(key: string, defaultValue: number): Promise<number> {
    const value = await this.get(key);
    if (value == null) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async getBigint(key: string, defaultValue: bigint): Promise<bigint> {
    const value = await this.get(key);
    if (value == null) return defaultValue;
    try {
      return BigInt(value);
    } catch {
      return defaultValue;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await query(
      `INSERT INTO billing_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value],
    );
  }

  async getAll(): Promise<BillingConfigEntity[]> {
    return query<BillingConfigEntity>(
      'SELECT * FROM billing_config ORDER BY key',
    );
  }

  async delete(key: string): Promise<void> {
    await query('DELETE FROM billing_config WHERE key = $1', [key]);
  }

  async getDefaultAiProvider(): Promise<{ provider: string; model: string } | null> {
    const value = await this.get('default_ai_provider');
    if (value == null) return null;
    try {
      return JSON.parse(value) as { provider: string; model: string };
    } catch {
      return null;
    }
  }

  async setDefaultAiProvider(provider: string, model: string): Promise<void> {
    await this.set('default_ai_provider', JSON.stringify({ provider, model }));
  }

  async getAiFallbackOrder(): Promise<string[]> {
    const value = await this.get('ai_fallback_order');
    if (value == null) return [];
    try {
      return JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }

  async setAiFallbackOrder(order: string[]): Promise<void> {
    await this.set('ai_fallback_order', JSON.stringify(order));
  }
}
