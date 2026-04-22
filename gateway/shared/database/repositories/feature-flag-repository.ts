import { query } from '../connection';

export interface FeatureFlagEntity {
  key: string;
  name: string;
  description: string | null;
  default_enabled: boolean;
  rollout_percent: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrgFeatureFlagOverride {
  organization_id: string;
  flag_key: string;
  enabled: boolean;
  set_by: string | null;
  set_at: Date;
}

export class FeatureFlagRepository {
  async listFlags(): Promise<FeatureFlagEntity[]> {
    return query<FeatureFlagEntity>(
      `SELECT key, name, description, default_enabled, rollout_percent, created_at, updated_at
       FROM feature_flags ORDER BY key`
    );
  }

  async getByKey(key: string): Promise<FeatureFlagEntity | null> {
    const rows = await query<FeatureFlagEntity>(
      `SELECT key, name, description, default_enabled, rollout_percent, created_at, updated_at
       FROM feature_flags WHERE key = $1`,
      [key]
    );
    return rows[0] || null;
  }

  async getOrgOverride(orgId: string, flagKey: string): Promise<OrgFeatureFlagOverride | null> {
    const rows = await query<OrgFeatureFlagOverride>(
      `SELECT organization_id, flag_key, enabled, set_by, set_at
       FROM organization_feature_flags
       WHERE organization_id = $1 AND flag_key = $2`,
      [orgId, flagKey]
    );
    return rows[0] || null;
  }

  async listOrgOverrides(orgId: string): Promise<OrgFeatureFlagOverride[]> {
    return query<OrgFeatureFlagOverride>(
      `SELECT organization_id, flag_key, enabled, set_by, set_at
       FROM organization_feature_flags
       WHERE organization_id = $1
       ORDER BY flag_key`,
      [orgId]
    );
  }

  async upsertOverride(orgId: string, flagKey: string, enabled: boolean, setBy: string): Promise<OrgFeatureFlagOverride> {
    const rows = await query<OrgFeatureFlagOverride>(
      `INSERT INTO organization_feature_flags (organization_id, flag_key, enabled, set_by, set_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (organization_id, flag_key) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         set_by = EXCLUDED.set_by,
         set_at = NOW()
       RETURNING *`,
      [orgId, flagKey, enabled, setBy]
    );
    return rows[0];
  }

  async deleteOverride(orgId: string, flagKey: string): Promise<boolean> {
    const rows = await query<{ flag_key: string }>(
      `DELETE FROM organization_feature_flags
       WHERE organization_id = $1 AND flag_key = $2
       RETURNING flag_key`,
      [orgId, flagKey]
    );
    return rows.length > 0;
  }

  async listAllOrgOverridesWithFlags(orgId: string): Promise<(FeatureFlagEntity & { override_enabled: boolean | null })[]> {
    return query<FeatureFlagEntity & { override_enabled: boolean | null }>(
      `SELECT f.key, f.name, f.description, f.default_enabled, f.rollout_percent,
              f.created_at, f.updated_at,
              o.enabled AS override_enabled
       FROM feature_flags f
       LEFT JOIN organization_feature_flags o
         ON o.flag_key = f.key AND o.organization_id = $1
       ORDER BY f.key`,
      [orgId]
    );
  }
}
