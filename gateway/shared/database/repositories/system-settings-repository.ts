import { query } from '../connection';

export interface SystemSettingEntity {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: Date;
}

export class SystemSettingsRepository {
  async get(key: string): Promise<string | null> {
    const rows = await query<SystemSettingEntity>('SELECT * FROM system_settings WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
  }

  async getAll(): Promise<SystemSettingEntity[]> {
    return query<SystemSettingEntity>('SELECT * FROM system_settings ORDER BY key');
  }

  async set(key: string, value: string, updatedBy?: string): Promise<SystemSettingEntity> {
    const rows = await query<SystemSettingEntity>(
      `INSERT INTO system_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()
       RETURNING *`,
      [key, value, updatedBy || null]
    );
    return rows[0];
  }

  async delete(key: string): Promise<boolean> {
    const rows = await query<{ key: string }>('DELETE FROM system_settings WHERE key = $1 RETURNING key', [key]);
    return rows.length > 0;
  }
}
