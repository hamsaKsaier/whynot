import { query } from '../connection';
import { encrypt, decrypt } from '../../../src/utils/crypto/secret-cipher';

export interface PlatformAiConfigEntity {
  id: string;
  provider: string;
  display_name: string;
  api_key_encrypted: Buffer | null;
  api_key_iv: Buffer | null;
  api_key_tag: Buffer | null;
  fallback_key_encrypted: Buffer | null;
  fallback_key_iv: Buffer | null;
  fallback_key_tag: Buffer | null;
  default_model: string | null;
  models: string[];
  is_active: boolean;
  rate_limit: number;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformAiConfigSafe {
  id: string;
  provider: string;
  display_name: string;
  hasKey: boolean;
  hasFallbackKey: boolean;
  maskedKey: string | null;
  maskedFallbackKey: string | null;
  default_model: string | null;
  models: string[];
  is_active: boolean;
  rate_limit: number;
  created_at: Date;
  updated_at: Date;
}

function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 4) return '••••';
  return `sk-${'•'.repeat(5)}${plaintext.slice(-4)}`;
}

function toSafe(entity: PlatformAiConfigEntity): PlatformAiConfigSafe {
  const hasKey = entity.api_key_encrypted != null;
  const hasFallbackKey = entity.fallback_key_encrypted != null;

  let maskedKey: string | null = null;
  if (hasKey) {
    const plain = decrypt({
      ciphertext: entity.api_key_encrypted!,
      iv: entity.api_key_iv!,
      tag: entity.api_key_tag!,
    });
    maskedKey = maskApiKey(plain);
  }

  let maskedFallbackKey: string | null = null;
  if (hasFallbackKey) {
    const plain = decrypt({
      ciphertext: entity.fallback_key_encrypted!,
      iv: entity.fallback_key_iv!,
      tag: entity.fallback_key_tag!,
    });
    maskedFallbackKey = maskApiKey(plain);
  }

  return {
    id: entity.id,
    provider: entity.provider,
    display_name: entity.display_name,
    hasKey,
    hasFallbackKey,
    maskedKey,
    maskedFallbackKey,
    default_model: entity.default_model,
    models: entity.models,
    is_active: entity.is_active,
    rate_limit: entity.rate_limit,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

export class PlatformAiConfigRepository {
  async listAll(): Promise<PlatformAiConfigSafe[]> {
    const rows = await query<PlatformAiConfigEntity>(
      `SELECT * FROM platform_ai_config ORDER BY provider`
    );
    return rows.map(toSafe);
  }

  async findByProvider(provider: string): Promise<PlatformAiConfigSafe | null> {
    const rows = await query<PlatformAiConfigEntity>(
      `SELECT * FROM platform_ai_config WHERE provider = $1`,
      [provider]
    );
    if (rows.length === 0) return null;
    return toSafe(rows[0]);
  }

  async findActive(): Promise<PlatformAiConfigSafe[]> {
    const rows = await query<PlatformAiConfigEntity>(
      `SELECT * FROM platform_ai_config WHERE is_active = true ORDER BY provider`
    );
    return rows.map(toSafe);
  }

  async upsertKey(
    provider: string,
    apiKey: string
  ): Promise<PlatformAiConfigSafe> {
    const { ciphertext, iv, tag } = encrypt(apiKey);
    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET api_key_encrypted = $1,
           api_key_iv = $2,
           api_key_tag = $3,
           is_active = true,
           updated_at = NOW()
       WHERE provider = $4
       RETURNING *`,
      [ciphertext, iv, tag, provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async upsertFallbackKey(
    provider: string,
    apiKey: string
  ): Promise<PlatformAiConfigSafe> {
    const { ciphertext, iv, tag } = encrypt(apiKey);
    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET fallback_key_encrypted = $1,
           fallback_key_iv = $2,
           fallback_key_tag = $3,
           updated_at = NOW()
       WHERE provider = $4
       RETURNING *`,
      [ciphertext, iv, tag, provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async removeKey(provider: string): Promise<PlatformAiConfigSafe> {
    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET api_key_encrypted = NULL,
           api_key_iv = NULL,
           api_key_tag = NULL,
           is_active = false,
           updated_at = NOW()
       WHERE provider = $1
       RETURNING *`,
      [provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async removeFallbackKey(provider: string): Promise<PlatformAiConfigSafe> {
    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET fallback_key_encrypted = NULL,
           fallback_key_iv = NULL,
           fallback_key_tag = NULL,
           updated_at = NOW()
       WHERE provider = $1
       RETURNING *`,
      [provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async getDecryptedKey(provider: string): Promise<string | null> {
    const rows = await query<PlatformAiConfigEntity>(
      `SELECT api_key_encrypted, api_key_iv, api_key_tag FROM platform_ai_config WHERE provider = $1`,
      [provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    const row = rows[0];
    if (row.api_key_encrypted == null) return null;
    return decrypt({
      ciphertext: row.api_key_encrypted,
      iv: row.api_key_iv!,
      tag: row.api_key_tag!,
    });
  }

  async getDecryptedFallbackKey(provider: string): Promise<string | null> {
    const rows = await query<PlatformAiConfigEntity>(
      `SELECT fallback_key_encrypted, fallback_key_iv, fallback_key_tag FROM platform_ai_config WHERE provider = $1`,
      [provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    const row = rows[0];
    if (row.fallback_key_encrypted == null) return null;
    return decrypt({
      ciphertext: row.fallback_key_encrypted,
      iv: row.fallback_key_iv!,
      tag: row.fallback_key_tag!,
    });
  }

  async updateModels(provider: string, models: string[]): Promise<PlatformAiConfigSafe> {
    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET models = $1::jsonb,
           updated_at = NOW()
       WHERE provider = $2
       RETURNING *`,
      [JSON.stringify(models), provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async updateDefaultModel(provider: string, model: string): Promise<PlatformAiConfigSafe> {
    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET default_model = $1,
           updated_at = NOW()
       WHERE provider = $2
       RETURNING *`,
      [model, provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async setActive(provider: string, active: boolean): Promise<PlatformAiConfigSafe> {
    if (active) {
      const rows = await query<PlatformAiConfigEntity>(
        `SELECT api_key_encrypted FROM platform_ai_config WHERE provider = $1`,
        [provider]
      );
      if (rows.length === 0) {
        throw new Error(`ai.providerNotFound`);
      }
      if (rows[0].api_key_encrypted == null) {
        throw new Error(`ai.cannotActivateWithoutKey`);
      }
    }

    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET is_active = $1,
           updated_at = NOW()
       WHERE provider = $2
       RETURNING *`,
      [active, provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }

  async updateRateLimit(provider: string, rateLimit: number): Promise<PlatformAiConfigSafe> {
    if (!Number.isInteger(rateLimit) || rateLimit < 0) {
      throw new Error(`ai.invalidRateLimit`);
    }

    const rows = await query<PlatformAiConfigEntity>(
      `UPDATE platform_ai_config
       SET rate_limit = $1,
           updated_at = NOW()
       WHERE provider = $2
       RETURNING *`,
      [rateLimit, provider]
    );
    if (rows.length === 0) {
      throw new Error(`ai.providerNotFound`);
    }
    return toSafe(rows[0]);
  }
}
