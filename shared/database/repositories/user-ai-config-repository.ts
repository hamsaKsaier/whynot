import { query, transaction } from '../connection';

export interface UserAiConfigEntity {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  base_url: string | null;
  api_key_encrypted: Buffer;
  api_key_iv: Buffer;
  api_key_tag: Buffer;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserAiConfigInput {
  user_id: string;
  provider: string;
  model: string;
  base_url?: string | null;
  api_key_encrypted: Buffer;
  api_key_iv: Buffer;
  api_key_tag: Buffer;
  is_default?: boolean;
}

export interface UpdateUserAiConfigInput {
  provider?: string;
  model?: string;
  base_url?: string | null;
  api_key_encrypted?: Buffer;
  api_key_iv?: Buffer;
  api_key_tag?: Buffer;
}

export class UserAiConfigRepository {
  async listByUser(userId: string): Promise<UserAiConfigEntity[]> {
    return query<UserAiConfigEntity>(
      `SELECT * FROM user_ai_config WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }

  async findById(id: string, userId: string): Promise<UserAiConfigEntity | null> {
    const rows = await query<UserAiConfigEntity>(
      `SELECT * FROM user_ai_config WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] ?? null;
  }

  async findDefault(userId: string): Promise<UserAiConfigEntity | null> {
    const rows = await query<UserAiConfigEntity>(
      `SELECT * FROM user_ai_config WHERE user_id = $1 AND is_default = true`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async create(input: CreateUserAiConfigInput): Promise<UserAiConfigEntity> {
    const rows = await query<UserAiConfigEntity>(
      `INSERT INTO user_ai_config (user_id, provider, model, base_url, api_key_encrypted, api_key_iv, api_key_tag, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.user_id,
        input.provider,
        input.model,
        input.base_url ?? null,
        input.api_key_encrypted,
        input.api_key_iv,
        input.api_key_tag,
        input.is_default ?? false,
      ]
    );
    return rows[0];
  }

  async update(
    id: string,
    userId: string,
    input: UpdateUserAiConfigInput
  ): Promise<UserAiConfigEntity | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (input.provider !== undefined) {
      sets.push(`provider = $${idx++}`);
      params.push(input.provider);
    }
    if (input.model !== undefined) {
      sets.push(`model = $${idx++}`);
      params.push(input.model);
    }
    if (input.base_url !== undefined) {
      sets.push(`base_url = $${idx++}`);
      params.push(input.base_url);
    }
    if (input.api_key_encrypted !== undefined) {
      sets.push(`api_key_encrypted = $${idx++}`);
      params.push(input.api_key_encrypted);
      sets.push(`api_key_iv = $${idx++}`);
      params.push(input.api_key_iv);
      sets.push(`api_key_tag = $${idx++}`);
      params.push(input.api_key_tag);
    }

    if (sets.length === 0) return this.findById(id, userId);

    sets.push(`updated_at = now()`);
    params.push(id, userId);

    const rows = await query<UserAiConfigEntity>(
      `UPDATE user_ai_config SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      params
    );
    return rows[0] ?? null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      `DELETE FROM user_ai_config WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    return rows.length > 0;
  }

  async setDefault(id: string, userId: string): Promise<UserAiConfigEntity | null> {
    return transaction(async (client) => {
      await client.query(
        `UPDATE user_ai_config SET is_default = false, updated_at = now() WHERE user_id = $1 AND is_default = true`,
        [userId]
      );
      const result = await client.query(
        `UPDATE user_ai_config SET is_default = true, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId]
      );
      return result.rows[0] ?? null;
    });
  }
}
