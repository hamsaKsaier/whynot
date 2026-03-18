/**
 * API Key Authentication Middleware
 *
 * Authenticates CI/CD requests using API keys instead of JWT.
 * Keys are sent via Authorization: Bearer wn_ci_... header.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../../shared/database/connection';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('api-key-auth');

interface CIApiKey {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;
}

/**
 * Generate a new API key
 * Format: wn_ci_<32 random hex chars>
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('hex');
  const key = `wn_ci_${random}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 10);
  return { key, hash, prefix };
}

/**
 * Hash an API key for storage/lookup
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Middleware: authenticate requests using CI API key
 * Sets req.workspaceId if valid
 */
export async function requireApiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer wn_ci_')) {
      res.status(401).json({ error: 'Missing or invalid API key. Use Authorization: Bearer wn_ci_...' });
      return;
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const keyHash = hashApiKey(apiKey);

    const results = await query<CIApiKey>(
      `SELECT id, workspace_id, name, is_active
       FROM ci_api_keys
       WHERE key_hash = $1 AND is_active = true`,
      [keyHash]
    );

    if (results.length === 0) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    const apiKeyRecord = results[0];

    // Set workspace on request
    (req as any).workspaceId = apiKeyRecord.workspace_id;
    (req as any).apiKeyId = apiKeyRecord.id;
    (req as any).apiKeyName = apiKeyRecord.name;

    // Update last_used_at (fire and forget)
    query(
      'UPDATE ci_api_keys SET last_used_at = NOW() WHERE id = $1',
      [apiKeyRecord.id]
    ).catch(() => {});

    logger.debug('CI API key authenticated', {
      keyId: apiKeyRecord.id,
      workspaceId: apiKeyRecord.workspace_id,
    });

    next();
  } catch (error: any) {
    logger.error('API key auth error', { error: error.message });
    res.status(500).json({ error: 'Authentication error' });
  }
}
