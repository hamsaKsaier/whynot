import crypto from 'crypto';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('api-key-manager');

export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimitPerHour: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface CreateAPIKeyRequest {
  name: string;
  permissions?: string[];
  rateLimitPerHour?: number;
  expiresInDays?: number;
}

export interface CreateAPIKeyResponse {
  id: string;
  name: string;
  key: string; // Full key - only shown once
  keyPrefix: string;
  permissions: string[];
  createdAt: Date;
  expiresAt: Date | null;
}

export interface WebhookLogEntry {
  id: string;
  apiKeyId: string | null;
  endpoint: string;
  method: string;
  requestBody: any;
  responseStatus: number;
  responseBody: any;
  ipAddress: string | null;
  userAgent: string | null;
  durationMs: number;
  createdAt: Date;
}

const DEFAULT_PERMISSIONS = ['retest', 'status'];
const DEFAULT_RATE_LIMIT = 100;
const KEY_PREFIX_LENGTH = 8;
const KEY_SECRET_LENGTH = 32;

export class APIKeyManager {
  private pool: Pool;

  constructor(pool?: Pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://thundercode:thundercode@localhost:5433/thundercode';
    this.pool = pool || new Pool({ connectionString });
  }

  /**
   * Generate a new API key
   */
  async createAPIKey(request: CreateAPIKeyRequest): Promise<CreateAPIKeyResponse> {
    const id = uuidv4();

    // Generate a secure random key
    const keySecret = crypto.randomBytes(KEY_SECRET_LENGTH).toString('hex');
    const keyPrefix = keySecret.substring(0, KEY_PREFIX_LENGTH);
    const fullKey = `qal_${keySecret}`; // qal = QA Loop prefix

    // Hash the key for storage (never store plain key)
    const keyHash = this.hashKey(fullKey);

    const permissions = request.permissions || DEFAULT_PERMISSIONS;
    const rateLimitPerHour = request.rateLimitPerHour || DEFAULT_RATE_LIMIT;

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (request.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + request.expiresInDays);
    }

    const query = `
      INSERT INTO qa_loop_api_keys (
        id, name, key_hash, key_prefix, permissions, rate_limit_per_hour, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING created_at
    `;

    const result = await this.pool.query(query, [
      id,
      request.name,
      keyHash,
      keyPrefix,
      JSON.stringify(permissions),
      rateLimitPerHour,
      expiresAt
    ]);

    logger.info('API key created', {
      id,
      name: request.name,
      keyPrefix,
      permissions,
      expiresAt
    });

    return {
      id,
      name: request.name,
      key: fullKey, // Return full key only at creation time
      keyPrefix,
      permissions,
      createdAt: result.rows[0].created_at,
      expiresAt
    };
  }

  /**
   * List all API keys (without exposing full keys)
   */
  async listAPIKeys(includeRevoked: boolean = false): Promise<APIKey[]> {
    let query = `
      SELECT id, name, key_prefix, permissions, rate_limit_per_hour,
             last_used_at, expires_at, created_at, revoked_at
      FROM qa_loop_api_keys
    `;

    if (!includeRevoked) {
      query += ' WHERE revoked_at IS NULL';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      permissions: row.permissions,
      rateLimitPerHour: row.rate_limit_per_hour,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at
    }));
  }

  /**
   * Validate an API key and return its details if valid
   */
  async validateAPIKey(key: string): Promise<{
    isValid: boolean;
    apiKey?: APIKey;
    error?: string;
  }> {
    if (!key || !key.startsWith('qal_')) {
      return { isValid: false, error: 'Invalid key format' };
    }

    const keyHash = this.hashKey(key);
    const keyPrefix = key.substring(4, 4 + KEY_PREFIX_LENGTH);

    const query = `
      SELECT id, name, key_prefix, permissions, rate_limit_per_hour,
             last_used_at, expires_at, created_at, revoked_at
      FROM qa_loop_api_keys
      WHERE key_hash = $1 AND key_prefix = $2
    `;

    const result = await this.pool.query(query, [keyHash, keyPrefix]);

    if (result.rows.length === 0) {
      return { isValid: false, error: 'Key not found' };
    }

    const row = result.rows[0];

    // Check if revoked
    if (row.revoked_at) {
      return { isValid: false, error: 'Key has been revoked' };
    }

    // Check if expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { isValid: false, error: 'Key has expired' };
    }

    // Update last used timestamp
    await this.pool.query(
      'UPDATE qa_loop_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [row.id]
    );

    return {
      isValid: true,
      apiKey: {
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        permissions: row.permissions,
        rateLimitPerHour: row.rate_limit_per_hour,
        lastUsedAt: new Date(),
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        revokedAt: null
      }
    };
  }

  /**
   * Verify HMAC signature on a request
   */
  verifyHMACSignature(
    key: string,
    body: string,
    signature: string,
    timestamp: string
  ): { isValid: boolean; error?: string } {
    // Check timestamp freshness (5 minute window)
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(requestTime)) {
      return { isValid: false, error: 'Invalid timestamp' };
    }

    if (Math.abs(now - requestTime) > 300) { // 5 minutes
      return { isValid: false, error: 'Timestamp too old (replay protection)' };
    }

    // Expected format: sha256=<hmac>
    if (!signature.startsWith('sha256=')) {
      return { isValid: false, error: 'Invalid signature format' };
    }

    const providedHmac = signature.substring(7);

    // Calculate expected HMAC
    const dataToSign = `${timestamp}.${body}`;
    const expectedHmac = crypto
      .createHmac('sha256', key)
      .update(dataToSign)
      .digest('hex');

    // Constant-time comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(providedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    )) {
      return { isValid: false, error: 'Invalid signature' };
    }

    return { isValid: true };
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE qa_loop_api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    logger.info('API key revoked', { id });
  }

  /**
   * Check rate limit for an API key
   */
  async checkRateLimit(apiKeyId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    // Get the key's rate limit
    const keyResult = await this.pool.query(
      'SELECT rate_limit_per_hour FROM qa_loop_api_keys WHERE id = $1',
      [apiKeyId]
    );

    if (keyResult.rows.length === 0) {
      return { allowed: false, remaining: 0, resetAt: new Date() };
    }

    const rateLimit = keyResult.rows[0].rate_limit_per_hour;

    // Count requests in the last hour
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as count 
      FROM qa_loop_webhook_logs 
      WHERE api_key_id = $1 
      AND created_at > NOW() - INTERVAL '1 hour'
    `, [apiKeyId]);

    const currentCount = parseInt(countResult.rows[0].count, 10);
    const remaining = Math.max(0, rateLimit - currentCount);

    // Calculate reset time
    const resetAt = new Date();
    resetAt.setHours(resetAt.getHours() + 1);
    resetAt.setMinutes(0);
    resetAt.setSeconds(0);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt
    };
  }

  /**
   * Log a webhook request
   */
  async logWebhookRequest(entry: Omit<WebhookLogEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = uuidv4();

    const query = `
      INSERT INTO qa_loop_webhook_logs (
        id, api_key_id, endpoint, method, request_body,
        response_status, response_body, ip_address, user_agent, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    await this.pool.query(query, [
      id,
      entry.apiKeyId,
      entry.endpoint,
      entry.method,
      JSON.stringify(entry.requestBody),
      entry.responseStatus,
      JSON.stringify(entry.responseBody),
      entry.ipAddress,
      entry.userAgent,
      entry.durationMs
    ]);

    return id;
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(options?: {
    apiKeyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<WebhookLogEntry[]> {
    let query = 'SELECT * FROM qa_loop_webhook_logs';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.apiKeyId) {
      query += ` WHERE api_key_id = $${paramIndex++}`;
      params.push(options.apiKeyId);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      apiKeyId: row.api_key_id,
      endpoint: row.endpoint,
      method: row.method,
      requestBody: row.request_body,
      responseStatus: row.response_status,
      responseBody: row.response_body,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      durationMs: row.duration_ms,
      createdAt: row.created_at
    }));
  }

  /**
   * Hash an API key for secure storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

export default APIKeyManager;
